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
        store.addMessage({ id: msgId, sessionId: sid, role: 'system', content: note, status: 'done', createdAt: e.ts });
        return;
    }

    // Direction phase projection additions (minimal):
    if (e.type === 'DirectionProposed') {
        const sid = e.sessionId!;
        const msgId = `proposal_${e.payload.version}`;
        const content = extractDirectionText(e.payload.proposalText || '');
        store.addMessage({ id: msgId, sessionId: sid, role: 'assistant', content, status: 'done', createdAt: e.ts });
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
                const next = { ...s, meta: { ...s.meta, direction: { ...(s.meta?.direction || {}), confirmed: true, version: e.payload.version, spec: e.payload.directionSpec }, stage: 'collection' }, updatedAt: e.ts } as any;
                store.upsertSession(next);
            }
        } catch { /* ignore */ }
        return;
    }

    // Collection projections (minimal counters; session meta 可后续扩展)
    if (e.type === 'SearchExecuted') {
        const sid = e.sessionId!; const msgId = `search_${e.payload.batchId}`;
        store.addMessage({ id: msgId, sessionId: sid, role: 'system', content: `检索完成：${e.payload.count} 篇`, status: 'done', createdAt: e.ts });
        return;
    }
    if (e.type === 'SearchRoundStarted') {
        const sid = e.sessionId!; const msgId = `round_start_${e.payload.round}`;
        store.addMessage({ id: msgId, sessionId: sid, role: 'system', content: `第 ${e.payload.round} 轮开始：${e.payload.query}`, status: 'done', createdAt: e.ts });
        return;
    }
    if (e.type === 'SearchRoundCompleted') {
        const sid = e.sessionId!; const msgId = `round_done_${e.payload.round}`;
        store.addMessage({ id: msgId, sessionId: sid, role: 'system', content: `第 ${e.payload.round} 轮完成：新增 ${e.payload.added}，总计 ${e.payload.total}`, status: 'done', createdAt: e.ts });
        return;
    }
    if (e.type === 'SearchCandidatesReady') {
        const sid = e.sessionId!; const msgId = `cands_${e.payload.artifactId}`;
        store.addMessage({ id: msgId, sessionId: sid, role: 'assistant', content: `候选已就绪（点击展开查看查询与链接）`, status: 'done', createdAt: e.ts });
        return;
    }
    if (e.type === 'NoNewResults') {
        const sid = e.sessionId!; const msgId = `round_none_${e.payload.round}`;
        store.addMessage({ id: msgId, sessionId: sid, role: 'system', content: `第 ${e.payload.round} 轮没有新结果`, status: 'done', createdAt: e.ts });
        return;
    }
    if (e.type === 'ExpansionSaturated') {
        const sid = e.sessionId!; const msgId = `saturated_${e.payload.round}`;
        store.addMessage({ id: msgId, sessionId: sid, role: 'system', content: `扩展已停止（原因：${e.payload.reason}）`, status: 'done', createdAt: e.ts });
        return;
    }
    if (e.type === 'PapersIngested') {
        const sid = e.sessionId!; const msgId = `ingest_${e.payload.batchId}`;
        store.addMessage({ id: msgId, sessionId: sid, role: 'system', content: `合并：新增 ${e.payload.added} 篇，总计 ${e.payload.total}`, status: 'done', createdAt: e.ts });
        return;
    }
    if (e.type === 'CollectionUpdated') {
        const sid = e.sessionId!; const msgId = `collection_${e.payload.collectionId}_v${e.payload.version}`;
        store.addMessage({ id: msgId, sessionId: sid, role: 'system', content: `集合版本 v${e.payload.version}，总计 ${e.payload.total}`, status: 'done', createdAt: e.ts });
        return;
    }
    if (e.type === 'SessionCollectionBound') {
        const sid = e.sessionId!;
        // 为了简单：直接写入 session 的 linkedCollectionId（通过公开方法）
        try { (useSessionStore.getState() as any).bindSessionCollection(sid, e.payload.collectionId); } catch { /* ignore */ }
        const msgId = `bind_collection_${e.payload.collectionId}`;
        const note = e.payload.created ? '已为会话创建并绑定集合' : '已绑定到现有集合';
        store.addMessage({ id: msgId, sessionId: sid, role: 'system', content: `${note}：${e.payload.collectionId}`, status: 'done', createdAt: e.ts });
        return;
    }
    if (e.type === 'CollectionPruned') {
        const sid = e.sessionId!; const msgId = `pruned_${e.id}`;
        store.addMessage({ id: msgId, sessionId: sid, role: 'system', content: `集合裁剪：${e.payload.from} → ${e.payload.to}（规则：${e.payload.rule}）`, status: 'done', createdAt: e.ts });
        return;
    }
    if (e.type === 'GraphConstructionStarted') {
        const sid = e.sessionId!; const msgId = `graph_start_${e.ts}`;
        store.addMessage({ id: msgId, sessionId: sid, role: 'system', content: `开始构建关系图（候选 ${e.payload.size} 篇）`, status: 'done', createdAt: e.ts });
        return;
    }
    if (e.type === 'GraphRelationsProposed') {
        const sid = e.sessionId!; const msgId = `graph_rel_${e.payload.textArtifactId}`;
        store.addMessage({ id: msgId, sessionId: sid, role: 'system', content: `已生成关系文本（Artifact: ${e.payload.textArtifactId}）`, status: 'done', createdAt: e.ts });
        return;
    }
    if (e.type === 'GraphEdgesStructured') {
        const sid = e.sessionId!; const msgId = `graph_edges_${e.payload.edgeArtifactId}`;
        store.addMessage({ id: msgId, sessionId: sid, role: 'system', content: `已抽取结构化边：${e.payload.size} 条`, status: 'done', createdAt: e.ts });
        return;
    }
    if (e.type === 'GraphConstructionCompleted') {
        const sid = e.sessionId!; const msgId = `graph_done_${e.ts}`;
        store.addMessage({ id: msgId, sessionId: sid, role: 'system', content: `关系图构建完成：节点 ${e.payload.nodes}，边 ${e.payload.edges}`, status: 'done', createdAt: e.ts });
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
        return;
    }
}


