// Dexie repository for Chat Sessions / Messages / Events / Artifacts (minimal)
import Dexie, { Table } from 'dexie';
import type { ChatMessage, ChatSession, EventEnvelope, Artifact, SessionLayout } from './types';

class SessionDatabase extends Dexie {
    sessions!: Table<ChatSession, string>;
    messages!: Table<ChatMessage, string>;
    events!: Table<EventEnvelope, string>;
    artifacts!: Table<Artifact, string>;
    sessionLayouts!: Table<SessionLayout, [string, string]>; // [viewId, sessionId]

    constructor() {
        super('ResearchNavigatorSession');
        // v1 -> v2: add orderIndex to sessions for custom ordering
        this.version(1).stores({
            sessions: 'id, updatedAt',
            messages: 'id, sessionId, createdAt',
            events: 'id, ts, sessionId',
            artifacts: 'id, kind, version, createdAt'
        });
        this.version(2).stores({
            sessions: 'id, updatedAt, orderIndex',
            messages: 'id, sessionId, createdAt',
            events: 'id, ts, sessionId',
            artifacts: 'id, kind, version, createdAt'
        }).upgrade(tx => {
            // seed orderIndex based on updatedAt descending
            return (tx.table('sessions') as Table<ChatSession, string>)
                .orderBy('updatedAt').reverse().toArray()
                .then(list => Promise.all(list.map((s, idx) => (tx.table('sessions') as Table<ChatSession, string>).put({ ...s, orderIndex: idx }))));
        });
        // v2 -> v3: introduce sessionLayouts with fractional order keys
        this.version(3).stores({
            sessions: 'id, updatedAt, orderIndex',
            messages: 'id, sessionId, createdAt',
            events: 'id, ts, sessionId',
            artifacts: 'id, kind, version, createdAt',
            sessionLayouts: '[viewId+sessionId], viewId, orderKey'
        }).upgrade(async tx => {
            const DEFAULT_VIEW = 'default';
            const sessionsTable = tx.table('sessions') as Table<ChatSession, string>;
            const layoutsTable = tx.table('sessionLayouts') as Table<SessionLayout, [string, string]>;
            // order preference: orderIndex asc if present else updatedAt desc
            const sessions = await sessionsTable.toArray();
            const withOrder = sessions.some(s => typeof s.orderIndex === 'number');
            const ordered = withOrder
                ? sessions.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
                : sessions.sort((a, b) => b.updatedAt - a.updatedAt);
            // assign spaced fractional keys (simple base36 with gaps)
            const now = Date.now();
            for (let i = 0; i < ordered.length; i++) {
                const s = ordered[i];
                const key = `m${(i + 1).toString(36).padStart(4, '0')}`; // m0001, m0002...
                await layoutsTable.put({ viewId: DEFAULT_VIEW, sessionId: s.id, orderKey: key, updatedAt: now });
            }
        });
    }
}

export const sessionDb = new SessionDatabase();

// Simple fractional ranking utilities (base36 between)
const MIN_CH = '0'.charCodeAt(0);
const MAX_CH = 'z'.charCodeAt(0);
function normalizeKey(k?: string): string | undefined { return k && k.trim().length > 0 ? k : undefined; }
function nextKeyAfter(k: string): string {
    // Append the minimal char to create a key just after prefix
    return k + '0';
}
function keyBetween(a?: string, b?: string): string {
    const left = normalizeKey(a);
    const right = normalizeKey(b);
    if (!left && !right) return 'm0000';
    if (!left && right) return right > '0' ? String.fromCharCode(Math.max(MIN_CH, right.charCodeAt(0) - 1)) : '0' + right;
    if (left && !right) return nextKeyAfter(left);
    // Find midpoint lexicographically by extending shorter key
    const L = left!; const R = right!;
    let i = 0;
    while (true) {
        const lc = L.charCodeAt(i) || MIN_CH;
        const rc = R.charCodeAt(i) || MAX_CH;
        if (lc + 1 < rc) {
            const mid = Math.floor((lc + rc) / 2);
            return L.slice(0, i) + String.fromCharCode(mid);
        }
        if (lc === rc) { i++; continue; }
        // lc + 1 === rc → need to extend left prefix
        return L.slice(0, i + 1) + 'm';
    }
}
export const orderKeyUtils = {
    between: keyBetween,
    before: (b?: string) => keyBetween(undefined, b),
    after: (a?: string) => keyBetween(a, undefined)
};

