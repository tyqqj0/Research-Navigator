import { useSessionStore } from '../data-access/session-store';
import { extractDirectionText } from './prompts/direction';
import type { SessionEvent } from '../data-access/types';

export function applyEventToProjection(e: SessionEvent) {
    const store = useSessionStore.getState();
    if (e.type === 'SessionCreated') {
        const now = e.ts;
        store.upsertSession({ id: e.sessionId!, title: e.payload.title, createdAt: now, updatedAt: now });
        return;
    }
    if (e.type === 'SessionRenamed') {
        store.renameSession(e.sessionId!, e.payload.title);
        return;
    }
    if (e.type === 'UserMessageAdded') {
        store.addMessage({ id: e.payload.messageId, sessionId: e.sessionId!, role: 'user', content: e.payload.text, status: 'done', createdAt: e.ts });
        return;
    }
    if (e.type === 'AssistantMessageStarted') {
        store.addMessage({ id: e.payload.messageId, sessionId: e.sessionId!, role: 'assistant', content: '', status: 'streaming', createdAt: e.ts });
        return;
    }
    if (e.type === 'AssistantMessageDelta') {
        store.appendToMessage(e.payload.messageId, e.sessionId!, e.payload.delta);
        return;
    }
    if (e.type === 'AssistantMessageCompleted') {
        store.markMessage(e.payload.messageId, e.sessionId!, { status: 'done' });
        return;
    }
    if (e.type === 'AssistantMessageAborted') {
        store.markMessage(e.payload.messageId, e.sessionId!, { status: 'aborted' });
        return;
    }
    if (e.type === 'AssistantMessageFailed') {
        store.markMessage(e.payload.messageId, e.sessionId!, { status: 'error', error: e.payload.error });
        return;
    }

    // Deep Research mode projection
    if (e.type === 'DeepResearchModeChanged') {
        try {
            const s = (useSessionStore.getState() as any).sessions.get(e.sessionId!);
            if (s) {
                const next = { ...s, meta: { ...s.meta, deepResearchEnabled: e.payload.enabled }, updatedAt: e.ts } as any;
                store.upsertSession(next);
            }
        } catch { /* ignore */ }
        const sid = e.sessionId!;
        const msgId = `deep_research_${e.ts}`;
        const note = e.payload.enabled ? '已开启 Deep Research 模式' : '已关闭 Deep Research 模式';
        // store.addMessage({ id: msgId, sessionId: sid, role: 'system', content: note, status: 'done', createdAt: e.ts });
        console.log(`[Session] Deep research mode changed: ${e.payload.enabled}`);
        return;
    }

    // Direction phase projection additions (minimal):
    if (e.type === 'DirectionProposalStarted') {
        const sid = e.sessionId!; const msgId = `proposal_${e.payload.version}`;
        store.addMessage({ id: msgId, sessionId: sid, role: 'assistant', content: '', status: 'streaming', createdAt: e.ts });
        return;
    }
    if (e.type === 'DirectionProposalDelta') {
        const sid = e.sessionId!; const msgId = `proposal_${e.payload.version}`;
        store.appendToMessage(msgId, sid, e.payload.delta);
        return;
    }
    if (e.type === 'DirectionProposed') {
        const sid = e.sessionId!;
        const msgId = `proposal_${e.payload.version}`;
        const content = extractDirectionText(e.payload.proposalText || '');
        // 如果已经开始了 streaming，则用提取后的文本覆盖并标记完成；否则直接新增
        try {
            const list = (useSessionStore.getState() as any).messagesBySession.get(sid) || [];
            const exists = list.find((m: any) => m.id === msgId);
            if (exists) {
                store.markMessage(msgId, sid, { status: 'done', content } as any);
            } else {
                store.addMessage({ id: msgId, sessionId: sid, role: 'assistant', content, status: 'done', createdAt: e.ts });
            }
        } catch {
            store.addMessage({ id: msgId, sessionId: sid, role: 'assistant', content, status: 'done', createdAt: e.ts });
        }
        return;
    }
    if (e.type === 'DirectionProposalAborted') {
        const sid = e.sessionId!; const msgId = `proposal_${e.payload.version}`;
        try { store.markMessage(msgId, sid, { status: 'aborted' }); } catch { }
        return;
    }
    if (e.type === 'DecisionRequested') {
        try {
            const s = (useSessionStore.getState() as any).sessions.get(e.sessionId!);
            if (s) {
                const next = { ...s, meta: { ...s.meta, direction: { ...(s.meta?.direction || {}), version: e.payload.version, awaitingDecision: true } }, updatedAt: e.ts } as any;
                store.upsertSession(next);
            }
        } catch { /* ignore */ }
        console.log(`[Session] Decision requested: ${e.payload.version}`);
        return;
    }
    if (e.type === 'DirectionDecisionRecorded') {
        // append a small system note
        const sid = e.sessionId!;
        const msgId = `decision_${e.payload.version}_${e.id}`;
        const text = e.payload.action === 'confirm' ? '已确认方向。' : e.payload.action === 'refine' ? `请求细化：${e.payload.feedback || ''}` : '已取消方向。';
        store.addMessage({ id: msgId, sessionId: sid, role: 'system', content: text, status: 'done', createdAt: e.ts });
        // clear awaiting flag
        try {
            const s = (useSessionStore.getState() as any).sessions.get(e.sessionId!);
            if (s) {
                const next = { ...s, meta: { ...s.meta, direction: { ...(s.meta?.direction || {}), awaitingDecision: false } }, updatedAt: e.ts } as any;
                store.upsertSession(next);
            }
        } catch { /* ignore */ }
        console.log(`[Session] Direction decision recorded: ${e.payload.action} (feedback: ${e.payload.feedback})`);
        return;
    }
    if (e.type === 'DirectionConfirmed') {
        const sid = e.sessionId!;
        const msgId = `direction_${e.payload.version}`;
        store.addMessage({ id: msgId, sessionId: sid, role: 'system', content: `方向确定：\n${e.payload.directionSpec}`, status: 'done', createdAt: e.ts });
        // update session stage/meta
        try {
            const s = (useSessionStore.getState() as any).sessions.get(e.sessionId!);
            if (s) {
                const next = {
                    ...s,
                    meta: {
                        ...s.meta,
                        direction: { ...(s.meta?.direction || {}), confirmed: true, version: e.payload.version, spec: e.payload.directionSpec },
                        stage: 'collection',
                        // 阶段切换为集合时：默认展开右侧面板
                        graphPanelOpen: true,
                        stageChangedAt: e.ts
                    },
                    updatedAt: e.ts
                } as any;
                store.upsertSession(next);
            }
        } catch { /* ignore */ }
        console.log(`[Session] Direction confirmed: ${e.payload.directionSpec}`);
        return;
    }

    // Collection projections (minimal counters; session meta 可后续扩展)
    if (e.type === 'ExpansionStarted') {
        const sid = e.sessionId!; const msgId = `expansion_start_${e.ts}`;
        store.addMessage({ id: msgId, sessionId: sid, role: 'system', content: '开始扩展…', status: 'done', createdAt: e.ts });
        return;
    }
    if (e.type === 'SearchExecuted') {
        const sid = e.sessionId!; const msgId = `search_${e.payload.batchId}`;
        // store.addMessage({ id: msgId, sessionId: sid, role: 'system', content: `检索完成：${e.payload.count} 篇`, status: 'done', createdAt: e.ts });
        return;
    }
    if (e.type === 'SearchRoundStarted') {
        const sid = e.sessionId!; const msgId = `round_start_${e.payload.round}`;
        // store.addMessage({ id: msgId, sessionId: sid, role: 'system', content: `第 ${e.payload.round} 轮开始：${e.payload.query}`, status: 'done', createdAt: e.ts });
        return;
    }
    if (e.type === 'SearchRoundPlanned') {
        const sid = e.sessionId!; const msgId = `plan_${e.payload.round}`;
        // const text = `⏳ 思考中...\n${e.payload.reasoning}\n\n查询：**${e.payload.query}**`;
        const text = `**${e.payload.reasoning}**`;
        store.addMessage({ id: msgId, sessionId: sid, role: 'assistant', content: text, status: 'streaming', createdAt: e.ts });
        return;
    }
    if (e.type === 'SearchRoundCompleted') {
        const sid = e.sessionId!; const msgId = `round_done_${e.payload.round}`;
        // store.addMessage({ id: msgId, sessionId: sid, role: 'system', content: `第 ${e.payload.round} 轮完成：新增 ${e.payload.added}，总计 ${e.payload.total}`, status: 'done', createdAt: e.ts });
        try {
            const { toast } = require('sonner');
            const added = (e as any)?.payload?.added ?? 0;
            const total = (e as any)?.payload?.total ?? 0;
            if (added > 0) toast.success(`本轮新增 ${added} 篇（总计 ${total}）`);
        } catch { /* ignore toast errors */ }
        return;
    }
    if (e.type === 'SearchCandidatesReady') {
        const sid = e.sessionId!; const msgId = `cands_${e.payload.artifactId}`;
        store.addMessage({ id: msgId, sessionId: sid, role: 'assistant', content: `候选已就绪（点击展开查看查询与链接）`, status: 'done', createdAt: e.ts });
        // 标记思考消息完成
        try { store.markMessage(`plan_${(e as any).payload.round}`, sid, { status: 'done' }); } catch { }
        return;
    }
    if (e.type === 'SearchRoundFailed') {
        const sid = e.sessionId!; const msgId = `round_failed_${e.payload.round}_${e.ts}`;
        // store.addMessage({ id: msgId, sessionId: sid, role: 'system', content: `⚠️ 第 ${e.payload.round} 轮失败（阶段：${e.payload.stage}）：${e.payload.error}`, status: 'error', createdAt: e.ts });
        try { store.markMessage(`plan_${e.payload.round}`, sid, { status: 'error' }); } catch { }
        try { store.markMessage(`round_start_${e.payload.round}`, sid, { status: 'error' }); } catch { }
        try {
            const { toast } = require('sonner');
            const stageText = (e as any)?.payload?.stage || 'unknown';
            const errorText = (e as any)?.payload?.error || '操作失败';
            toast.error(`扩展失败（阶段：${stageText}）：${errorText}`);
        } catch { /* ignore toast errors */ }
        return;
    }
    if (e.type === 'NoNewResults') {
        const sid = e.sessionId!; const msgId = `round_none_${e.payload.round}`;
        // store.addMessage({ id: msgId, sessionId: sid, role: 'system', content: `第 ${e.payload.round} 轮没有新结果`, status: 'done', createdAt: e.ts });
        return;
    }
    if (e.type === 'ExpansionSaturated') {
        const sid = e.sessionId!; const msgId = `saturated_${e.payload.round}`;
        store.addMessage({ id: msgId, sessionId: sid, role: 'system', content: `扩展已停止（原因：${e.payload.reason}）`, status: 'done', createdAt: e.ts });
        return;
    }
    if (e.type === 'ExpansionStopped') {
        const sid = e.sessionId!; const msgId = `expansion_stopped_${e.ts}`;
        store.addMessage({ id: msgId, sessionId: sid, role: 'system', content: '已停止扩展', status: 'done', createdAt: e.ts });
        return;
    }
    if (e.type === 'PapersIngested') {
        const sid = e.sessionId!; const msgId = `ingest_${e.payload.batchId}`;
        // store.addMessage({ id: msgId, sessionId: sid, role: 'system', content: `合并：新增 ${e.payload.added} 篇，总计 ${e.payload.total}`, status: 'done', createdAt: e.ts });
        return;
    }
    if (e.type === 'CollectionUpdated') {
        const sid = e.sessionId!; const msgId = `collection_${e.payload.collectionId}_v${e.payload.version}`;
        // store.addMessage({ id: msgId, sessionId: sid, role: 'system', content: `集合版本 v${e.payload.version}，总计 ${e.payload.total}`, status: 'done', createdAt: e.ts });
        return;
    }
    if (e.type === 'SessionCollectionBound') {
        const sid = e.sessionId!;
        // 为了简单：直接写入 session 的 linkedCollectionId（通过公开方法）
        try { (useSessionStore.getState() as any).bindSessionCollection(sid, e.payload.collectionId); } catch { /* ignore */ }
        const msgId = `bind_collection_${e.payload.collectionId}`;
        const note = e.payload.created ? '已为会话创建并绑定集合' : '已绑定到现有集合';
        // store.addMessage({ id: msgId, sessionId: sid, role: 'system', content: `${note}：${e.payload.collectionId}`, status: 'done', createdAt: e.ts });
        // 将新集合写入 CollectionStore，避免右侧列表长期“加载中”
        try {
            const { useCollectionStore } = require('@/features/literature/data-access/stores');
            const cs = (useCollectionStore as any).getState();
            // 若不存在，则注入一个最小空集合占位，随后由 hooks 刷新细节
            if (!cs.getCollection(e.payload.collectionId)) {
                cs.addCollection({ id: e.payload.collectionId, name: 'Session Collection', description: '', type: 'temporary', ownerUid: '', isPublic: false, paperIds: [], itemCount: 0, createdAt: new Date(e.ts), updatedAt: new Date(e.ts) });
            }
        } catch { /* ignore */ }

        return;
    }
    if (e.type === 'CollectionPruned') {
        const sid = e.sessionId!; const msgId = `pruned_${e.id}`;
        // store.addMessage({ id: msgId, sessionId: sid, role: 'system', content: `集合裁剪：${e.payload.from} → ${e.payload.to}（规则：${e.payload.rule}）`, status: 'done', createdAt: e.ts });
        console.log(`[Session] Collection pruned: ${e.payload.from} → ${e.payload.to}（规则：${e.payload.rule}）`);
        return;
    }
    if (e.type === 'GraphConstructionStarted') {
        const sid = e.sessionId!; const msgId = `graph_start_${e.ts}`;
        // store.addMessage({ id: msgId, sessionId: sid, role: 'system', content: `开始构建关系图（候选 ${e.payload.size} 篇）`, status: 'done', createdAt: e.ts });
        console.log(`[Session] Graph construction started: ${e.payload.size} candidates`);
        return;
    }
    if (e.type === 'GraphRelationsProposed') {
        const sid = e.sessionId!; const msgId = `graph_rel_${e.payload.textArtifactId}`;
        // store.addMessage({ id: msgId, sessionId: sid, role: 'system', content: `已生成关系文本（Artifact: ${e.payload.textArtifactId}）`, status: 'done', createdAt: e.ts });
        console.log(`[Session] Graph relations proposed: ${e.payload.textArtifactId}`);
        return;
    }
    if (e.type === 'GraphEdgesStructured') {
        const sid = e.sessionId!; const msgId = `graph_edges_${e.payload.edgeArtifactId}`;
        // store.addMessage({ id: msgId, sessionId: sid, role: 'system', content: `已抽取结构化边：${e.payload.size} 条`, status: 'done', createdAt: e.ts });
        console.log(`[Session] Graph edges structured: ${e.payload.size} edges`);
        return;
    }
    if (e.type === 'GraphConstructionCompleted') {
        const sid = e.sessionId!; const msgId = `graph_done_${e.ts}`;
        // store.addMessage({ id: msgId, sessionId: sid, role: 'system', content: `关系图构建完成：节点 ${e.payload.nodes}，边 ${e.payload.edges}`, status: 'done', createdAt: e.ts });
        console.log(`[Session] Graph construction completed: ${e.payload.nodes} nodes, ${e.payload.edges} edges`);
        try {
            const { toast } = require('sonner');
            toast.success(`关系图构建完成：节点 ${e.payload.nodes}，边 ${e.payload.edges}`);
        } catch { /* ignore toast errors */ }
        return;
    }
    if (e.type === 'GraphDecisionRequested') {
        // 将等待确认的标记写入 session.meta.graphDecision，并追加一条消息以在消息流中渲染决策卡
        try {
            const s = (useSessionStore.getState() as any).sessions.get(e.sessionId!);
            if (s) {
                const next = { ...s, meta: { ...s.meta, graphDecision: { awaiting: true, graphId: e.payload.graphId, nodes: (e as any).payload.nodes, edges: (e as any).payload.edges } }, updatedAt: e.ts } as any;
                store.upsertSession(next);
            }
        } catch { /* ignore */ }
        try {
            const sid = e.sessionId!;
            const msgId = `graph_decision_${e.ts}`;
            store.addMessage({ id: msgId, sessionId: sid, role: 'assistant', content: '请确认当前图谱', status: 'done', createdAt: e.ts });
        } catch { /* ignore */ }
        return;
    }
    if (e.type === 'GraphReady') {
        // 写入 session.meta.graphId，驱动 UI 渲染 GraphCanvas
        try {
            const s = (useSessionStore.getState() as any).sessions.get(e.sessionId!);
            if (s) {
                const next = { ...s, meta: { ...s.meta, graphId: e.payload.graphId }, updatedAt: e.ts } as any;
                store.upsertSession(next);
            }
        } catch { /* ignore */ }
        console.log(`[Session] Graph ready: ${e.payload.graphId}`);
        return;
    }

    // Report generation lifecycle
    if (e.type === 'ReportGenerationStarted') {
        try {
            const s = (useSessionStore.getState() as any).sessions.get(e.sessionId!);
            if (s) {
                const prevReport = ((s.meta as any)?.report) || {};
                const reportMeta = { ...prevReport, [e.payload.messageId]: { citeKeys: e.payload.citeKeys, bibtexByKey: e.payload.bibtexByKey } };
                const next = {
                    ...s,
                    meta: {
                        ...s.meta,
                        report: reportMeta,
                        stage: 'reporting',
                        graphDecision: { ...((s.meta as any)?.graphDecision || {}), awaiting: false, locked: true },
                        // 报告阶段：保持展开，确保图谱/列表可见
                        graphPanelOpen: true,
                        stageChangedAt: e.ts
                    },
                    updatedAt: e.ts
                } as any;
                store.upsertSession(next);
            }
        } catch { /* ignore */ }
        return;
    }
    if (e.type === 'ReportGenerationCompleted') {
        try {
            const s = (useSessionStore.getState() as any).sessions.get(e.sessionId!);
            if (s) {
                const next = { ...s, meta: { ...s.meta, stage: 'report_done' }, updatedAt: e.ts } as any;
                store.upsertSession(next);
            }
        } catch { /* ignore */ }
        return;
    }
}


