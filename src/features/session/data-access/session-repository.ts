// Dexie repository for Chat Sessions / Messages / Events / Artifacts (minimal)
import Dexie, { Table } from 'dexie';
import type { ChatMessage, ChatSession, EventEnvelope, Artifact, SessionLayout } from './types';
import { authStoreUtils } from '@/stores/auth.store';
import { notifyLocalSessionWrite } from '@/lib/sync/sync-events';

class SessionDatabase extends Dexie {
    sessions!: Table<ChatSession, string>;
    messages!: Table<ChatMessage, string>;
    events!: Table<EventEnvelope, string>;
    artifacts!: Table<Artifact, string>;
    // sync meta table (per-archive)
    syncMeta!: Table<SyncMeta, string>;
    // v3 layout table (no userId in primary key)
    sessionLayouts!: Table<SessionLayout, [string, string]>; // [viewId, sessionId]
    // v4 layout table (scoped by user)
    sessionLayoutsV4!: Table<SessionLayout, [string, string, string]>; // [userId, viewId, sessionId]

    constructor(dbName: string = 'ResearchNavigatorSession') {
        super(dbName);
        try { console.debug('[repo][session][db_init]', { dbName }); } catch { /* noop */ }
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
            try { console.debug('[repo][session][migrate_v4][start]', { dbName: this.name, userId: uid }); } catch { /* noop */ }
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
            try { console.debug('[repo][session][migrate_v4][done]', { dbName: this.name, userId: uid }); } catch { /* noop */ }
        });

        // v4 -> v5: add syncMeta table for versioned KV revisions & dirty flags
        this.version(5).stores({
            syncMeta: 'key'
        });
    }

    public async ensureOpen(): Promise<void> {
        try {
            const anyDb: any = this as any;
            const isOpen = typeof anyDb?.isOpen === 'function' ? anyDb.isOpen() : true;
            if (!isOpen && typeof anyDb?.open === 'function') {
                await anyDb.open();
            }
        } catch { /* noop */ }
    }

    public async withDexieRetry<T>(op: () => Promise<T>, attempts = 2): Promise<T> {
        let lastErr: unknown = null;
        for (let i = 0; i < Math.max(1, attempts); i++) {
            try {
                await this.ensureOpen();
                return await op();
            } catch (e: any) {
                lastErr = e;
                const msg = String(e?.message || e || '');
                const transient = msg.includes('Database has been closed') || msg.includes('DatabaseClosedError') || msg.includes('InvalidState') || msg.includes('VersionChangeError');
                try { console.warn('[repo][dexie][retry]', { dbName: this.name, attempt: i + 1, transient, message: msg }); } catch { /* noop */ }
                if (!transient || i === attempts - 1) break;
                try { await new Promise(r => setTimeout(r, 40 + i * 40)); } catch { /* noop */ }
            }
        }
        throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
    }
}

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

export interface SyncMeta {
    key: string;
    localRevision?: string;
    remoteRevision?: string;
    lastPulledAt?: number;
    lastPushedAt?: number;
    dirty?: boolean;
    tombstone?: boolean;
}

