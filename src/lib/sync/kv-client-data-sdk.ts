import type { VersionedKVClient, VersionedValue } from './kv-client';
import { dataClient } from '@/lib/autolabz/data-client';

/**
 * DataSDKKVClient: a thin adapter over our data client aligned to DataSDK routes.
 * Note: To avoid CORS preflight issues for now, we DO NOT send If-None-Match/If-Match.
 * We still read ETag from responses as the revision token.
 */
export class DataSDKKVClient implements VersionedKVClient {
    private baseUrl: string;
    constructor(baseUrl: string) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
    }
    private urlFor(key: string): string {
        const encoded = encodeURIComponent(key);
        // DataSDK Versioned KV API
        return `${this.baseUrl}/v1/data-rev/${encoded}`;
    }
    async load<T>(key: string, _ifNoneMatchRevision?: string): Promise<VersionedValue<T> | 304> {
        const res = await dataClient.get(this.urlFor(key), { getFullResponse: true });
        if (!res || typeof res.status !== 'number') {
            throw new Error('Invalid response');
        }
        if (res.status === 304) return 304;
        if (!res.ok) {
            const err: any = new Error(`KV load failed: ${res.status}`);
            err.status = res.status;
            throw err;
        }
        const etag = res.headers?.get?.('ETag') || res.headers?.get?.('Etag') || res.headers?.get?.('etag') || undefined;
        const body = res.data;
        const value = (body && typeof body === 'object' && 'value' in body) ? (body as any).value as T : (body as T);
        return { value, revision: etag || `${Date.now()}` } as VersionedValue<T>;
    }
    async save<T>(key: string, value: T, _ifMatchRevision?: string): Promise<VersionedValue<T>> {
        const res = await dataClient.put(this.urlFor(key), { value }, { getFullResponse: true });
        if (!res || typeof res.status !== 'number') {
            throw new Error('Invalid response');
        }
        if (!res.ok) {
            const err: any = new Error(`KV save failed: ${res.status}`);
            err.status = res.status;
            throw err;
        }
        const etag = res.headers?.get?.('ETag') || res.headers?.get?.('Etag') || res.headers?.get?.('etag') || undefined;
        const body = res.data;
        const retValue = (body && typeof body === 'object' && 'value' in body) ? (body as any).value as T : value;
        return { value: retValue, revision: etag || `${Date.now()}` } as VersionedValue<T>;
    }
}


