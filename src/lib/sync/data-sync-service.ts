import type { VersionedKVClient, VersionedValue } from './kv-client';
import type { SessionRepository } from '@/features/session/data-access/session-repository';
import { syncConfig } from '@/config/sync.config';
import { authStoreUtils } from '@/stores/auth.store';
import type { MembershipRepository } from '@/features/literature/data-access/repositories/membership-repository';
import type { CollectionRepository } from '@/features/literature/data-access/repositories/collection-repository';
import { userMetaRepository as defaultUserMetaRepo, UserMetaRepository } from '@/features/literature/data-access/repositories/user-meta-repository';

export type SessionIndex = {
    version: 1;
    sessions: Record<string, { revision?: string; updatedAt?: string; deleted?: boolean }>;
};

export interface DataSyncDeps {
    kv: VersionedKVClient;
    repo: SessionRepository;
    archiveId: string;
}

const KEY_INDEX = 'rn.v1.sessions.index';
const keyOfSession = (id: string) => `rn.v1.session.${id}`;

export class DataSyncService {
    private kv: VersionedKVClient;
    private repo: SessionRepository;
    private archiveId: string;

    constructor(deps: DataSyncDeps) {
        this.kv = deps.kv;
        this.repo = deps.repo;
        this.archiveId = deps.archiveId;
    }

    async pullIndexAndSessions(): Promise<void> {
        if (!syncConfig.enabled) return;
        let prevIndexRev = (await this.repo.getSyncMeta(KEY_INDEX))?.remoteRevision;
        let res: VersionedValue<SessionIndex> | 304;
        try {
            res = await this.kv.load<SessionIndex>(KEY_INDEX, prevIndexRev);
        } catch (e: any) {
            try { console.warn('[sync][pull][index_error]', { message: String(e?.message || e) }); } catch { /* noop */ }
            return;
        }
        if (res === 304) return; // no change
        const { value: index, revision } = res;
        const ids = Object.keys(index?.sessions || {});
        for (const id of ids) {
            const targetKey = keyOfSession(id);
            const prev = await this.repo.getSyncMeta(targetKey);
            const ifNone = prev?.remoteRevision;
            let sres: VersionedValue<any> | 304;
            try {
                sres = await this.kv.load<any>(targetKey, ifNone);
            } catch (e: any) {
                try { console.warn('[sync][pull][session_error]', { id, message: String(e?.message || e) }); } catch { /* noop */ }
                continue;
            }
            if (sres === 304) continue;
            const { value, revision: srev } = sres;
            // naive apply: overwrite for MVP (MergePolicy can be injected later)
            try {
                await this.repo.putSession(value);
                if (Array.isArray((value as any)?.messages)) {
                    // Best-effort: bulk not implemented; repo APIs handle per-session consistency
                    // In MVP, session payload includes messages, so no extra writes here.
                }
            } catch { /* ignore data apply errors */ }
            await this.repo.setSyncMeta({ key: targetKey, remoteRevision: srev, dirty: false, lastPulledAt: Date.now() });
        }
        await this.repo.setSyncMeta({ key: KEY_INDEX, remoteRevision: revision, lastPulledAt: Date.now() });
    }

    async pushDirtySessions(): Promise<void> {
        if (!syncConfig.enabled) return;
        // Collect dirty from syncMeta, but also allow future ChangeTracker integration
        const dirtyKeys = (await this.repo.listSyncDirtyKeys()).filter(k => k.startsWith('rn.v1.session.'));
        const ids = dirtyKeys.map(k => k.replace('rn.v1.session.', ''));
        // Limit concurrency
        const concurrency = Math.max(1, syncConfig.maxConcurrentSessionPushes);
        const queue = [...ids];
        const workers: Promise<void>[] = [];
        for (let i = 0; i < concurrency; i++) {
            workers.push((async () => {
                while (queue.length > 0) {
                    const id = queue.shift()!;
                    await this.pushSingleSession(id).catch(() => void 0);
                }
            })());
        }
        await Promise.all(workers);

        // Update index after pushing sessions
        await this.updateSessionsIndex(ids).catch(() => void 0);
    }

    private async pushSingleSession(sessionId: string): Promise<void> {
        const key = keyOfSession(sessionId);
        const meta = await this.repo.getSyncMeta(key);
        const ifMatch = meta?.localRevision || meta?.remoteRevision;
        const s = await this.repo.getSession(sessionId);
        if (!s) {
            // treat as delete tombstone in future versions
            await this.repo.markSyncDirty(key, false);
            return;
        }
        try {
            const saved = await this.kv.save(key, s as any, ifMatch);
            await this.repo.setSyncMeta({ key, localRevision: saved.revision, remoteRevision: saved.revision, dirty: false, lastPushedAt: Date.now() });
        } catch (e: any) {
            if (e?.status === 412) {
                // TODO: merge policy; MVP: prefer newer updatedAt
                try {
                    const remote: any = e.remote?.value ?? null;
                    const localNewer = remote && (s.updatedAt > (remote?.updatedAt || 0));
                    const pick = localNewer ? s : remote || s;
                    const retry = await this.kv.save(key, pick as any, e.revision || undefined);
                    await this.repo.setSyncMeta({ key, localRevision: retry.revision, remoteRevision: retry.revision, dirty: false, lastPushedAt: Date.now() });
                } catch (e2) {
                    try { console.warn('[sync][push][merge_failed]', { sessionId, message: String((e2 as any)?.message || e2) }); } catch { /* noop */ }
                }
            } else {
                try { console.warn('[sync][push][error]', { sessionId, message: String(e?.message || e) }); } catch { /* noop */ }
            }
        }
    }