export function createSessionRepository(archiveId: string) {
    const safeId = String(archiveId || 'anonymous').slice(0, 64);
    const dbName = `ResearchNavigatorSession__${safeId}`;
    const sessionDb = new SessionDatabase(dbName);
    try { console.debug('[repo][session][create]', { archiveId: safeId, dbName }); } catch { /* noop */ }
    const repo = {
        _requireUserId(): string {
            try { return authStoreUtils.getStoreInstance().requireAuth(); } catch { return 'anonymous'; }
        },
        async putSession(s: ChatSession) {
            const userId = this._requireUserId();
            // try { console.debug('[repo][session][putSession]', { dbName, userId, id: s.id, title: (s as any)?.title }); } catch { /* noop */ }
            await sessionDb.withDexieRetry(async () => {
                await sessionDb.sessions.put({ ...s, userId });
            });
            await this.markSyncDirty(`rn.v1.session.${s.id}`, true);
            try { notifyLocalSessionWrite({ sessionId: s.id, kind: 'session' }); } catch { /* noop */ }
        },
        async getSession(id: string) {
            const userId = this._requireUserId();
            try { console.debug('[repo][session][getSession]', { dbName, userId, id }); } catch { /* noop */ }
            const s = await sessionDb.withDexieRetry(async () => {
                return await sessionDb.sessions.get(id);
            });
            return s && (s as any).userId === userId ? s : null;
        },
        async listSessions() {
            const userId = this._requireUserId();

            if (!userId || userId === 'anonymous') {
                try { console.warn('[repo][session][listSessions][anonymous]', { note: 'returning empty due to anonymous gating' }); } catch { /* noop */ }
                return [] as ChatSession[];
            }
            // Prefer new table if present
            let userLayoutsCountV4 = 0;
            try {
                userLayoutsCountV4 = await sessionDb.withDexieRetry(async () => {
                    const dbAny: any = sessionDb as any;
                    if (!dbAny.sessionLayoutsV4) return 0;
                    return await dbAny.sessionLayoutsV4.where('[userId+viewId]').equals([userId, 'default']).count();
                });
            } catch { userLayoutsCountV4 = 0; }
            if (userLayoutsCountV4 && userLayoutsCountV4 > 0) {
                const layouts = await sessionDb.withDexieRetry(async () => {
                    return await (sessionDb as any).sessionLayoutsV4.where('[userId+viewId]').equals([userId, 'default']).sortBy('orderKey');
                });
                const ids = layouts.map((l: any) => l.sessionId);
                const list = await sessionDb.withDexieRetry(async () => {
                    return (await sessionDb.sessions.bulkGet(ids)).filter(Boolean) as ChatSession[];
                });
                const map = new Map(list.filter(s => (s as any).userId === userId).map(s => [s.id, s]));

                return ids.map((id: string) => map.get(id)!).filter(Boolean);
            }
            // fallback for callers not yet migrated (old table might exist)
            let userLayoutsCount = 0;
            try {
                userLayoutsCount = await sessionDb.withDexieRetry(async () => {
                    const dbAny: any = sessionDb as any;
                    if (!dbAny.sessionLayouts) return 0;
                    // v3 schema has primary key [viewId+sessionId]; there is no [userId+viewId] index
                    return await dbAny.sessionLayouts.where('viewId').equals('default').count();
                });
            } catch { userLayoutsCount = 0; }
            if (userLayoutsCount > 0) {
                const layouts = await sessionDb.withDexieRetry(async () => {
                    return await (sessionDb as any).sessionLayouts.where('viewId').equals('default').sortBy('orderKey');
                });
                const ids = layouts.map((l: any) => l.sessionId);
                const list = await sessionDb.withDexieRetry(async () => {
                    return (await sessionDb.sessions.bulkGet(ids)).filter(Boolean) as ChatSession[];
                });
                const map = new Map(list.filter(s => (s as any).userId === userId).map(s => [s.id, s]));
                try { console.debug('[repo][session][listSessions][by_layout_v3]', { count: list.length }); } catch { /* noop */ }
                return ids.map((id: string) => map.get(id)!).filter(Boolean);
            }
            // pre-v3 behavior
            const anyHasOrder = await sessionDb.withDexieRetry(async () => {
                return await sessionDb.sessions.where('orderIndex').aboveOrEqual(0).and((s: any) => s.userId === userId).count().then(c => c > 0).catch(() => false);
            });
            if (anyHasOrder) return await sessionDb.withDexieRetry(async () => {
                const res = await (sessionDb.sessions as any).where('userId').equals(userId).sortBy('orderIndex');
                try { console.debug('[repo][session][listSessions][by_orderIndex]', { count: res.length }); } catch { /* noop */ }
                return res;
            });
            return await sessionDb.withDexieRetry(async () => {
                const res = await (sessionDb.sessions as any).where('userId').equals(userId).reverse().sortBy('updatedAt');
                try { console.debug('[repo][session][listSessions][by_updatedAt]', { count: res.length }); } catch { /* noop */ }
                return res;
            });
        },
        async bulkPutSessions(s: ChatSession[]) {
            const userId = this._requireUserId();
            try { console.debug('[repo][session][bulkPutSessions]', { dbName, userId, count: s.length }); } catch { /* noop */ }
            await sessionDb.withDexieRetry(async () => {
                await sessionDb.sessions.bulkPut(s.map(x => ({ ...x, userId })));
            });
            for (const x of s) {
                await this.markSyncDirty(`rn.v1.session.${x.id}`, true);
            }
            try { for (const x of s) notifyLocalSessionWrite({ sessionId: x.id, kind: 'session' }); } catch { /* noop */ }
        },
        async deleteSession(id: string) {
            // Best-effort: ensure only current user's session is deleted
            const userId = this._requireUserId();
            try { console.debug('[repo][session][deleteSession]', { dbName, userId, id }); } catch { /* noop */ }
            await sessionDb.withDexieRetry(async () => {
                const s = await sessionDb.sessions.get(id);
                if (s && (s as any).userId === userId) await sessionDb.sessions.delete(id);
            });
            await this.markSyncDirty(`rn.v1.session.${id}`, true);
            try { notifyLocalSessionWrite({ sessionId: id, kind: 'delete' }); } catch { /* noop */ }
        },

        async deleteMessagesBySession(sessionId: string) {
            const userId = this._requireUserId();
            try { console.debug('[repo][session][deleteMessagesBySession]', { dbName, userId, sessionId }); } catch { /* noop */ }
            await sessionDb.withDexieRetry(async () => {
                const coll = (sessionDb.messages as any).where('[userId+sessionId]').equals([userId, sessionId]);
                try { await coll.delete(); } catch {
                    try {
                        const keys = await coll.primaryKeys();
                        if (Array.isArray(keys) && keys.length > 0) await sessionDb.messages.bulkDelete(keys as any);
                    } catch { /* ignore */ }
                }
            });
            await this.markSyncDirty(`rn.v1.session.${sessionId}`, true);
            try { notifyLocalSessionWrite({ sessionId, kind: 'message' }); } catch { /* noop */ }
        },

        async deleteEventsBySession(sessionId: string) {
            const userId = this._requireUserId();
            try { console.debug('[repo][session][deleteEventsBySession]', { dbName, userId, sessionId }); } catch { /* noop */ }
            await sessionDb.withDexieRetry(async () => {
                const coll = (sessionDb.events as any).where('[userId+sessionId]').equals([userId, sessionId]);
                try { await coll.delete(); } catch {
                    try {
                        const keys = await coll.primaryKeys();
                        if (Array.isArray(keys) && keys.length > 0) await sessionDb.events.bulkDelete(keys as any);
                    } catch { /* ignore */ }
                }
            });
            await this.markSyncDirty(`rn.v1.session.${sessionId}`, true);
            try { notifyLocalSessionWrite({ sessionId, kind: 'event' }); } catch { /* noop */ }
        },

        // Layout APIs
        async listLayouts(viewId = 'default') {
            const userId = this._requireUserId();
            const dbAny = sessionDb as any;
            if (dbAny.sessionLayoutsV4) {
                return await sessionDb.withDexieRetry(async () => {
                    return await dbAny.sessionLayoutsV4.where('[userId+viewId]').equals([userId, viewId]).sortBy('orderKey');
                });
            }
            return await sessionDb.withDexieRetry(async () => {
                return await dbAny.sessionLayouts.where('viewId').equals(viewId).sortBy('orderKey');
            });
        },
        async putLayout(layout: SessionLayout) {
            const dbAny = sessionDb as any;
            const payload = { ...layout, userId: this._requireUserId() } as any;
            try { console.debug('[repo][session][putLayout]', { dbName, viewId: layout.viewId, sessionId: layout.sessionId }); } catch { /* noop */ }
            if (dbAny.sessionLayoutsV4) {
                await sessionDb.withDexieRetry(async () => await dbAny.sessionLayoutsV4.put(payload));
            } else {
                await sessionDb.withDexieRetry(async () => await dbAny.sessionLayouts.put(payload));
            }
            await this.markSyncDirty(`rn.v1.session.${layout.sessionId}`, true);
            try { notifyLocalSessionWrite({ sessionId: layout.sessionId, kind: 'layout' }); } catch { /* noop */ }
        },
        async bulkPutLayouts(layouts: SessionLayout[]) {
            const dbAny = sessionDb as any;
            const userId = this._requireUserId();
            const items = layouts.map(l => ({ ...l, userId } as any));
            try { console.debug('[repo][session][bulkPutLayouts]', { dbName, count: items.length }); } catch { /* noop */ }
            if (dbAny.sessionLayoutsV4) {
                await sessionDb.withDexieRetry(async () => await dbAny.sessionLayoutsV4.bulkPut(items));
            } else {
                await sessionDb.withDexieRetry(async () => await dbAny.sessionLayouts.bulkPut(items));
            }
            for (const l of layouts) {
                await this.markSyncDirty(`rn.v1.session.${l.sessionId}`, true);
                try { notifyLocalSessionWrite({ sessionId: l.sessionId, kind: 'layout' }); } catch { /* noop */ }
            }
        },
        async deleteLayout(viewId: string, sessionId: string) {
            const dbAny = sessionDb as any;
            try { console.debug('[repo][session][deleteLayout]', { dbName, viewId, sessionId }); } catch { /* noop */ }
            if (dbAny.sessionLayoutsV4) {
                await sessionDb.withDexieRetry(async () => await dbAny.sessionLayoutsV4.delete([this._requireUserId(), viewId, sessionId]));
            } else {
                // v3 primary key is [viewId, sessionId]
                await sessionDb.withDexieRetry(async () => await dbAny.sessionLayouts.delete([viewId, sessionId]));
            }
            await this.markSyncDirty(`rn.v1.session.${sessionId}`, true);
            try { notifyLocalSessionWrite({ sessionId, kind: 'layout' }); } catch { /* noop */ }
        },
        async ensureLayoutTop(viewId: string, sessionId: string) {
            const userId = this._requireUserId();
            const now = Date.now();
            const dbAny = sessionDb as any;
            try { console.debug('[repo][session][ensureLayoutTop][begin]', { dbName, userId, viewId, sessionId }); } catch { /* noop */ }
            const layout = await sessionDb.withDexieRetry(async () => {
                let first: any | undefined;
                if (dbAny.sessionLayoutsV4) {
                    first = (await dbAny.sessionLayoutsV4.where('[userId+viewId]').equals([userId, viewId]).sortBy('orderKey'))[0];
                } else {
                    first = (await dbAny.sessionLayouts.where('viewId').equals(viewId).sortBy('orderKey'))[0];
                }
                const newKey = orderKeyUtils.before(first?.orderKey);
                const layout: SessionLayout = { userId, viewId, sessionId, orderKey: newKey, updatedAt: now } as any;
                if (dbAny.sessionLayoutsV4) await dbAny.sessionLayoutsV4.put(layout as any); else await dbAny.sessionLayouts.put(layout as any);
                try { console.debug('[repo][session][ensureLayoutTop][done]', { dbName, viewId, sessionId, orderKey: newKey }); } catch { /* noop */ }
                return layout;
            });
            await this.markSyncDirty(`rn.v1.session.${sessionId}`, true);
            try { notifyLocalSessionWrite({ sessionId, kind: 'layout' }); } catch { /* noop */ }
            return layout;
        },
        async reorderSessions(viewId: string, moves: Array<{ sessionId: string; beforeId?: string; afterId?: string }>) {
            const userId = this._requireUserId();
            const now = Date.now();
            const dbAny = sessionDb as any;
            try { console.debug('[repo][session][reorder][begin]', { dbName, userId, viewId, moves }); } catch { /* noop */ }
            const current = await sessionDb.withDexieRetry(async () => dbAny.sessionLayoutsV4
                ? await dbAny.sessionLayoutsV4.where('[userId+viewId]').equals([userId, viewId]).sortBy('orderKey')
                : await dbAny.sessionLayouts.where('viewId').equals(viewId).sortBy('orderKey'));
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
            await sessionDb.withDexieRetry(async () => {
                if (dbAny.sessionLayoutsV4) await dbAny.sessionLayoutsV4.bulkPut(updated as any); else await dbAny.sessionLayouts.bulkPut(updated as any);
            });
            try { console.debug('[repo][session][reorder][done]', { dbName, viewId, count: updated.length }); } catch { /* noop */ }
            for (const l of updated) {
                await this.markSyncDirty(`rn.v1.session.${l.sessionId}`, true);
                try { notifyLocalSessionWrite({ sessionId: l.sessionId, kind: 'layout' }); } catch { /* noop */ }
            }
            return updated;
        },

        async putMessage(m: ChatMessage) {
            await sessionDb.withDexieRetry(async () => { await sessionDb.messages.put({ ...m, userId: this._requireUserId() } as any); });
            await this.markSyncDirty(`rn.v1.session.${m.sessionId}`, true);
            try { notifyLocalSessionWrite({ sessionId: m.sessionId as any, kind: 'message' }); } catch { /* noop */ }
        },
        async listMessages(sessionId: string) { return await sessionDb.withDexieRetry(async () => (sessionDb.messages as any).where('[userId+sessionId]').equals([this._requireUserId(), sessionId]).sortBy('createdAt')); },
        async getMessage(id: string) { const userId = this._requireUserId(); const m: any = await sessionDb.withDexieRetry(async () => await sessionDb.messages.get(id)); return m && m.userId === userId ? m : null; },

        async appendEvent(e: EventEnvelope) {
            await sessionDb.withDexieRetry(async () => { await sessionDb.events.put({ ...e, userId: this._requireUserId() } as any); });
            if ((e as any)?.sessionId) {
                await this.markSyncDirty(`rn.v1.session.${(e as any).sessionId}`, true);
            }
            try { notifyLocalSessionWrite({ sessionId: e.sessionId as any, kind: 'event' }); } catch { /* noop */ }
        },
        async listEvents(sessionId?: string) {
            const userId = this._requireUserId();
            try { console.debug('[repo][session][listEvents]', { dbName, userId, sessionId: sessionId || null }); } catch { /* noop */ }
            return await sessionDb.withDexieRetry(async () => sessionId
                ? await (sessionDb.events as any).where('[userId+sessionId]').equals([userId, sessionId]).sortBy('ts')
                : await (sessionDb.events as any).where('userId').equals(userId).sortBy('ts'));
        },

        async putArtifact(a: Artifact) { await sessionDb.withDexieRetry(async () => { await sessionDb.artifacts.put({ ...a, userId: this._requireUserId() } as any); }); },
        async getArtifact(id: string) { const userId = this._requireUserId(); const a: any = await sessionDb.withDexieRetry(async () => await sessionDb.artifacts.get(id)); return a && a.userId === userId ? a : null; },
        async listArtifacts(kind?: string) {
            const userId = this._requireUserId();
            return await sessionDb.withDexieRetry(async () => kind
                ? await (sessionDb.artifacts as any).where('[userId+kind]').equals([userId, kind]).toArray()
                : await (sessionDb.artifacts as any).where('userId').equals(userId).toArray());
        },

        // Convenience: report artifacts
        async listReports() { return await sessionDb.withDexieRetry(async () => (sessionDb.artifacts as any).where('[userId+kind]').equals([this._requireUserId(), 'report_final']).reverse().sortBy('createdAt')); },
        async searchReports(params: { query?: string; limit?: number }) {
            const userId = this._requireUserId();
            const { query, limit } = params || ({} as any);
            const list: any[] = await sessionDb.withDexieRetry(async () => (sessionDb.artifacts as any).where('[userId+kind]').equals([userId, 'report_final']).reverse().sortBy('createdAt'));
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
        },
        // SyncMeta accessors (for DataSyncService)
        async getSyncMeta(key: string): Promise<SyncMeta | null> {
            return await sessionDb.withDexieRetry(async () => await sessionDb.syncMeta.get(key) || null);
        },
        async setSyncMeta(meta: SyncMeta): Promise<void> {
            await sessionDb.withDexieRetry(async () => { await sessionDb.syncMeta.put(meta); });
        },
        async markSyncDirty(key: string, dirty = true): Promise<void> {
            await sessionDb.withDexieRetry(async () => {
                const prev = (await sessionDb.syncMeta.get(key)) || ({ key } as SyncMeta);
                await sessionDb.syncMeta.put({ ...prev, key, dirty });
            });
        },
        async listSyncDirtyKeys(): Promise<string[]> {
            const all = await sessionDb.withDexieRetry(async () => await sessionDb.syncMeta.toArray());
            return all.filter(m => !!m.dirty).map(m => m.key);
        },
        async clearSyncMeta(key: string): Promise<void> {
            await sessionDb.withDexieRetry(async () => { await sessionDb.syncMeta.delete(key); });
        },
        close() { try { sessionDb.close(); } catch { /* ignore */ } }
    };
    return repo;
}

// Public type for dependency injection via ArchiveServices
export type SessionRepository = ReturnType<typeof createSessionRepository>;


