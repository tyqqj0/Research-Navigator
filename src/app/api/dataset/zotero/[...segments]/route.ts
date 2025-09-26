import { NextResponse } from 'next/server';

async function resolveUserId(apiKey: string): Promise<number> {
    const res = await fetch(`https://api.zotero.org/keys/${encodeURIComponent(apiKey)}`, {
        headers: { 'Zotero-API-Key': apiKey }
    });
    if (!res.ok) {
        throw new Error(`Failed to resolve user id: HTTP ${res.status}`);
    }
    const data = await res.json();
    const userId = (data?.userID ?? data?.userId ?? data?.user?.id);
    if (!userId) throw new Error('Zotero key not associated with a user');
    return Number(userId);
}

function buildUpstreamUrl(basePath: string, search: URLSearchParams): string {
    const usp = new URLSearchParams(search);
    return `https://api.zotero.org${basePath}${usp.toString() ? `?${usp.toString()}` : ''}`;
}

async function proxyZotero(request: Request, pathBuilder: (userId: number, search: URLSearchParams) => Promise<string> | string) {
    const apiKey = request.headers.get('Zotero-API-Key') || process.env.NEXT_PUBLIC_DATASET_API_KEY || '';
    if (!apiKey) {
        return NextResponse.json({ error: 'Missing Zotero API key' }, { status: 400 });
    }
    const url = new URL(request.url);
    const search = new URLSearchParams(url.search);

    try {
        const userId = await resolveUserId(apiKey);
        const upstreamPath = await pathBuilder(userId, search);
        const upstreamUrl = buildUpstreamUrl(upstreamPath, search);
        const res = await fetch(upstreamUrl, { headers: { 'Zotero-API-Key': apiKey } });
        const text = await res.text();
        return new NextResponse(text, {
            status: res.status,
            headers: {
                'Content-Type': res.headers.get('Content-Type') || 'application/json'
            }
        });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Zotero proxy error' }, { status: 500 });
    }
}

export async function GET(request: Request, context: { params: Promise<{ segments?: string[] }> }) {
    const { segments = [] } = await context.params;

    // /api/dataset/zotero/test?limit=1
    if (segments.length === 1 && segments[0] === 'test') {
        return proxyZotero(request, (userId, search) => {
            if (!search.get('limit')) search.set('limit', '1');
            if (!search.get('format')) search.set('format', 'json');
            return `/users/${userId}/items`;
        });
    }

    // /api/dataset/zotero/groups -> list groups with minimal fields
    if (segments.length === 1 && segments[0] === 'groups') {
        return proxyZotero(request, (userId, search) => {
            if (!search.get('format')) search.set('format', 'json');
            return `/users/${userId}/groups`;
        });
    }

    // /api/dataset/zotero/collections[?group={groupId}] supports pagination: start, limit
    if (segments.length === 1 && segments[0] === 'collections') {
        return proxyZotero(request, (userId, search) => {
            const groupId = search.get('group');
            if (groupId) return `/groups/${encodeURIComponent(groupId)}/collections`;
            return `/users/${userId}/collections`;
        });
    }

    // /api/dataset/zotero/items/top?start=0&limit=25[&collection=xxx][&group={groupId}]
    if (segments.length === 2 && segments[0] === 'items' && segments[1] === 'top') {
        return proxyZotero(request, (userId, search) => {
            if (!search.get('format')) search.set('format', 'json');
            const groupId = search.get('group');
            const collection = search.get('collection');
            if (groupId) {
                if (collection && collection !== 'root') {
                    return `/groups/${encodeURIComponent(groupId)}/collections/${encodeURIComponent(collection)}/items/top`;
                }
                return `/groups/${encodeURIComponent(groupId)}/items/top`;
            } else {
                if (collection && collection !== 'root') {
                    return `/users/${userId}/collections/${encodeURIComponent(collection)}/items/top`;
                }
                return `/users/${userId}/items/top`;
            }
        });
    }

    // /api/dataset/zotero/items/{id}/children?itemType=note[&group={groupId}]
    if (segments.length === 3 && segments[0] === 'items' && segments[2] === 'children') {
        const itemId = segments[1];
        return proxyZotero(request, (userId, search) => {
            if (!search.get('itemType')) search.set('itemType', 'note');
            const groupId = search.get('group');
            if (groupId) {
                return `/groups/${encodeURIComponent(groupId)}/items/${encodeURIComponent(itemId)}/children`;
            }
            return `/users/${userId}/items/${encodeURIComponent(itemId)}/children`;
        });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204 });
}


