/**
 * Placeholder data client wrapper (env-gated); plugs in later when backend snapshot is ready.
 */

import { getAuthHeaders } from './oauth-bridge';

export interface HttpOptions {
    headers?: Record<string, string>;
    getFullResponse?: boolean;
}

async function request(method: string, url: string, body?: any, options?: HttpOptions): Promise<any> {
    const headers = {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
        ...(options?.headers || {}),
    } as Record<string, string>;
    const res = await fetch(url, {
        method,
        headers,
        body: body != null ? JSON.stringify(body) : undefined,
        credentials: 'include',
    });
    if (options?.getFullResponse) {
        const data = await res.json().catch(() => null);
        return { status: res.status, headers: res.headers, ok: res.ok, data };
    }
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Request failed: ${res.status}`);
    }
    return res.json().catch(() => null);
}

export const dataClient = {
    get: (url: string, options?: HttpOptions) => request('GET', url, undefined, options),
    put: (url: string, body?: any, options?: HttpOptions) => request('PUT', url, body, options),
    post: (url: string, body?: any, options?: HttpOptions) => request('POST', url, body, options),
    delete: (url: string, options?: HttpOptions) => request('DELETE', url, undefined, options),
};

export type DataClient = typeof dataClient;


