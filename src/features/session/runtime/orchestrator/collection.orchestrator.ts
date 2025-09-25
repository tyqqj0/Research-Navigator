import { commandBus } from '../command-bus';
import { eventBus } from '../event-bus';
import { applyEventToProjection } from '../projectors';
import type { SessionCommand, SessionEvent, Artifact } from '../../data-access/types';
import { searchExecutor } from '../executors/search-executor';
import { collectionExecutor } from '../executors/collection-executor';
import { queryGeneratorExecutor } from '../executors/query-generator-executor';
import { aiQueryGeneratorExecutor } from '../executors/ai-query-generator-executor';
import { pruneExecutor } from '../executors/prune-executor';
import { paperMetadataExecutor } from '../executors/paper-metadata-executor';
import { graphBuilderExecutor } from '../executors/graph-builder-executor';
import { sessionRepository } from '../../data-access/session-repository';
import { runtimeConfig } from '@/features/session/runtime/runtime-config';
import { literatureDataAccess } from '@/features/literature/data-access';
import { interpret, StateFrom } from 'xstate';
import { collectionMachine } from './collection.machine';
import { useSessionStore } from '../../data-access/session-store';

function newId() { return crypto.randomUUID(); }
async function emit(e: SessionEvent) { await eventBus.publish(e); applyEventToProjection(e); }

const runners = new Map<string, { service: any }>();

// Global sentinel to avoid duplicate registrations in dev/hot-reload
declare const globalThis: any;
if (!(globalThis as any).__collectionOrchestratorRegistered) {
    (globalThis as any).__collectionOrchestratorRegistered = true;
} else {
    // Already registered; skip duplicate registration
    // eslint-disable-next-line @typescript-eslint/no-empty-function
}

