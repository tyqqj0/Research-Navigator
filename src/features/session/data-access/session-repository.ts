// Dexie repository for Chat Sessions / Messages / Events / Artifacts (minimal)
import Dexie, { Table } from 'dexie';
import type { ChatMessage, ChatSession, EventEnvelope, Artifact, SessionLayout } from './types';
import { authStoreUtils } from '@/stores/auth.store';

class SessionDatabase extends Dexie {
    sessions!: Table<ChatSession, string>;
    messages!: Table<ChatMessage, string>;
    events!: Table<EventEnvelope, string>;
    artifacts!: Table<Artifact, string>;
    // v3 layout table (no userId in primary key)
    sessionLayouts!: Table<SessionLayout, [string, string]>; // [viewId, sessionId]
    // v4 layout table (scoped by user)
    sessionLayoutsV4!: Table<SessionLayout, [string, string, string]>; // [userId, viewId, sessionId]

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
                await layoutsTable.put({ viewId: DEFAULT_VIEW, sessionId: s.id, orderKey: key, updatedAt: now } as any);
            }
        });

        // v3 -> v4: add userId to all tables; add a new sessionLayoutsV4 table with user-scoped PK
        this.version(4).stores({
            sessions: 'id, userId, updatedAt, orderIndex, [userId+updatedAt], [userId+orderIndex]',
            messages: 'id, userId, sessionId, createdAt, [userId+sessionId], [userId+createdAt]',
            events: 'id, userId, ts, sessionId, [userId+sessionId], [userId+ts]',
            artifacts: 'id, userId, kind, version, createdAt, [userId+kind], [userId+createdAt]',
            // Note: We DO NOT change primary key of existing sessionLayouts table (Dexie limitation).
            // Introduce a new table instead and migrate data.
            sessionLayoutsV4: '[userId+viewId+sessionId], [userId+viewId], orderKey'
        }).upgrade(async (tx) => {
            // best-effort migration: attribute existing records to current user if available, otherwise 'anonymous'
            let uid = '';
            try { uid = authStoreUtils.getStoreInstance().getCurrentUserId() || 'anonymous'; } catch { uid = 'anonymous'; }
            try {
                const sessionsTable = tx.table('sessions') as Table<ChatSession, string>;
                await sessionsTable.toCollection().modify((s: any) => { if (!s.userId) s.userId = uid; });
            } catch { /* ignore */ }
            try {
                const messagesTable = tx.table('messages') as Table<ChatMessage, string>;
                await messagesTable.toCollection().modify((m: any) => { if (!m.userId) m.userId = uid; });
            } catch { /* ignore */ }
            try {
                const eventsTable = tx.table('events') as Table<EventEnvelope, string>;
                await eventsTable.toCollection().modify((e: any) => { if (!e.userId) e.userId = uid; });
            } catch { /* ignore */ }
            try {
                const artifactsTable = tx.table('artifacts') as Table<Artifact, string>;
                await artifactsTable.toCollection().modify((a: any) => { if (!a.userId) a.userId = uid; });
            } catch { /* ignore */ }
            try {
                // Migrate old sessionLayouts -> sessionLayoutsV4 with userId
                const oldLayouts = await (tx.table('sessionLayouts') as Table<any, any>).toArray();
                const newLayouts: SessionLayout[] = oldLayouts.map((l: any) => ({ userId: uid, viewId: l.viewId, sessionId: l.sessionId, orderKey: l.orderKey, updatedAt: l.updatedAt }));
                const layoutsTableV4 = tx.table('sessionLayoutsV4') as Table<SessionLayout, [string, string, string]>;
                if (newLayouts.length > 0) await layoutsTableV4.bulkPut(newLayouts);
            } catch { /* ignore */ }
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
    _requireUserId(): string {
        try { return authStoreUtils.getStoreInstance().requireAuth(); } catch { return 'anonymous'; }
    },
    async putSession(s: ChatSession) {
        const userId = this._requireUserId();
        await sessionDb.sessions.put({ ...s, userId });
    },
    async getSession(id: string) {
        const userId = this._requireUserId();
        const s = await sessionDb.sessions.get(id);
        return s && (s as any).userId === userId ? s : null;
    },
    async listSessions() {
        const userId = this._requireUserId();
        // Prefer new table if present
        const userLayoutsCountV4 = await (sessionDb as any).sessionLayoutsV4?.where('[userId+viewId]').equals([userId, 'default']).count().catch(() => 0);
        if (userLayoutsCountV4 && userLayoutsCountV4 > 0) {
            const layouts = await (sessionDb as any).sessionLayoutsV4.where('[userId+viewId]').equals([userId, 'default']).sortBy('orderKey');
            const ids = layouts.map((l: any) => l.sessionId);
            const list = (await sessionDb.sessions.bulkGet(ids)).filter(Boolean) as ChatSession[];
            const map = new Map(list.filter(s => (s as any).userId === userId).map(s => [s.id, s]));
            return ids.map((id: string) => map.get(id)!).filter(Boolean);
        }
        // fallback for callers not yet migrated (old table might exist)
        const userLayoutsCount = await (sessionDb as any).sessionLayouts?.where('[userId+viewId]').equals([userId, 'default']).count().catch(() => 0);
        if (userLayoutsCount > 0) {
            const layouts = await (sessionDb as any).sessionLayouts.where('[userId+viewId]').equals([userId, 'default']).sortBy('orderKey');
            const ids = layouts.map((l: any) => l.sessionId);
            const list = (await sessionDb.sessions.bulkGet(ids)).filter(Boolean) as ChatSession[];
            const map = new Map(list.filter(s => (s as any).userId === userId).map(s => [s.id, s]));
            return ids.map((id: string) => map.get(id)!).filter(Boolean);
        }
        // pre-v3 behavior
        const anyHasOrder = await sessionDb.sessions.where('orderIndex').aboveOrEqual(0).and((s: any) => s.userId === userId).count().then(c => c > 0).catch(() => false);
        if (anyHasOrder) return await (sessionDb.sessions as any).where('userId').equals(userId).sortBy('orderIndex');
        return await (sessionDb.sessions as any).where('userId').equals(userId).reverse().sortBy('updatedAt');
    },
    async bulkPutSessions(s: ChatSession[]) {
        const userId = this._requireUserId();
        await sessionDb.sessions.bulkPut(s.map(x => ({ ...x, userId })));
    },
    async deleteSession(id: string) {
        // Best-effort: ensure only current user's session is deleted
        const userId = this._requireUserId();
        const s = await sessionDb.sessions.get(id);
        if (s && (s as any).userId === userId) await sessionDb.sessions.delete(id);
    },

    // Layout APIs
    async listLayouts(viewId = 'default') {
        const userId = this._requireUserId();
        const dbAny = sessionDb as any;
        if (dbAny.sessionLayoutsV4) {
            return await dbAny.sessionLayoutsV4.where('[userId+viewId]').equals([userId, viewId]).sortBy('orderKey');
        }
        // Legacy (v3): no userId column — filter by viewId
        return await dbAny.sessionLayouts.where('viewId').equals(viewId).sortBy('orderKey');
    },
    async putLayout(layout: SessionLayout) {
        const dbAny = sessionDb as any;
        const payload = { ...layout, userId: this._requireUserId() } as any;
        if (dbAny.sessionLayoutsV4) return await dbAny.sessionLayoutsV4.put(payload);
        return await dbAny.sessionLayouts.put(payload);
    },
    async bulkPutLayouts(layouts: SessionLayout[]) {
        const dbAny = sessionDb as any;
        const userId = this._requireUserId();
        const items = layouts.map(l => ({ ...l, userId } as any));
        if (dbAny.sessionLayoutsV4) return await dbAny.sessionLayoutsV4.bulkPut(items);
        return await dbAny.sessionLayouts.bulkPut(items);
    },
    async deleteLayout(viewId: string, sessionId: string) {
        const dbAny = sessionDb as any;
        if (dbAny.sessionLayoutsV4) return await dbAny.sessionLayoutsV4.delete([this._requireUserId(), viewId, sessionId]);
        return await dbAny.sessionLayouts.delete([this._requireUserId(), viewId, sessionId]);
    },
    async ensureLayoutTop(viewId: string, sessionId: string) {
        const userId = this._requireUserId();
        const now = Date.now();
        const dbAny = sessionDb as any;
        let first: any | undefined;
        if (dbAny.sessionLayoutsV4) {
            first = (await dbAny.sessionLayoutsV4.where('[userId+viewId]').equals([userId, viewId]).sortBy('orderKey'))[0];
        } else {
            first = (await dbAny.sessionLayouts.where('viewId').equals(viewId).sortBy('orderKey'))[0];
        }
        const newKey = orderKeyUtils.before(first?.orderKey);
        const layout: SessionLayout = { userId, viewId, sessionId, orderKey: newKey, updatedAt: now } as any;
        if (dbAny.sessionLayoutsV4) await dbAny.sessionLayoutsV4.put(layout as any); else await dbAny.sessionLayouts.put(layout as any);
        return layout;
    },
    async reorderSessions(viewId: string, moves: Array<{ sessionId: string; beforeId?: string; afterId?: string }>) {
        const userId = this._requireUserId();
        const now = Date.now();
        const dbAny = sessionDb as any;
        const current = dbAny.sessionLayoutsV4
            ? await dbAny.sessionLayoutsV4.where('[userId+viewId]').equals([userId, viewId]).sortBy('orderKey')
            : await dbAny.sessionLayouts.where('viewId').equals(viewId).sortBy('orderKey');
        const idToKey: Map<string, string> = new Map<string, string>(current.map((l: any) => [String(l.sessionId), String(l.orderKey)]));
        const order: string[] = current.map((l: any) => String(l.sessionId));
        const getKey = (id?: string): string | undefined => (id ? idToKey.get(id) : undefined);
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
        const updated: SessionLayout[] = order.map((id: string) => ({ userId, viewId, sessionId: id, orderKey: idToKey.get(id)!, updatedAt: now } as any));
        if (dbAny.sessionLayoutsV4) await dbAny.sessionLayoutsV4.bulkPut(updated as any); else await dbAny.sessionLayouts.bulkPut(updated as any);
        return updated;
    },

    async putMessage(m: ChatMessage) { await sessionDb.messages.put({ ...m, userId: this._requireUserId() } as any); },
    async listMessages(sessionId: string) { return await (sessionDb.messages as any).where('[userId+sessionId]').equals([this._requireUserId(), sessionId]).sortBy('createdAt'); },
    async getMessage(id: string) { const userId = this._requireUserId(); const m: any = await sessionDb.messages.get(id); return m && m.userId === userId ? m : null; },

    async appendEvent(e: EventEnvelope) { await sessionDb.events.put({ ...e, userId: this._requireUserId() } as any); },
    async listEvents(sessionId?: string) {
        const userId = this._requireUserId();
        return sessionId
            ? await (sessionDb.events as any).where('[userId+sessionId]').equals([userId, sessionId]).sortBy('ts')
            : await (sessionDb.events as any).where('userId').equals(userId).sortBy('ts');
    },

    async putArtifact(a: Artifact) { await sessionDb.artifacts.put({ ...a, userId: this._requireUserId() } as any); },
    async getArtifact(id: string) { const userId = this._requireUserId(); const a: any = await sessionDb.artifacts.get(id); return a && a.userId === userId ? a : null; },
    async listArtifacts(kind?: string) {
        const userId = this._requireUserId();
        return kind
            ? await (sessionDb.artifacts as any).where('[userId+kind]').equals([userId, kind]).toArray()
            : await (sessionDb.artifacts as any).where('userId').equals(userId).toArray();
    },

    // Convenience: report artifacts
    async listReports() { return await (sessionDb.artifacts as any).where('[userId+kind]').equals([this._requireUserId(), 'report_final']).reverse().sortBy('createdAt'); },
    async searchReports(params: { query?: string; limit?: number }) {
        const userId = this._requireUserId();
        const { query, limit } = params || ({} as any);
        const list: any[] = await (sessionDb.artifacts as any).where('[userId+kind]').equals([userId, 'report_final']).reverse().sortBy('createdAt');
        if (!query || !query.trim()) return typeof limit === 'number' ? list.slice(0, Math.max(0, limit)) : list;
        const q = query.trim().toLowerCase();
        const filtered = list.filter(a => {
            const title = String((a.meta as any)?.title || '').toLowerCase();
            if (title.includes(q)) return true;
            // fallback: search a short prefix of data
            const head = String(a.data || '').slice(0, 512).toLowerCase();
            return head.includes(q);
        });
        return typeof limit === 'number' ? filtered.slice(0, Math.max(0, limit)) : filtered;
    }
};

// Public type for dependency injection via ArchiveServices
export type SessionRepository = typeof sessionRepository;


