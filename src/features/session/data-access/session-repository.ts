// Dexie repository for Chat Sessions / Messages / Events / Artifacts (minimal)
import Dexie, { Table } from 'dexie';
import type { ChatMessage, ChatSession, EventEnvelope } from './types';

class SessionDatabase extends Dexie {
    sessions!: Table<ChatSession, string>;
    messages!: Table<ChatMessage, string>;
    events!: Table<EventEnvelope, string>;

    constructor() {
        super('ResearchNavigatorSession');
        this.version(1).stores({
            sessions: 'id, updatedAt',
            messages: 'id, sessionId, createdAt',
            events: 'id, ts, sessionId'
        });
    }
}

export const sessionDb = new SessionDatabase();

export const sessionRepository = {
    async putSession(s: ChatSession) { await sessionDb.sessions.put(s); },
    async getSession(id: string) { return await sessionDb.sessions.get(id) ?? null; },
    async listSessions() { return await sessionDb.sessions.orderBy('updatedAt').reverse().toArray(); },
    async deleteSession(id: string) { await sessionDb.sessions.delete(id); },

    async putMessage(m: ChatMessage) { await sessionDb.messages.put(m); },
    async listMessages(sessionId: string) { return await sessionDb.messages.where({ sessionId }).sortBy('createdAt'); },
    async getMessage(id: string) { return await sessionDb.messages.get(id) ?? null; },

    async appendEvent(e: EventEnvelope) { await sessionDb.events.put(e); },
    async listEvents(sessionId?: string) {
        return sessionId ? await sessionDb.events.where({ sessionId }).sortBy('ts') : await sessionDb.events.orderBy('ts').toArray();
    }
};