if ((globalThis as any).__collectionOrchestratorRegisteredOnce !== true) {
    (globalThis as any).__collectionOrchestratorRegisteredOnce = true;
    commandBus.register(async (cmd: SessionCommand) => {
        if (cmd.type === 'InitCollection') {
            const sessionId = cmd.params.sessionId;
            // 幂等：若已绑定集合，则直接复用
            try {
                const s = (useSessionStore as any)?.getState?.().sessions?.get(sessionId);
                if (s?.linkedCollectionId) {
                    await emit({ id: newId(), type: 'SessionCollectionBound', ts: Date.now(), sessionId, payload: { collectionId: s.linkedCollectionId, created: false } });
                    return;
                }
            } catch { /* ignore */ }
            // 仅创建并绑定集合；不在方向确认阶段执行任何检索或入库
            const collection = await literatureDataAccess.collections.createCollection({
                name: `Session ${new Date().toLocaleString()}`,
                description: 'Auto-created for session',
                type: 'temporary' as any,
                ownerUid: '' as any,
                isPublic: false,
                parentId: null as any
            } as any);
            await emit({ id: newId(), type: 'SessionCollectionBound', ts: Date.now(), sessionId, payload: { collectionId: collection.id, created: true } });
            // 提前创建空图谱以便中间面板立即出现，并支持后续实时加点
            try {
                const { useGraphStore } = require('@/features/graph/data-access/graph-store');
                const gs = useGraphStore.getState();
                const graph = await gs.createGraph({ name: `Session Graph ${new Date().toLocaleString()}` });
                await emit({ id: newId(), type: 'GraphReady', ts: Date.now(), sessionId, payload: { graphId: graph.id } as any });
            } catch { /* ignore graph creation errors */ }
            return;
        }
        if (cmd.type === 'StartExpansion') {
            const sessionId = cmd.params.sessionId;
            // 会话级互斥：已在扩展中则忽略
            if (runners.has(sessionId)) {
                return;
            }
            await emit({ id: newId(), type: 'ExpansionStarted', ts: Date.now(), sessionId, payload: {} });
            // 启动 machine
            const service = interpret(collectionMachine, { context: { sessionId, rounds: 0, lastAdded: 0, total: 0 } } as any);
            service.start();
            runners.set(sessionId, { service });

            // 参数（集中在 runtimeConfig）
            const maxRounds = runtimeConfig.EXPANSION_MAX_ROUNDS;
            const roundSize = runtimeConfig.EXPANSION_ROUND_SIZE;
            const upperBound = runtimeConfig.COLLECTION_UPPER_BOUND;
            const zeroTolerance = (runtimeConfig as any).EXPANSION_ZERO_TOLERANCE_ROUNDS ?? 0;

            let total = 0;
            let round = 0;
            let lastAdded = 0;
            let zeroAddStreak = 0;

            async function step() {
                round += 1;
                // 聚合上下文生成查询（更真实）
                const s = (useSessionStore as any)?.getState?.().sessions?.get(sessionId);
                const directionSpec = s?.meta?.direction?.spec as string | undefined;
                const collectionId = s?.linkedCollectionId;
                // 基于事件按需实时获取最近一轮的简报（不持久化）
                let priorBriefs: any[] = [];
                try {
                    priorBriefs = await paperMetadataExecutor.fetchLastRoundBrief(sessionId, 6);
                } catch { priorBriefs = []; }
                // 先尝试 AI 生成，失败则退回启发式
                let ai = await aiQueryGeneratorExecutor.generate({ directionSpec, priorBriefs, round });
                if (!ai?.query) {
                    ai = await queryGeneratorExecutor.generateNextQuery({ recentUserText: 'research', directionSpec, priorBriefs, round } as any);
                }
                const { query, reasoning } = ai;
                await emit({ id: newId(), type: 'SearchRoundPlanned', ts: Date.now(), sessionId, payload: { round, reasoning, query } as any });
                await emit({ id: newId(), type: 'SearchRoundStarted', ts: Date.now(), sessionId, payload: { round, query } });

                // 第一步：仅搜索候选，供 UI 展示 query + 链接
                let candArtifact: Artifact;
                try {
                    candArtifact = await searchExecutor.searchCandidates(query, roundSize) as any;
                } catch (err: any) {
                    await emit({ id: newId(), type: 'SearchRoundFailed', ts: Date.now(), sessionId, payload: { round, stage: 'candidates', error: String(err?.message || err) } as any });
                    return;
                }
                // 附加元数据：会话/集合/轮次
                await sessionRepository.putArtifact({ ...(candArtifact as any), meta: { sessionId, collectionId, round } } as Artifact);
                await emit({ id: newId(), type: 'SearchCandidatesReady', ts: Date.now(), sessionId, payload: { round, artifactId: candArtifact.id } as any });

                // 模拟用户可见时间（避免“瞬间几十篇”），并给 Tavily/后端一些响应时间
                await new Promise(r => setTimeout(r, 600));

                // 第二步：直接用候选 bestIdentifier 入库并构建 batch
                const identifiers: string[] = ((candArtifact as any).data?.candidates || [])
                    .map((c: any) => c?.bestIdentifier)
                    .filter((x: any) => typeof x === 'string' && x.length > 0)
                    .slice(0, roundSize);
                try {
                    const allCands = ((candArtifact as any).data?.candidates || []);
                    const total = allCands.length;
                    const best = identifiers.length;
                    const urlOnly = allCands.filter((c: any) => typeof c?.bestIdentifier === 'string' && /^URL:/i.test(c.bestIdentifier)).length;
                    console.debug('[orch][collection] identifiers for ingestion', { round, totalCandidates: total, withBest: best, urlOnly, preview: identifiers.slice(0, 3) });
                } catch { /* noop */ }
                const ingested: string[] = [];
                let currentCollectionIds: string[] = [];
                let beforeIds: string[] = [];
                try {
                    const { literatureEntry, literatureDataAccess } = require('@/features/literature/data-access');
                    // 记录批量导入前集合中的条目，用于准确计算新增数量
                    if (collectionId) {
                        try {
                            const before = await literatureDataAccess.collections.getCollection(collectionId);
                            beforeIds = (before as any)?.paperIds || [];
                        } catch { /* noop */ }
                    }
                    // 使用批量导入提升速度：后端批量 + 本地并发 + 批量加入集合
                    const result = await literatureEntry.batchImport(
                        identifiers.map((id) => ({ type: 'identifier', data: id, options: { addToCollection: collectionId } }))
                    );
                    // 重新读取集合，计算真正新增的 paperId（避免“看起来更新了但统计为 0”）
                    if (collectionId) {
                        try {
                            const after = await literatureDataAccess.collections.getCollection(collectionId);
                            const afterIds: string[] = (after as any)?.paperIds || [];
                            const beforeSet = new Set(beforeIds);
                            const newlyAdded = afterIds.filter((pid: string) => !beforeSet.has(pid));
                            ingested.push(...newlyAdded);
                            currentCollectionIds = afterIds;
                        } catch {
                            // 回退：若读取失败，则以成功结果作为近似
                            ingested.push(...result.successful.map((i: any) => i.paperId));
                            currentCollectionIds = Array.from(new Set([...(beforeIds || []), ...ingested]));
                        }
                    } else {
                        ingested.push(...result.successful.map((i: any) => i.paperId));
                        currentCollectionIds = ingested.slice();
                    }
                } catch (err: any) {
                    await emit({ id: newId(), type: 'SearchRoundFailed', ts: Date.now(), sessionId, payload: { round, stage: 'execute', error: 'ingestion_failed' } as any });
                    return;
                }
                const batch: Artifact<{ paperIds: string[]; query: string }> = { id: newId(), kind: 'search_batch', version: 1, data: { paperIds: ingested, query }, meta: { sessionId, collectionId, round }, createdAt: Date.now() } as any;
                await sessionRepository.putArtifact(batch as Artifact);
                await emit({ id: newId(), type: 'SearchExecuted', ts: Date.now(), sessionId, payload: { batchId: batch.id, count: ingested.length } });

                // 合并到集合产物（本地不可变产物），并追加到 Literature 集合
                // 从会话仓库读取上一版集合产物以实现累积
                let prev: Artifact<any> | null = null;
                try {
                    const all = await sessionRepository.listArtifacts('literature_collection');
                    const scoped = (all || []).filter((a: any) => (a?.meta?.sessionId === sessionId) && (!a?.meta?.collectionId || a?.meta?.collectionId === collectionId));
                    prev = (scoped && scoped.length > 0) ? scoped.sort((a: any, b: any) => (a.createdAt || 0) - (b.createdAt || 0)).at(-1) as any : null;
                } catch { prev = null; }
                const merged = collectionExecutor.mergeBatch(prev as any, batch);
                // 以实际加入集合的新增为准，避免跨会话产物导致的误判
                lastAdded = ingested.length;
                total = (currentCollectionIds && currentCollectionIds.length > 0) ? currentCollectionIds.length : merged.data.paperIds.length;
                await sessionRepository.putArtifact({ ...(merged as any), meta: { sessionId, collectionId, round } } as unknown as Artifact);

                // 入库已经同时加入集合，此处无需重复

                await emit({ id: newId(), type: 'PapersIngested', ts: Date.now(), sessionId, payload: { batchId: batch.id, added: lastAdded, total } });
                service.send({ type: 'EXECUTED', added: lastAdded, total });
                await emit({ id: newId(), type: 'SearchRoundCompleted', ts: Date.now(), sessionId, payload: { round, added: lastAdded, total } });

                // 评估增长
                const recentGrowth = lastAdded / Math.max(1, total);
                await emit({ id: newId(), type: 'ExpansionEvaluated', ts: Date.now(), sessionId, payload: { lastAdded, recentGrowth } as any });
                try {
                    const { toast } = require('sonner');
                    toast.message(`扩展评估：新增 ${lastAdded}，增长率 ${(recentGrowth * 100).toFixed(1)}%`);
                } catch { /* ignore toast errors */ }

                if (lastAdded === 0) {
                    try {
                        console.debug('[orch][collection] no new results', { round, total, lastAdded, zeroAddStreak, zeroTolerance });
                    } catch { /* noop */ }
                    zeroAddStreak += 1;
                    await emit({ id: newId(), type: 'NoNewResults', ts: Date.now(), sessionId, payload: { round } });
                    if (zeroTolerance === 0 || zeroAddStreak >= zeroTolerance) {
                        await emit({ id: newId(), type: 'ExpansionSaturated', ts: Date.now(), sessionId, payload: { round, reason: 'no_new' } as any });
                        // 自动进入图谱阶段
                        try {
                            await commandBus.dispatch({ id: newId(), type: 'BuildGraph', ts: Date.now(), sessionId, params: { sessionId, window: runtimeConfig.GRAPH_WINDOW_SIZE } } as any);
                            const { toast } = require('sonner');
                            toast.message('扩展结束，自动开始构建关系图');
                        } catch { /* ignore */ }
                        return;
                    } else {
                        // 继续下一轮或因达最大轮数而结束
                        if (round < maxRounds) {
                            setTimeout(step, 800);
                            return;
                        } else {
                            await emit({ id: newId(), type: 'ExpansionSaturated', ts: Date.now(), sessionId, payload: { round, reason: 'max_rounds' } as any });
                            try {
                                await commandBus.dispatch({ id: newId(), type: 'BuildGraph', ts: Date.now(), sessionId, params: { sessionId, window: runtimeConfig.GRAPH_WINDOW_SIZE } } as any);
                                const { toast } = require('sonner');
                                toast.message('已完成多轮扩展，开始构建关系图');
                            } catch { /* ignore */ }
                            return;
                        }
                    }
                }
                if (total > upperBound) {
                    await emit({ id: newId(), type: 'ExpansionSaturated', ts: Date.now(), sessionId, payload: { round, reason: 'max_rounds' } as any });
                    // 触发裁剪
                    await commandBus.dispatch({ id: newId(), type: 'PruneCollection', ts: Date.now(), sessionId, params: { sessionId, targetMax: runtimeConfig.PRUNE_TARGET_MAX, criterion: 'citation_low_first' } } as any);
                    try {
                        const { toast } = require('sonner');
                        toast.message(`已达到集合上限，正在自动裁剪到 ${runtimeConfig.PRUNE_TARGET_MAX} 篇`);
                    } catch { /* ignore toast errors */ }
                    // 裁剪后自动进入图谱阶段
                    try {
                        await commandBus.dispatch({ id: newId(), type: 'BuildGraph', ts: Date.now(), sessionId, params: { sessionId, window: runtimeConfig.GRAPH_WINDOW_SIZE } } as any);
                        const { toast } = require('sonner');
                        toast.message('自动开始构建关系图');
                    } catch { /* ignore */ }
                    return;
                }
                // 仅在当前轮结果写入仓库并同步集合后，才进入下一轮
                if (round < maxRounds) {
                    setTimeout(step, 800);
                } else {
                    // 达到最大轮数后自动进入图谱阶段
                    await emit({ id: newId(), type: 'ExpansionSaturated', ts: Date.now(), sessionId, payload: { round, reason: 'max_rounds' } as any });
                    try {
                        await commandBus.dispatch({ id: newId(), type: 'BuildGraph', ts: Date.now(), sessionId, params: { sessionId, window: runtimeConfig.GRAPH_WINDOW_SIZE } } as any);
                        const { toast } = require('sonner');
                        toast.message('已完成多轮扩展，开始构建关系图');
                    } catch { /* ignore */ }
                }
            }
            setTimeout(step, 0);
            return;
        }
        if (cmd.type === 'StopExpansion') {
            const sessionId = cmd.params.sessionId;
            const r = runners.get(sessionId);
            if (r) { try { r.service.stop(); } catch { } runners.delete(sessionId); }
            await emit({ id: newId(), type: 'ExpansionStopped', ts: Date.now(), sessionId, payload: { by: 'user' } as any });
            return;
        }
        if (cmd.type === 'PruneCollection') {
            const sessionId = cmd.params.sessionId;
            const s = (useSessionStore as any)?.getState?.().sessions?.get(sessionId);
            const collectionId = s?.linkedCollectionId;
            if (!collectionId) return;
            const res = await pruneExecutor.pruneToMax(collectionId, (cmd.params as any).targetMax, (cmd.params as any).criterion);
            await emit({ id: newId(), type: 'CollectionPruned', ts: Date.now(), sessionId, payload: { removed: res.removed, from: res.from, to: res.to, rule: (cmd.params as any).criterion || 'citation_low_first' } });
            return;
        }
        if (cmd.type === 'BuildGraph') {
            const sessionId = cmd.params.sessionId;
            const s = (useSessionStore as any)?.getState?.().sessions?.get(sessionId);
            const collectionId = s?.linkedCollectionId;
            if (!collectionId) return;
            // 以当前图中的节点为唯一来源；若图为空，则用集合进行一次性播种
            const windowSize = (cmd.params as any).window || runtimeConfig.GRAPH_WINDOW_SIZE;
            let papers: Array<{ id: string; title: string }>;
            try {
                const { useGraphStore } = require('@/features/graph/data-access/graph-store');
                const gs = useGraphStore.getState();
                let graphId: string | undefined = s?.meta?.graphId as string | undefined;
                if (!graphId) {
                    const graph = await gs.createGraph({ name: `Session Graph ${new Date().toLocaleString()}` });
                    graphId = graph.id;
                    await emit({ id: newId(), type: 'GraphReady', ts: Date.now(), sessionId, payload: { graphId } as any });
                }
                // 确保可读到图
                await gs.loadGraph(graphId);
                let graph = gs.getGraphById(graphId);
                let graphPaperIds: string[] = graph ? Object.keys(graph.nodes || {}) : [];

                if (graphPaperIds.length === 0) {
                    // 播种：从集合取前 windowSize 个加入图
                    const collection = await literatureDataAccess.collections.getCollection(collectionId as any);
                    const seedIds: string[] = (collection as any)?.paperIds || [];
                    const toSeed = seedIds.slice(0, windowSize);
                    for (const pid of toSeed) {
                        await gs.addNode({ id: pid, kind: 'paper' }, { graphId });
                    }
                    try { console.debug('[orch][collection] graph seeding', { windowSize, seedCount: toSeed.length }); } catch { /* noop */ }
                    graphPaperIds = toSeed;
                }

                const selected = graphPaperIds.slice(0, windowSize);
                await emit({ id: newId(), type: 'GraphConstructionStarted', ts: Date.now(), sessionId, payload: { size: selected.length } });
                papers = selected.map(id => ({ id, title: id }));
            } catch { /* ignore graph store errors */
                papers = [];
            }
            if (!papers || papers.length === 0) {
                try { const { toast } = require('sonner'); toast.message('当前图为空，跳过关系图构建'); } catch { /* noop */ }
                return;
            }
            // Two-stage thinking with streaming UI
            const version = Date.now();
            await emit({ id: newId(), type: 'GraphThinkingStarted', ts: Date.now(), sessionId, payload: { version } as any });
            // Phase 1: semantic grouping & storyline
            const briefs = await paperMetadataExecutor.fetchBriefs(papers.map(p => p.id));
            const p1 = await graphBuilderExecutor.thinkingPhase1(briefs, { onDelta: (d) => emit({ id: newId(), type: 'GraphThinkingDelta', ts: Date.now(), sessionId, payload: { version, phase: 1, delta: d } as any }) });
            await sessionRepository.putArtifact(p1 as Artifact);
            // Phase 2: Title-based natural language relations with rationale/tags/evidence
            // Optionally prime with Phase 1 storyline by sending a short intro delta before streaming
            try {
                const intro = '\n\n（以下基于上一阶段的语义分群与主线，产出候选关系）\n';
                await emit({ id: newId(), type: 'GraphThinkingDelta', ts: Date.now(), sessionId, payload: { version, phase: 2, delta: intro } as any });
            } catch { /* noop */ }
            const p2 = await graphBuilderExecutor.thinkingPhase2TextTitles(briefs, { onDelta: (d) => emit({ id: newId(), type: 'GraphThinkingDelta', ts: Date.now(), sessionId, payload: { version, phase: 2, delta: d } as any }) });
            await sessionRepository.putArtifact(p2 as Artifact);
            await emit({ id: newId(), type: 'GraphThinkingCompleted', ts: Date.now(), sessionId, payload: { version, phase1ArtifactId: p1.id, phase2ArtifactId: p2.id } as any });
            // Backward compatibility event
            await emit({ id: newId(), type: 'GraphRelationsProposed', ts: Date.now(), sessionId, payload: { textArtifactId: p2.id } });
            // Build mapping: include both ids and titles as keys → id
            const idMap: Record<string, string> = {};
            const normalizeTitle = (s?: string) => (s || '')
                .toLowerCase()
                .replace(/[\s\-_:;,./\\]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            for (const b of briefs) {
                idMap[b.id] = b.id;
                if (b.title) {
                    idMap[b.title] = b.id;              // exact title
                    idMap[normalizeTitle(b.title)] = b.id; // normalized title
                }
            }
            const titles = briefs.map(b => b.title).filter(Boolean) as string[];
            const edges = await graphBuilderExecutor.structureEdgesFromText(
                p2.data,
                idMap,
                { titles, maxEdges: (runtimeConfig as any).GRAPH_JSONL_MAX_EDGES ?? 300 }
            );
            await sessionRepository.putArtifact(edges as Artifact);
            await emit({ id: newId(), type: 'GraphEdgesStructured', ts: Date.now(), sessionId, payload: { edgeArtifactId: edges.id, size: edges.data.length } });
            // 将边写入图
            try {
                const { useGraphStore } = require('@/features/graph/data-access/graph-store');
                const gs = useGraphStore.getState();
                const curr = (useSessionStore as any)?.getState?.().sessions?.get(sessionId);
                const graphId = curr?.meta?.graphId;
                if (graphId) {
                    try { console.debug('[orch][collection] applying structured edges to graph', { graphId, edgeCount: (edges as any)?.data?.length }); } catch { /* noop */ }
                    // enforce chronological ordering (publicationDate -> year) for all relations
                    const timeMsById: Record<string, number | undefined> = {};
                    try {
                        const { literatureDataAccess } = require('@/features/literature/data-access');
                        for (const pid of papers.map(p => p.id)) {
                            const item = await literatureDataAccess.literatures.getEnhanced(pid as any);
                            const pub = item?.literature?.publicationDate;
                            let t: number | undefined = undefined;
                            if (typeof pub === 'string' && pub.length > 3) {
                                const d = new Date(pub);
                                if (!isNaN(d.getTime())) t = d.getTime();
                            }
                            if (t === undefined) {
                                const y = item?.literature?.year;
                                if (typeof y === 'number' && isFinite(y)) t = new Date(y, 0, 1).getTime();
                            }
                            timeMsById[pid] = t;
                        }
                    } catch { /* ignore */ }
                    let attempted = 0, added = 0, reorderedDirection = 0, skippedMissingNode = 0, errors = 0;
                    for (const e of (edges as any).data) {
                        attempted++;
                        // Enforce timeline direction: from older (smaller year) to newer (larger year)
                        let fromId = e.sourceId;
                        let toId = e.targetId;
                        const sy = timeMsById[fromId];
                        const ty = timeMsById[toId];
                        if (typeof sy === 'number' && typeof ty === 'number' && sy > ty) {
                            const tmp = fromId; fromId = toId; toId = tmp;
                            reorderedDirection++;
                        }
                        try {
                            // validate nodes exist in current graph snapshot
                            const g = useGraphStore.getState().graphs.get(graphId);
                            if (!g?.nodes?.[fromId] || !g?.nodes?.[toId]) {
                                skippedMissingNode++;
                                continue;
                            }
                            await gs.addEdge({ from: fromId, to: toId, relation: e.relation, tags: e.tags, meta: e.rationale || e.evidence ? { rationale: e.rationale, evidence: e.evidence } : undefined }, { graphId });
                            added++;
                        } catch (err) {
                            errors++;
                        }
                    }
                    try { console.debug('[orch][collection] edges apply summary', { attempted, added, reorderedDirection, skippedMissingNode, errors }); } catch { /* noop */ }
                }
            } catch { /* ignore */ }
            try {
                const { useGraphStore } = require('@/features/graph/data-access/graph-store');
                const gsState = (useGraphStore as any)?.getState?.();
                const sess = (useSessionStore as any)?.getState?.().sessions?.get(sessionId);
                const gid = sess?.meta?.graphId;
                const g = gid ? gsState?.graphs?.get?.(gid) : null;
                const edgeCount = g?.edges ? Object.keys(g.edges).length : 0;
                await emit({ id: newId(), type: 'GraphConstructionCompleted', ts: Date.now(), sessionId, payload: { nodes: papers.length, edges: edgeCount } });
            } catch {
                await emit({ id: newId(), type: 'GraphConstructionCompleted', ts: Date.now(), sessionId, payload: { nodes: papers.length, edges: edges.data.length } });
            }
            // 请求用户决策：确认图谱或补充扩展
            try {
                const curr = (useSessionStore as any)?.getState?.().sessions?.get(sessionId);
                const graphId = curr?.meta?.graphId as string | undefined;
                if (graphId) {
                    await emit({ id: newId(), type: 'GraphDecisionRequested', ts: Date.now(), sessionId, payload: { graphId, nodes: papers.length, edges: edges.data.length } as any });
                }
            } catch { /* ignore */ }
            return;
        }
    });
}


