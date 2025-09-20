import { commandBus } from '../command-bus';
import { eventBus } from '../event-bus';
import { applyEventToProjection } from '../projectors';
import type { SessionCommand, SessionEvent, Artifact } from '../../data-access/types';
import { searchExecutor } from '../executors/search-executor';
import { collectionExecutor } from '../executors/collection-executor';
import { queryGeneratorExecutor } from '../executors/query-generator-executor';
import { paperMetadataExecutor } from '../executors/paper-metadata-executor';
import { pruneExecutor } from '../executors/prune-executor';
import { graphBuilderExecutor } from '../executors/graph-builder-executor';
import { sessionRepository } from '../../data-access/session-repository';
import { literatureDataAccess } from '@/features/literature/data-access';
import { interpret, StateFrom } from 'xstate';
import { collectionMachine } from './collection.machine';
import { useSessionStore } from '../../data-access/session-store';

function newId() { return crypto.randomUUID(); }
async function emit(e: SessionEvent) { await eventBus.publish(e); applyEventToProjection(e); }

const runners = new Map<string, { service: any }>();

commandBus.register(async (cmd: SessionCommand) => {
    if (cmd.type === 'InitCollection') {
        const sessionId = cmd.params.sessionId;
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
        await emit({ id: newId(), type: 'ExpansionStarted', ts: Date.now(), sessionId, payload: {} });
        // 启动 machine
        const service = interpret(collectionMachine, { context: { sessionId, rounds: 0, lastAdded: 0, total: 0 } } as any);
        service.start();
        runners.set(sessionId, { service });

        // 参数
        const maxRounds = 4;
        const roundSize = 8;
        const upperBound = 80;

        let total = 0;
        let round = 0;
        let lastAdded = 0;

        async function step() {
            round += 1;
            // 生成查询（更真实）
            const { query, reasoning } = await queryGeneratorExecutor.generateNextQuery({ recentUserText: 'research' });
            await emit({ id: newId(), type: 'SearchRoundStarted', ts: Date.now(), sessionId, payload: { round, query } });

            // 第一步：仅搜索候选，供 UI 展示 query + 链接
            const candArtifact = await searchExecutor.searchCandidates(query, roundSize);
            await sessionRepository.putArtifact(candArtifact as Artifact);
            await emit({ id: newId(), type: 'SearchCandidatesReady', ts: Date.now(), sessionId, payload: { round, artifactId: candArtifact.id } as any });

            // 模拟用户可见时间（避免“瞬间几十篇”），并给 Tavily/后端一些响应时间
            await new Promise(r => setTimeout(r, 600));

            // 第二步：解析为 paperIds 并返回 batch
            const batch = await searchExecutor.execute(query, roundSize);
            await sessionRepository.putArtifact(batch as Artifact);
            await emit({ id: newId(), type: 'SearchExecuted', ts: Date.now(), sessionId, payload: { batchId: batch.id, count: batch.data.paperIds.length } });

            // 合并到集合产物（本地不可变产物），并追加到 Literature 集合
            const prev = null; // TODO: could load existing collection artifact
            const merged = collectionExecutor.mergeBatch(prev, batch);
            lastAdded = merged.added;
            total = merged.data.paperIds.length;
            await sessionRepository.putArtifact(merged as unknown as Artifact);

            // 将新 paperIds 自动加入当前会话绑定集合（Chat 中无需手动入库）
            try {
                const s = (useSessionStore as any)?.getState?.().sessions?.get(sessionId);
                const collectionId = s?.linkedCollectionId;
                if (collectionId && batch.data.paperIds.length) {
                    await literatureDataAccess.collections.addItemsToCollection(collectionId as any, batch.data.paperIds);
                }
            } catch { /* ignore add to collection errors */ }

            // 简要元数据（用于后续查询生成）
            const brief = await paperMetadataExecutor.fetchBriefs(batch.data.paperIds.slice(0, Math.min(lastAdded, 6)));
            const summary = { id: newId(), kind: 'search_round_summary', version: 1, data: { round, query, briefList: brief }, createdAt: Date.now() } as unknown as Artifact;
            await sessionRepository.putArtifact(summary);

            await emit({ id: newId(), type: 'PapersIngested', ts: Date.now(), sessionId, payload: { batchId: batch.id, added: lastAdded, total } });
            service.send({ type: 'EXECUTED', added: lastAdded, total });
            await emit({ id: newId(), type: 'SearchRoundCompleted', ts: Date.now(), sessionId, payload: { round, added: lastAdded, total } });

            // 评估增长
            const recentGrowth = lastAdded / Math.max(1, total);
            await emit({ id: newId(), type: 'ExpansionEvaluated', ts: Date.now(), sessionId, payload: { lastAdded, recentGrowth } as any });

            if (lastAdded === 0) {
                await emit({ id: newId(), type: 'NoNewResults', ts: Date.now(), sessionId, payload: { round } });
                await emit({ id: newId(), type: 'ExpansionSaturated', ts: Date.now(), sessionId, payload: { round, reason: 'no_new' } as any });
                return;
            }
            if (total > upperBound) {
                await emit({ id: newId(), type: 'ExpansionSaturated', ts: Date.now(), sessionId, payload: { round, reason: 'max_rounds' } as any });
                // 触发裁剪
                await commandBus.dispatch({ id: newId(), type: 'PruneCollection', ts: Date.now(), sessionId, params: { sessionId, targetMax: 60, criterion: 'citation_low_first' } } as any);
                return;
            }
            if (round < maxRounds) {
                setTimeout(step, 800);
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
        // 简化：取 Literature 集合对象，构造最小 papers 列表
        const collection = await literatureDataAccess.collections.getCollection(collectionId as any);
        const paperIds: string[] = (collection as any)?.paperIds || [];
        await emit({ id: newId(), type: 'GraphConstructionStarted', ts: Date.now(), sessionId, payload: { size: paperIds.length } });
        const papers = paperIds.slice(0, (cmd.params as any).window || 60).map(id => ({ id, title: id }));
        // 创建图并填入节点
        try {
            const { useGraphStore } = require('@/features/graph/data-access/graph-store');
            const gs = useGraphStore.getState();
            const graph = await gs.createGraph({ name: `Session Graph ${new Date().toLocaleString()}` });
            for (const pid of papers.map(p => p.id)) {
                await gs.addNode({ id: pid, kind: 'paper' }, { graphId: graph.id });
            }
            await emit({ id: newId(), type: 'GraphReady', ts: Date.now(), sessionId, payload: { graphId: graph.id } as any });
        } catch { /* ignore graph store errors */ }
        const relText = await graphBuilderExecutor.proposeRelationsText(papers);
        await sessionRepository.putArtifact(relText as Artifact);
        await emit({ id: newId(), type: 'GraphRelationsProposed', ts: Date.now(), sessionId, payload: { textArtifactId: relText.id } });
        const idMap = Object.fromEntries(papers.map(p => [p.id, p.id]));
        const edges = await graphBuilderExecutor.structureEdgesFromText(relText.data, idMap);
        await sessionRepository.putArtifact(edges as Artifact);
        await emit({ id: newId(), type: 'GraphEdgesStructured', ts: Date.now(), sessionId, payload: { edgeArtifactId: edges.id, size: edges.data.length } });
        // 将边写入图
        try {
            const { useGraphStore } = require('@/features/graph/data-access/graph-store');
            const gs = useGraphStore.getState();
            const curr = (useSessionStore as any)?.getState?.().sessions?.get(sessionId);
            const graphId = curr?.meta?.graphId;
            if (graphId) {
                for (const e of edges.data as any[]) {
                    await gs.addEdge({ from: e.sourceId, to: e.targetId, relation: e.relation }, { graphId });
                }
            }
        } catch { /* ignore */ }
        await emit({ id: newId(), type: 'GraphConstructionCompleted', ts: Date.now(), sessionId, payload: { nodes: papers.length, edges: edges.data.length } });
        return;
    }
});