    private async updateSessionsIndex(changedIds: string[]): Promise<void> {
        if (changedIds.length === 0) return;
        const prev = await this.repo.getSyncMeta(KEY_INDEX);
        const prevRev = prev?.remoteRevision;
        let index: SessionIndex = { version: 1, sessions: {} };
        try {
            const l = await this.kv.load<SessionIndex>(KEY_INDEX, undefined);
            if (l !== 304) index = l.value;
        } catch { /* ignore */ }
        const now = new Date().toISOString();
        for (const id of changedIds) {
            const s = await this.repo.getSession(id);
            index.sessions[id] = index.sessions[id] || {} as any;
            index.sessions[id].updatedAt = now;
            index.sessions[id].deleted = !s;
            // revision will be set by save response; we optimistically leave it as-is here
        }
        try {
            const saved = await this.kv.save(KEY_INDEX, index, prevRev);
            await this.repo.setSyncMeta({ key: KEY_INDEX, remoteRevision: saved.revision, lastPushedAt: Date.now() });
        } catch (e: any) {
            if (e?.status === 412) {
                // reload & merge once
                try {
                    const latest = await this.kv.load<SessionIndex>(KEY_INDEX, undefined);
                    if (latest !== 304) {
                        const merged = latest.value;
                        for (const id of changedIds) {
                            const s = await this.repo.getSession(id);
                            merged.sessions[id] = merged.sessions[id] || {} as any;
                            merged.sessions[id].updatedAt = new Date().toISOString();
                            merged.sessions[id].deleted = !s;
                        }
                        const retry = await this.kv.save(KEY_INDEX, merged, (latest as any).revision);
                        await this.repo.setSyncMeta({ key: KEY_INDEX, remoteRevision: retry.revision, lastPushedAt: Date.now() });
                    }
                } catch { /* ignore */ }
            }
        }
    }
}

// Generic multi-domain interface and two concrete domain sync services (literature and collections)
export interface DomainSyncService {
    pull(): Promise<void>;
    push(): Promise<void>;
}

// Literature domain service: membership + user metas (per-paper)
export class LiteratureSyncService implements DomainSyncService {
    private kv: VersionedKVClient;
    private repo: SessionRepository; // using repo.syncMeta for meta storage
    private membershipRepo: MembershipRepository;
    private userMetaRepo: UserMetaRepository;
    constructor(kv: VersionedKVClient, repo: SessionRepository, opts: { membershipRepo: MembershipRepository; userMetaRepo?: UserMetaRepository }) {
        this.kv = kv;
        this.repo = repo;
        this.membershipRepo = opts.membershipRepo;
        this.userMetaRepo = opts.userMetaRepo || defaultUserMetaRepo as any;
    }
    private readonly KEY_MEMBERSHIP = 'rn.v1.lit.membership';
    private readonly META_PREFIX = 'rn.v1.lit.meta.';
    private isMetaKey(k: string): boolean { return k.startsWith(this.META_PREFIX); }
    async pull(): Promise<void> {
        if (!syncConfig.enabled) return;
        // Pull membership blob
        try {
            const prev = await this.repo.getSyncMeta(this.KEY_MEMBERSHIP);
            const l = await this.kv.load<any>(this.KEY_MEMBERSHIP, prev?.remoteRevision);
            if (l !== 304) {
                // Application of membership is deferred to upper services for now (MVP leaves as meta only)
                await this.repo.setSyncMeta({ key: this.KEY_MEMBERSHIP, remoteRevision: l.revision, dirty: false, lastPulledAt: Date.now() });
            }
        } catch { /* noop */ }
        // Pull metas via listing is not supported in MVP without an index; skip for now
    }
    async push(): Promise<void> {
        if (!syncConfig.enabled) return;
        const dirty = await this.repo.listSyncDirtyKeys();
        // Push membership blob if dirty
        if (dirty.includes(this.KEY_MEMBERSHIP)) {
            try {
                const meta = await this.repo.getSyncMeta(this.KEY_MEMBERSHIP);
                const userId = authStoreUtils.getStoreInstance().getCurrentUserId() || 'anonymous';
                const memberships = await this.membershipRepo.listByUser(userId);
                const paperIds = Array.from(new Set(memberships.map(m => m.paperId)));
                const local: any = { userId, paperIds, updatedAt: new Date().toISOString() };
                const saved = await this.kv.save(this.KEY_MEMBERSHIP, local, meta?.remoteRevision || meta?.localRevision);
                await this.repo.setSyncMeta({ key: this.KEY_MEMBERSHIP, localRevision: saved.revision, remoteRevision: saved.revision, dirty: false, lastPushedAt: Date.now() });
            } catch (e: any) {
                // on 412, skip for MVP
            }
        }
        // Push individual metas
        const metaKeys = dirty.filter(k => this.isMetaKey(k));
        for (const k of metaKeys) {
            try {
                const meta = await this.repo.getSyncMeta(k);
                const userId = authStoreUtils.getStoreInstance().getCurrentUserId() || 'anonymous';
                const paperId = k.replace(this.META_PREFIX, '');
                const metaObj = await this.userMetaRepo.findByUserAndLiterature(userId, paperId);
                const payload: any = metaObj ? {
                    id: metaObj.id,
                    userId: metaObj.userId,
                    paperId: metaObj.paperId,
                    tags: metaObj.tags,
                    readingStatus: metaObj.readingStatus,
                    rating: metaObj.rating,
                    priority: metaObj.priority,
                    customFields: metaObj.customFields,
                    personalNotes: (metaObj as any).personalNotes,
                    readingProgress: (metaObj as any).readingProgress,
                    updatedAt: metaObj.updatedAt,
                } : { userId, paperId, deleted: true, updatedAt: new Date().toISOString() };
                const saved = await this.kv.save(k, payload, meta?.remoteRevision || meta?.localRevision);
                await this.repo.setSyncMeta({ key: k, localRevision: saved.revision, remoteRevision: saved.revision, dirty: false, lastPushedAt: Date.now() });
            } catch (e: any) {
                // ignore errors for MVP
            }
        }
    }
}