export const sessionRepository = {
    async putSession(s: ChatSession) { await sessionDb.sessions.put(s); },
    async getSession(id: string) { return await sessionDb.sessions.get(id) ?? null; },
    async listSessions() {
        // fallback for callers not yet migrated
        const anyLayouts = await sessionDb.sessionLayouts.count().then(c => c > 0).catch(() => false);
        if (anyLayouts) {
            const layouts = await sessionDb.sessionLayouts.where('viewId').equals('default').sortBy('orderKey');
            const ids = layouts.map(l => l.sessionId);
            const map = new Map((await sessionDb.sessions.bulkGet(ids)).filter(Boolean).map(s => [s!.id, s!]));
            return ids.map(id => map.get(id)!).filter(Boolean);
        }
        // pre-v3 behavior
        const anyHasOrder = await sessionDb.sessions.where('orderIndex').aboveOrEqual(0).count().then(c => c > 0).catch(() => false);
        if (anyHasOrder) return await sessionDb.sessions.orderBy('orderIndex').toArray();
        return await sessionDb.sessions.orderBy('updatedAt').reverse().toArray();
    },
    async bulkPutSessions(s: ChatSession[]) { await sessionDb.sessions.bulkPut(s); },
    async deleteSession(id: string) { await sessionDb.sessions.delete(id); },

    // Layout APIs
    async listLayouts(viewId = 'default') {
        return await sessionDb.sessionLayouts.where('viewId').equals(viewId).sortBy('orderKey');
    },
    async putLayout(layout: SessionLayout) { await sessionDb.sessionLayouts.put(layout); },
    async bulkPutLayouts(layouts: SessionLayout[]) { await sessionDb.sessionLayouts.bulkPut(layouts); },
    async deleteLayout(viewId: string, sessionId: string) { await sessionDb.sessionLayouts.delete([viewId, sessionId]); },
    async ensureLayoutTop(viewId: string, sessionId: string) {
        const now = Date.now();
        const first = (await sessionDb.sessionLayouts.where('viewId').equals(viewId).sortBy('orderKey'))[0];
        const newKey = orderKeyUtils.before(first?.orderKey);
        const layout: SessionLayout = { viewId, sessionId, orderKey: newKey, updatedAt: now };
        await sessionDb.sessionLayouts.put(layout);
        return layout;
    },
    async reorderSessions(viewId: string, moves: Array<{ sessionId: string; beforeId?: string; afterId?: string }>) {
        const now = Date.now();
        const current = await sessionDb.sessionLayouts.where('viewId').equals(viewId).sortBy('orderKey');
        const idToKey = new Map(current.map(l => [l.sessionId, l.orderKey]));
        const order = current.map(l => l.sessionId);
        const getKey = (id?: string) => (id ? idToKey.get(id) : undefined);
        const applyMove = (id: string, beforeId?: string, afterId?: string) => {
            const fromIdx = order.indexOf(id);
            if (fromIdx >= 0) order.splice(fromIdx, 1);
            let toIdx = 0;
            if (beforeId) {
                toIdx = order.indexOf(beforeId);
                if (toIdx < 0) toIdx = 0;
            } else if (afterId) {
                toIdx = order.indexOf(afterId);
                if (toIdx < 0) toIdx = order.length;
                else toIdx = toIdx + 1;
            }
            order.splice(toIdx, 0, id);
            const leftId = order[toIdx - 1];
            const rightId = order[toIdx + 1];
            const newKey = orderKeyUtils.between(getKey(leftId), getKey(rightId));
            idToKey.set(id, newKey);
        };
        for (const m of moves) applyMove(m.sessionId, m.beforeId, m.afterId);
        const updated: SessionLayout[] = order.map(id => ({ viewId, sessionId: id, orderKey: idToKey.get(id)!, updatedAt: now }));
        await sessionDb.sessionLayouts.bulkPut(updated);
        return updated;
    },

    async putMessage(m: ChatMessage) { await sessionDb.messages.put(m); },
    async listMessages(sessionId: string) { return await sessionDb.messages.where({ sessionId }).sortBy('createdAt'); },
    async getMessage(id: string) { return await sessionDb.messages.get(id) ?? null; },

    async appendEvent(e: EventEnvelope) { await sessionDb.events.put(e); },
    async listEvents(sessionId?: string) {
        return sessionId ? await sessionDb.events.where({ sessionId }).sortBy('ts') : await sessionDb.events.orderBy('ts').toArray();
    },

    async putArtifact(a: Artifact) { await sessionDb.artifacts.put(a); },
    async getArtifact(id: string) { return await sessionDb.artifacts.get(id) ?? null; },
    async listArtifacts(kind?: string) { return kind ? await sessionDb.artifacts.where({ kind }).toArray() : await sessionDb.artifacts.toArray(); }
};


