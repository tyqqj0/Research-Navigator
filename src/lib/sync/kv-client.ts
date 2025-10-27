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


export class HttpKVClient implements VersionedKVClient {
    private baseUrl: string;
    private headers: Record<string, string>;
    constructor(baseUrl: string, headers?: Record<string, string>) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.headers = headers || {};
    }
    private urlFor(key: string): string {
        const encoded = encodeURIComponent(key);
        return `${this.baseUrl}/kv/${encoded}`;
    }
    async load<T>(key: string, ifNoneMatchRevision?: string): Promise<VersionedValue<T> | 304> {
        const res = await fetch(this.urlFor(key), {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                ...(ifNoneMatchRevision ? { 'If-None-Match': ifNoneMatchRevision } : {}),
                ...this.headers,
            }
        });
        if (res.status === 304) return 304;
        if (!res.ok) {
            const err: any = new Error(`KV load failed: ${res.status}`);
            err.status = res.status;
            throw err;
        }
        const etag = res.headers.get('ETag') || res.headers.get('Etag') || res.headers.get('etag') || undefined;
        const body = await res.json().catch(() => ({}));
        const value = (body && typeof body === 'object' && 'value' in body) ? (body as any).value as T : (body as T);
        return { value, revision: etag || `${Date.now()}` } as VersionedValue<T>;
    }
    async save<T>(key: string, value: T, ifMatchRevision?: string): Promise<VersionedValue<T>> {
        const res = await fetch(this.urlFor(key), {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...(ifMatchRevision ? { 'If-Match': ifMatchRevision } : {}),
                ...this.headers,
            },
            body: JSON.stringify({ value })
        });
        if (res.status === 412) {
            const etag = res.headers.get('ETag') || undefined;
            const remoteBody = await res.json().catch(() => ({}));
            const err: any = new Error('Precondition Failed');
            err.status = 412;
            err.revision = etag;
            err.remote = remoteBody;
            throw err;
        }
        if (!res.ok) {
            const err: any = new Error(`KV save failed: ${res.status}`);
            err.status = res.status;
            throw err;
        }
        const etag = res.headers.get('ETag') || res.headers.get('Etag') || res.headers.get('etag') || undefined;
        const body = await res.json().catch(() => ({}));
        const retValue = (body && typeof body === 'object' && 'value' in body) ? (body as any).value as T : value;
        return { value: retValue, revision: etag || `${Date.now()}` } as VersionedValue<T>;
    }
}


