import { useSessionStore } from '../data-access/session-store';
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

    // Direction phase projection additions (minimal):
    if (e.type === 'DirectionProposed') {
        const sid = e.sessionId!;
        const msgId = `proposal_${e.payload.version}`;
        store.addMessage({ id: msgId, sessionId: sid, role: 'assistant', content: e.payload.proposalText, status: 'done', createdAt: e.ts });
        return;
    }
    if (e.type === 'DecisionRequested') {
        // could set a UI flag in session meta in the future
        return;
    }
    if (e.type === 'DirectionDecisionRecorded') {
        // append a small system note
        const sid = e.sessionId!;
        const msgId = `decision_${e.payload.version}_${e.id}`;
        const text = e.payload.action === 'confirm' ? '已确认方向。' : e.payload.action === 'refine' ? `请求细化：${e.payload.feedback || ''}` : '已取消方向。';
        store.addMessage({ id: msgId, sessionId: sid, role: 'system', content: text, status: 'done', createdAt: e.ts });
        return;
    }
    if (e.type === 'DirectionConfirmed') {
        const sid = e.sessionId!;
        const msgId = `direction_${e.payload.version}`;
        store.addMessage({ id: msgId, sessionId: sid, role: 'system', content: `方向确定：\n${e.payload.directionSpec}`, status: 'done', createdAt: e.ts });
        return;
    }
}


