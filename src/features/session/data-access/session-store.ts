import { create } from 'zustand';
const EMPTY_MESSAGES: ChatMessage[] = [] as any;
import type { ChatMessage, ChatSession, MessageId, SessionId } from './types';
import { authStoreUtils, useAuthStore } from '@/stores/auth.store';

// Local memoization for derived selectors without mutating store state
const NO_IDS_SENTINEL: Record<string, never> = {};
const sessionsArrayCache = new WeakMap<Map<SessionId, ChatSession>, WeakMap<object, ChatSession[]>>();
import { ArchiveManager } from '@/lib/archive/manager';

const getRepo = () => ArchiveManager.getServices().sessionRepository;

interface SessionProjectionState {
    sessions: Map<SessionId, ChatSession>;
    messagesBySession: Map<SessionId, ChatMessage[]>;
    orderedSessionIds?: string[];
    // ✅ 缓存 sessions 数组，避免每次调用都创建新数组
    _cachedSessions?: ChatSession[];
    _cacheVersion?: number;
    // ✅ 缓存 messages 数组，按 sessionId 分组
    _cachedMessagesBySession?: Map<SessionId, ChatMessage[]>;

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
    removeMessage(messageId: MessageId, sessionId: SessionId): void;

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

export const useSessionStore = create<SessionProjectionState & { __activeUserId?: string }>()((set, get) => {
    // Clear projection caches when archive changes
    try {
        ArchiveManager.subscribe((archiveId) => {
            set(() => ({ sessions: new Map(), messagesBySession: new Map(), orderedSessionIds: undefined, __activeUserId: undefined, _cachedSessions: undefined, _cachedMessagesBySession: new Map() } as Partial<SessionProjectionState & { __activeUserId?: string }>));
            // Auto-hydrate when archive switches to current user
            try {
                const uid = authStoreUtils.getStoreInstance().getCurrentUserId();
                if (uid && archiveId === uid) {
                    void get().loadAllSessions();
                }
            } catch { /* noop */ }
        });
    } catch { /* ignore subscription errors in non-browser environments */ }

    return ({
        sessions: new Map(),
        messagesBySession: new Map(),
        orderedSessionIds: undefined,
        _cachedSessions: undefined,
        _cacheVersion: 0,
        _cachedMessagesBySession: new Map(),
        __activeUserId: undefined,

        getSessions() {
            const state = get();
            const sessionsMap = state.sessions;
            const ids = state.orderedSessionIds;

            // WeakMap-based memoization keyed by map and ids array references
            let inner = sessionsArrayCache.get(sessionsMap);
            if (!inner) {
                inner = new WeakMap<object, ChatSession[]>();
                sessionsArrayCache.set(sessionsMap, inner);
            }
            const key = (ids && ids.length > 0 ? (ids as unknown as object) : (NO_IDS_SENTINEL as object));
            const cached = inner.get(key);
            if (cached) return cached;

            let arr: ChatSession[];
            if (ids && ids.length > 0) {
                arr = ids.map(id => sessionsMap.get(id)).filter(Boolean) as ChatSession[];
            } else {
                arr = Array.from(sessionsMap.values()).sort((a, b) => b.updatedAt - a.updatedAt);
            }
            inner.set(key, arr);
            return arr;
        },
        getOrderedIds() { return get().orderedSessionIds || get().getSessions().map(s => s.id); },
        getMessages(sessionId) {
            const state = get();
            const list = state.messagesBySession.get(sessionId) ?? EMPTY_MESSAGES;
            return list;
        },

        upsertSession(s) {
            set((state) => {
                const sessions = new Map(state.sessions);
                sessions.set(s.id, s);
                // keep orderedSessionIds in sync if present
                const orderedSessionIds = state.orderedSessionIds && (state.orderedSessionIds.includes(s.id) ? state.orderedSessionIds : [s.id, ...state.orderedSessionIds]);
                // ✅ 清除缓存
                return { sessions, orderedSessionIds, _cachedSessions: undefined } as Partial<SessionProjectionState>;
            });
            void getRepo().putSession(s);
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
                // ✅ 清除缓存
                const cache = state._cachedMessagesBySession ? new Map(state._cachedMessagesBySession) : new Map();
                cache.delete(sessionId);
                return { sessions, messagesBySession, _cachedSessions: undefined, _cachedMessagesBySession: cache } as Partial<SessionProjectionState>;
            });
            void getRepo().deleteSession(sessionId);
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

                // ✅ 清除该 sessionId 的消息缓存
                const cache = state._cachedMessagesBySession ? new Map(state._cachedMessagesBySession) : new Map();
                cache.delete(m.sessionId);

                return { messagesBySession, sessions, _cachedMessagesBySession: cache } as Partial<SessionProjectionState>;
            });
            void getRepo().putMessage(m);
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

                // ✅ 清除该 sessionId 的消息缓存
                const cache = state._cachedMessagesBySession ? new Map(state._cachedMessagesBySession) : new Map();
                cache.delete(sessionId);

                return { messagesBySession, _cachedMessagesBySession: cache } as Partial<SessionProjectionState>;
            });
            void (async () => {
                const m = await getRepo().getMessage(messageId);
                if (m) await getRepo().putMessage({ ...m, content: m.content + delta });
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

                // ✅ 清除该 sessionId 的消息缓存
                const cache = state._cachedMessagesBySession ? new Map(state._cachedMessagesBySession) : new Map();
                cache.delete(sessionId);

                return { messagesBySession, _cachedMessagesBySession: cache } as Partial<SessionProjectionState>;
            });
            void (async () => {
                const m = await getRepo().getMessage(messageId);
                if (m) await getRepo().putMessage({ ...m, ...patch });
            })();
        },
        removeMessage(messageId, sessionId) {
            set((state) => {
                const list = state.messagesBySession.get(sessionId) || [];
                const nextList = list.filter(x => x.id !== messageId);
                if (nextList.length === list.length) return {} as Partial<SessionProjectionState>;
                const messagesBySession = new Map(state.messagesBySession);
                messagesBySession.set(sessionId, nextList);

                // ✅ 清除该 sessionId 的消息缓存
                const cache = state._cachedMessagesBySession ? new Map(state._cachedMessagesBySession) : new Map();
                cache.delete(sessionId);

                return { messagesBySession, _cachedMessagesBySession: cache } as Partial<SessionProjectionState>;
            });
            void (async () => { try { await getRepo().deleteMessage(messageId); } catch { /* noop */ } })();
        },

        async loadSessionProjection(sessionId) {
            // Gate on authentication and archive readiness
            const isLoggedIn = (() => { try { return !!authStoreUtils.getStoreInstance().getCurrentUserId(); } catch { return false; } })();
            if (!isLoggedIn) return;
            const userId = authStoreUtils.getStoreInstance().getCurrentUserId() || 'anonymous';
            if (ArchiveManager.getCurrentArchiveId() !== userId) { return; }
            const startGen = ArchiveManager.getGeneration();
            const [s, msgsRaw] = await Promise.all([
                getRepo().getSession(sessionId),
                getRepo().listMessages(sessionId)
            ]);
            // Drop stale results if archive switched during load
            if (startGen !== ArchiveManager.getGeneration() || ArchiveManager.getCurrentArchiveId() !== userId) { return; }
            set((state) => {
                const sessions = new Map(state.sessions);
                if (s) {
                    const curr = sessions.get(sessionId);
                    if (!curr) {
                        sessions.set(sessionId, s);
                    } else {
                        const newer = s.updatedAt > curr.updatedAt ? s : curr;
                        const older = newer === s ? curr : s;
                        const merged = { ...newer, meta: { ...(older.meta || {}), ...(newer.meta || {}) } } as ChatSession;
                        sessions.set(sessionId, merged);
                    }
                }
                const messagesBySession = new Map(state.messagesBySession);
                // Deduplicate by id while preserving order (first occurrence kept)
                const seen = new Set<string>();
                const msgs = (msgsRaw || []).filter((m: ChatMessage) => {
                    if (seen.has(m.id)) return false;
                    seen.add(m.id);
                    return true;
                });
                messagesBySession.set(sessionId, msgs);

                // ✅ 清除该 sessionId 的消息缓存
                const cache = state._cachedMessagesBySession ? new Map(state._cachedMessagesBySession) : new Map();
                cache.delete(sessionId);

                return { sessions, messagesBySession, _cachedMessagesBySession: cache } as Partial<SessionProjectionState>;
            });
        },
        async setSessionsOrder(ids) {
            const viewId = 'default';
            const curr = get().getOrderedIds();
            // ✅ 清除缓存
            set({ orderedSessionIds: ids, _cachedSessions: undefined } as Partial<SessionProjectionState>);
            // compute minimal moves from curr -> ids
            const moves: Array<{ sessionId: string; beforeId?: string; afterId?: string }> = [];
            for (let i = 0; i < ids.length; i++) {
                const id = ids[i];
                const afterId = i > 0 ? ids[i - 1] : undefined;
                moves.push({ sessionId: id, afterId });
            }
            try { await getRepo().reorderSessions(viewId, moves); } catch { /* optimistic only */ }
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
            // Skip when unauthenticated to avoid requireAuth throws and Dexie errors
            const isLoggedIn = (() => { try { return !!authStoreUtils.getStoreInstance().getCurrentUserId(); } catch { return false; } })();
            if (!isLoggedIn) {
                set(() => ({ sessions: new Map(), messagesBySession: new Map(), orderedSessionIds: undefined, __activeUserId: undefined, _cachedSessions: undefined, _cachedMessagesBySession: new Map() } as Partial<SessionProjectionState & { __activeUserId?: string }>));
                try { console.debug('[store][loadAllSessions][skip_unauthenticated]'); } catch { /* noop */ }
                return;
            }
            const userId = authStoreUtils.getStoreInstance().getCurrentUserId() || 'anonymous';
            // If switching user, clear store first to avoid mixed state and loops
            const prevUser = get().__activeUserId;
            if (prevUser && prevUser !== userId) {
                set(() => ({ sessions: new Map(), messagesBySession: new Map(), orderedSessionIds: undefined, _cachedSessions: undefined, _cachedMessagesBySession: new Map() } as Partial<SessionProjectionState>));
                try { console.debug('[store][loadAllSessions][clear_on_user_switch]', { from: prevUser, to: userId }); } catch { /* noop */ }
            }
            // Gate on archive readiness: only load when archive matches current user
            if (ArchiveManager.getCurrentArchiveId() !== userId) {
                try { console.debug('[store][loadAllSessions][skip_not_ready]', { archiveId: ArchiveManager.getCurrentArchiveId(), userId }); } catch { /* noop */ }
                return;
            }
            const startGen = ArchiveManager.getGeneration();
            let sessions: ChatSession[] = [] as any;
            try {
                sessions = await getRepo().listSessions();
            } catch (e) {
                // Dexie closed or schema errors: rely on repo retries; do not trigger archive switching here
                try { console.warn('[store][loadAllSessions][repo_error]', { message: String((e as any)?.message || e) }); } catch { /* noop */ }
                sessions = [];
            }
            // Drop stale results if archive switched during load
            if (startGen !== ArchiveManager.getGeneration() || ArchiveManager.getCurrentArchiveId() !== userId) {
                try { console.debug('[store][loadAllSessions][drop_stale]', { startGen, currGen: ArchiveManager.getGeneration() }); } catch { /* noop */ }
                return;
            }
            set((state) => {
                const map = new Map<string, ChatSession>();
                for (const s of sessions as ChatSession[]) {
                    const curr = (state.sessions as Map<string, ChatSession>).get(s.id);
                    if (!curr) {
                        map.set(s.id, s);
                    } else {
                        const newer = s.updatedAt > curr.updatedAt ? s : curr;
                        const older = newer === s ? curr : s;
                        const merged = { ...newer, meta: { ...(older.meta || {}), ...(newer.meta || {}) } } as ChatSession;
                        map.set(s.id, merged);
                    }
                }
                const orderedSessionIds = (sessions as ChatSession[]).map((s: ChatSession) => s.id);
                try { console.debug('[store][loadAllSessions][done]', { count: sessions.length, userId }); } catch { /* noop */ }
                // ✅ 清除缓存
                return { sessions: map, orderedSessionIds, __activeUserId: userId, _cachedSessions: undefined, _cachedMessagesBySession: new Map() } as Partial<SessionProjectionState & { __activeUserId?: string }>;
            });
        }
    });
});
export default useSessionStore;


