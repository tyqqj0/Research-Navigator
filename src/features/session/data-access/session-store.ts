import { create } from 'zustand';
const EMPTY_MESSAGES: ChatMessage[] = [] as any;
import type { ChatMessage, ChatSession, MessageId, SessionId } from './types';
import { sessionRepository } from './session-repository';

interface SessionProjectionState {
    sessions: Map<SessionId, ChatSession>;
    messagesBySession: Map<SessionId, ChatMessage[]>;

    getSessions(): ChatSession[];
    getMessages(sessionId: SessionId): ChatMessage[];

    upsertSession(s: ChatSession): void;
    renameSession(sessionId: SessionId, title: string): void;
    removeSession(sessionId: SessionId): void;

    addMessage(m: ChatMessage): void;
    appendToMessage(messageId: MessageId, sessionId: SessionId, delta: string): void;
    markMessage(messageId: MessageId, sessionId: SessionId, patch: Partial<ChatMessage>): void;

    // hydration
    loadSessionProjection(sessionId: SessionId): Promise<void>;
    loadAllSessions(): Promise<void>;
}

export const useSessionStore = create<SessionProjectionState>()((set, get) => ({
    sessions: new Map(),
    messagesBySession: new Map(),

    getSessions() {
        return Array.from(get().sessions.values()).sort((a, b) => b.updatedAt - a.updatedAt);
    },
    getMessages(sessionId) {
        return get().messagesBySession.get(sessionId) ?? EMPTY_MESSAGES;
    },

    upsertSession(s) {
        set((state) => {
            const sessions = new Map(state.sessions);
            sessions.set(s.id, s);
            return { sessions } as Partial<SessionProjectionState>;
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
            const nextList = [...list, m];
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
        const [s, msgs] = await Promise.all([
            sessionRepository.getSession(sessionId),
            sessionRepository.listMessages(sessionId)
        ]);
        set((state) => {
            const sessions = new Map(state.sessions);
            if (s) sessions.set(sessionId, s);
            const messagesBySession = new Map(state.messagesBySession);
            messagesBySession.set(sessionId, msgs);
            return { sessions, messagesBySession } as Partial<SessionProjectionState>;
        });
    },
    async loadAllSessions() {
        const sessions = await sessionRepository.listSessions();
        set((state) => {
            const map = new Map(state.sessions);
            for (const s of sessions) map.set(s.id, s);
            return { sessions: map } as Partial<SessionProjectionState>;
        });
    }
}));
export default useSessionStore;