// Collections domain service: index + items
export class CollectionsSyncService implements DomainSyncService {
    private kv: VersionedKVClient;
    private repo: SessionRepository; // using repo.syncMeta for meta storage
    private collectionsRepo: CollectionRepository;
    constructor(kv: VersionedKVClient, repo: SessionRepository, opts: { collectionsRepo: CollectionRepository }) {
        this.kv = kv;
        this.repo = repo;
        this.collectionsRepo = opts.collectionsRepo;
    }
    private readonly INDEX_KEY = 'rn.v1.collections.index';
    private readonly ITEM_PREFIX = 'rn.v1.collection.';
    private isItemKey(k: string) { return k.startsWith(this.ITEM_PREFIX); }
    async pull(): Promise<void> {
        if (!syncConfig.enabled) return;
        try {
            const prev = await this.repo.getSyncMeta(this.INDEX_KEY);
            const res = await this.kv.load<any>(this.INDEX_KEY, prev?.remoteRevision);
            if (res !== 304) {
                await this.repo.setSyncMeta({ key: this.INDEX_KEY, remoteRevision: res.revision, dirty: false, lastPulledAt: Date.now() });
            }
        } catch { /* noop */ }
        // Per-item pulls would require enumerating IDs; MVP defers
    }
    async push(): Promise<void> {
        if (!syncConfig.enabled) return;
        const dirty = await this.repo.listSyncDirtyKeys();
        const itemKeys = dirty.filter(k => this.isItemKey(k));
        for (const k of itemKeys) {
            try {
                const meta = await this.repo.getSyncMeta(k);
                const id = k.replace(this.ITEM_PREFIX, '');
                const c = await this.collectionsRepo.findById(id);
                const payload: any = c ? {
                    id: c.id,
                    ownerUid: c.ownerUid,
                    name: c.name,
                    description: c.description,
                    type: c.type,
                    isPublic: c.isPublic,
                    parentId: c.parentId,
                    paperIds: c.paperIds,
                    itemCount: c.itemCount,
                    isArchived: c.isArchived,
                    createdAt: c.createdAt,
                    updatedAt: c.updatedAt,
                    lastItemAddedAt: c.lastItemAddedAt,
                } : { id, deleted: true, updatedAt: new Date().toISOString() };
                const saved = await this.kv.save(k, payload, meta?.remoteRevision || meta?.localRevision);
                await this.repo.setSyncMeta({ key: k, localRevision: saved.revision, remoteRevision: saved.revision, dirty: false, lastPushedAt: Date.now() });
            } catch { /* noop */ }
        }
        // Update collections index after items
        if (itemKeys.length > 0) {
            try {
                const prev = await this.repo.getSyncMeta(this.INDEX_KEY);
                const items: Record<string, { updatedAt?: string; deleted?: boolean }> = {};
                for (const k of itemKeys) {
                    const id = k.replace(this.ITEM_PREFIX, '');
                    const c = await this.collectionsRepo.findById(id);
                    items[id] = { updatedAt: new Date((c?.updatedAt || new Date()) as any).toISOString(), deleted: !c } as any;
                }
                const index: any = { version: 1, items };
                const saved = await this.kv.save(this.INDEX_KEY, index, prev?.remoteRevision || prev?.localRevision);
                await this.repo.setSyncMeta({ key: this.INDEX_KEY, remoteRevision: saved.revision, lastPushedAt: Date.now() });
            } catch { /* noop */ }
        }
    }
}



