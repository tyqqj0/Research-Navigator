import { create } from 'zustand';
const EMPTY_MESSAGES: ChatMessage[] = [] as any;
import type { ChatMessage, ChatSession, MessageId, SessionId } from './types';
import { sessionRepository } from './session-repository';
import { authStoreUtils, useAuthStore } from '@/stores/auth.store';

interface SessionProjectionState {
    sessions: Map<SessionId, ChatSession>;
    messagesBySession: Map<SessionId, ChatMessage[]>;
    orderedSessionIds?: string[];

    getSessions(): ChatSession[];
    getOrderedIds(): string[];
    getMessages(sessionId: SessionId): ChatMessage[];

    upsertSession(s: ChatSession): void;
    // 绑定集合ID（在投影层维护便捷方法）
    bindSessionCollection(sessionId: SessionId, collectionId: string): void;
    renameSession(sessionId: SessionId, title: string): void;
    removeSession(sessionId: SessionId): void;

    addMessage(m: ChatMessage): void;
    appendToMessage(messageId: MessageId, sessionId: SessionId, delta: string): void;
    markMessage(messageId: MessageId, sessionId: SessionId, patch: Partial<ChatMessage>): void;

    // ordering
    setSessionsOrder(ids: string[]): Promise<void>;
    moveAfter(sessionId: string, afterId?: string): Promise<void>;
    moveBefore(sessionId: string, beforeId?: string): Promise<void>;

    // hydration
    loadSessionProjection(sessionId: SessionId): Promise<void>;
    loadAllSessions(): Promise<void>;

    // UI meta helpers
    setSessionMeta(sessionId: SessionId, patch: Record<string, unknown>): void;
    setGraphPanelOpen(sessionId: SessionId, open: boolean): void;
    toggleGraphPanel(sessionId: SessionId): void;
}

