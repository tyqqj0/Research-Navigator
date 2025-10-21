/**
 * Placeholder points client wrapper; to be wired when points backend is available.
 */

import { getAuthHeaders } from './oauth-bridge';

export interface HttpOptions {
    headers?: Record<string, string>;
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
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Request failed: ${res.status}`);
    }
    return res.json().catch(() => null);
}

export const pointsClient = {
    get: (url: string, options?: HttpOptions) => request('GET', url, undefined, options),
    post: (url: string, body?: any, options?: HttpOptions) => request('POST', url, body, options),
};

export type PointsClient = typeof pointsClient;


