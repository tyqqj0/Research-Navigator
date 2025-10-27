export interface VersionedValue<T> {
    value: T;
    revision: string;
}

export interface VersionedKVClient {
    load<T = unknown>(key: string, ifNoneMatchRevision?: string): Promise<VersionedValue<T> | 304>;
    save<T = unknown>(key: string, value: T, ifMatchRevision?: string): Promise<VersionedValue<T>>;
}

/**
 * A no-op in-memory KV client for development or when remote sync is disabled.
 * It does not persist across reloads and treats all keys as missing initially.
 */
export class NoopKVClient implements VersionedKVClient {
    private map = new Map<string, VersionedValue<any>>();

    async load<T>(key: string, ifNoneMatchRevision?: string): Promise<VersionedValue<T> | 304> {
        const entry = this.map.get(key);
        if (!entry) return 304;
        if (ifNoneMatchRevision && entry.revision === ifNoneMatchRevision) return 304;
        return { value: entry.value as T, revision: entry.revision };
    }

    async save<T>(key: string, value: T, ifMatchRevision?: string): Promise<VersionedValue<T>> {
        const existing = this.map.get(key);
        if (existing && ifMatchRevision && existing.revision !== ifMatchRevision) {
            const err: any = new Error('Precondition Failed');
            err.status = 412;
            err.revision = existing.revision;
            err.remote = existing;
            throw err;
        }
        const revision = `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const vv = { value, revision } as VersionedValue<T>;
        this.map.set(key, vv as any);
        return vv;
    }
}