export const useSessionStore = create<SessionProjectionState & { __activeUserId?: string }>()((set, get) => ({
    sessions: new Map(),
    messagesBySession: new Map(),
    orderedSessionIds: undefined,
    __activeUserId: undefined,

    getSessions() {
        const ids = get().orderedSessionIds;
        if (ids && ids.length > 0) {
            const all = get().sessions;
            return ids.map(id => all.get(id)).filter(Boolean) as ChatSession[];
        }
        return Array.from(get().sessions.values()).sort((a, b) => b.updatedAt - a.updatedAt);
    },
    getOrderedIds() { return get().orderedSessionIds || get().getSessions().map(s => s.id); },
    getMessages(sessionId) {
        return get().messagesBySession.get(sessionId) ?? EMPTY_MESSAGES;
    },

    upsertSession(s) {
        set((state) => {
            const sessions = new Map(state.sessions);
            sessions.set(s.id, s);
            // keep orderedSessionIds in sync if present
            const orderedSessionIds = state.orderedSessionIds && (state.orderedSessionIds.includes(s.id) ? state.orderedSessionIds : [s.id, ...state.orderedSessionIds]);
            return { sessions, orderedSessionIds } as Partial<SessionProjectionState>;
        });
        void sessionRepository.putSession(s);
    },
    // 绑定集合ID
    bindSessionCollection(sessionId: SessionId, collectionId: string) {
        const curr = get().sessions.get(sessionId);
        if (!curr) return;
        const next = { ...curr, linkedCollectionId: collectionId, updatedAt: Date.now() } as ChatSession;
        get().upsertSession(next);
    },
    // 通用：更新会话的 meta（浅合并）
    setSessionMeta(sessionId, patch) {
        const curr = get().sessions.get(sessionId);
        if (!curr) return;
        const next = { ...curr, meta: { ...(curr.meta || {}), ...patch }, updatedAt: Date.now() } as ChatSession;
        get().upsertSession(next);
    },
    // 设置/切换右侧图谱+集合面板开关
    setGraphPanelOpen(sessionId, open) {
        get().setSessionMeta(sessionId, { graphPanelOpen: open, graphPanelToggledAt: Date.now() });
    },
    toggleGraphPanel(sessionId) {
        const curr = get().sessions.get(sessionId);
        if (!curr) return;
        const prevOpen = Boolean((curr.meta as any)?.graphPanelOpen);
        get().setGraphPanelOpen(sessionId, !prevOpen);
    },
    renameSession(sessionId, title) {
        const curr = get().sessions.get(sessionId);
        if (!curr) return;
        const next = { ...curr, title, updatedAt: Date.now() } as ChatSession;
        get().upsertSession(next);
    },
    removeSession(sessionId) {
        set((state) => {
            const sessions = new Map(state.sessions);
            const messagesBySession = new Map(state.messagesBySession);
            sessions.delete(sessionId);
            messagesBySession.delete(sessionId);
            return { sessions, messagesBySession } as Partial<SessionProjectionState>;
        });
        void sessionRepository.deleteSession(sessionId);
    },

    addMessage(m) {
        set((state) => {
            const list = state.messagesBySession.get(m.sessionId) || [];
            const existingIdx = list.findIndex(x => x.id === m.id);
            const nextList = existingIdx >= 0
                ? (() => { const arr = [...list]; arr[existingIdx] = { ...list[existingIdx], ...m }; return arr; })()
                : [...list, m];
            const messagesBySession = new Map(state.messagesBySession);
            messagesBySession.set(m.sessionId, nextList);

            const s = state.sessions.get(m.sessionId);
            const sessions = s ? new Map(state.sessions).set(m.sessionId, { ...s, updatedAt: Date.now() }) : state.sessions;
            return { messagesBySession, sessions } as Partial<SessionProjectionState>;
        });
        void sessionRepository.putMessage(m);
    },
    appendToMessage(messageId, sessionId, delta) {
        set((state) => {
            const list = state.messagesBySession.get(sessionId) || [];
            const idx = list.findIndex(x => x.id === messageId);
            if (idx < 0) return {} as Partial<SessionProjectionState>;
            const updated = { ...list[idx], content: list[idx].content + delta } as ChatMessage;
            const nextList = [...list];
            nextList[idx] = updated;
            const messagesBySession = new Map(state.messagesBySession);
            messagesBySession.set(sessionId, nextList);
            return { messagesBySession } as Partial<SessionProjectionState>;
        });
        void (async () => {
            const m = await sessionRepository.getMessage(messageId);
            if (m) await sessionRepository.putMessage({ ...m, content: m.content + delta });
        })();
    },
    markMessage(messageId, sessionId, patch) {
        set((state) => {
            const list = state.messagesBySession.get(sessionId) || [];
            const idx = list.findIndex(x => x.id === messageId);
            if (idx < 0) return {} as Partial<SessionProjectionState>;
            const updated = { ...list[idx], ...patch } as ChatMessage;
            const nextList = [...list];
            nextList[idx] = updated;
            const messagesBySession = new Map(state.messagesBySession);
            messagesBySession.set(sessionId, nextList);
            return { messagesBySession } as Partial<SessionProjectionState>;
        });
        void (async () => {
            const m = await sessionRepository.getMessage(messageId);
            if (m) await sessionRepository.putMessage({ ...m, ...patch });
        })();
    },

    async loadSessionProjection(sessionId) {
        const [s, msgsRaw] = await Promise.all([
            sessionRepository.getSession(sessionId),
            sessionRepository.listMessages(sessionId)
        ]);
        set((state) => {
            const sessions = new Map(state.sessions);
            if (s) sessions.set(sessionId, s);
            const messagesBySession = new Map(state.messagesBySession);
            // Deduplicate by id while preserving order (first occurrence kept)
            const seen = new Set<string>();
            const msgs = (msgsRaw || []).filter((m: ChatMessage) => {
                if (seen.has(m.id)) return false;
                seen.add(m.id);
                return true;
            });
            messagesBySession.set(sessionId, msgs);
            return { sessions, messagesBySession } as Partial<SessionProjectionState>;
        });
    },
    async setSessionsOrder(ids) {
        const viewId = 'default';
        const curr = get().getOrderedIds();
        set({ orderedSessionIds: ids });
        // compute minimal moves from curr -> ids
        const moves: Array<{ sessionId: string; beforeId?: string; afterId?: string }> = [];
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            const afterId = i > 0 ? ids[i - 1] : undefined;
            moves.push({ sessionId: id, afterId });
        }
        try { await sessionRepository.reorderSessions(viewId, moves); } catch { /* optimistic only */ }
    },
    async moveAfter(sessionId, afterId) {
        const ids = get().getOrderedIds();
        const filtered = ids.filter(id => id !== sessionId);
        const idx = afterId ? filtered.indexOf(afterId) + 1 : 0;
        const next = [...filtered.slice(0, idx), sessionId, ...filtered.slice(idx)];
        await get().setSessionsOrder(next);
    },
    async moveBefore(sessionId, beforeId) {
        const ids = get().getOrderedIds();
        const filtered = ids.filter(id => id !== sessionId);
        const idx = beforeId ? Math.max(0, filtered.indexOf(beforeId)) : 0;
        const next = [...filtered.slice(0, idx), sessionId, ...filtered.slice(idx)];
        await get().setSessionsOrder(next);
    },

    async loadAllSessions() {
        const userId = (() => { try { return authStoreUtils.getStoreInstance().getCurrentUserId() || 'anonymous'; } catch { return 'anonymous'; } })();
        // If switching user, clear store first to avoid mixed state and loops
        const prevUser = get().__activeUserId;
        if (prevUser && prevUser !== userId) {
            set(() => ({ sessions: new Map(), messagesBySession: new Map(), orderedSessionIds: undefined } as Partial<SessionProjectionState>));
        }
        const sessions = await sessionRepository.listSessions();
        set(() => {
            const map = new Map(sessions.map((s: ChatSession) => [s.id, s] as const));
            const orderedSessionIds = sessions.map((s: ChatSession) => s.id);
            return { sessions: map, orderedSessionIds, __activeUserId: userId } as Partial<SessionProjectionState & { __activeUserId?: string }>;
        });
    }
}));
export default useSessionStore;


