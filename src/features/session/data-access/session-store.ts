import { create } from 'zustand';
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
        return get().messagesBySession.get(sessionId) || [];
    },

    upsertSession(s) {
        set((state) => {
            const sessions = new Map(state.sessions);
            sessions.set(s.id, s);
            return { sessions } as Partial<SessionProjectionState>;
        });
        void sessionRepository.putSession(s);
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

import { create } from 'zustand';
import type { ChatMessage, ChatSession, MessageId, SessionId } from './types';

interface SessionStoreState {
    sessions: Map<SessionId, ChatSession>;
    messageIdsBySession: Map<SessionId, MessageId[]>;
    messages: Map<MessageId, ChatMessage>;
    currentSessionId: SessionId | null;

    // selectors
    getCurrentSession(): ChatSession | null;
    getMessages(sessionId: SessionId): ChatMessage[];

    // mutators for projectors
    upsertSession(s: ChatSession): void;
    setCurrentSession(id: SessionId | null): void;
    addMessage(m: ChatMessage): void;
    appendToMessage(id: MessageId, delta: string): void;
    markMessage(id: MessageId, patch: Partial<ChatMessage>): void;
}

export const useSessionStore = create<SessionStoreState>((set, get) => ({
    sessions: new Map(),
    messageIdsBySession: new Map(),
    messages: new Map(),
    currentSessionId: null,

    getCurrentSession() {
        const id = get().currentSessionId; if (!id) return null;
        return get().sessions.get(id) ?? null;
    },

    getMessages(sessionId) {
        const ids = get().messageIdsBySession.get(sessionId) ?? [];
        const list = ids.map(id => get().messages.get(id)).filter(Boolean) as ChatMessage[];
        return list;
    },

    upsertSession(s) {
        set((st) => {
            const sessions = new Map(st.sessions);
            sessions.set(s.id, s);
            return { sessions } as any;
        });
    },

    setCurrentSession(id) { set({ currentSessionId: id }); },

    addMessage(m) {
        set((st) => {
            const messages = new Map(st.messages);
            messages.set(m.id, m);
            const by = new Map(st.messageIdsBySession);
            const arr = by.get(m.sessionId) ? [...(by.get(m.sessionId) as MessageId[]), m.id] : [m.id];
            by.set(m.sessionId, arr);
            return { messages, messageIdsBySession: by } as any;
        });
    },

    appendToMessage(id, delta) {
        set((st) => {
            const m = st.messages.get(id); if (!m) return {} as any;
            const messages = new Map(st.messages);
            messages.set(id, { ...m, content: (m.content || '') + delta });
            return { messages } as any;
        });
    },

    markMessage(id, patch) {
        set((st) => {
            const m = st.messages.get(id); if (!m) return {} as any;
            const messages = new Map(st.messages);
            messages.set(id, { ...m, ...patch });
            return { messages } as any;
        });
    },
}));

export default useSessionStore;


