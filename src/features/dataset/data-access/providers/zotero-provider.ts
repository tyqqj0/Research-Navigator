import type { IDatasetAdapter } from '../dataset-adapter';
import type { DatasetAuthConfig, DatasetNode, DatasetPaperItem, DatasetNoteItem } from '../dataset-types';

const API_PREFIX = '/api/dataset/zotero';

function buildHeaders(cfg: DatasetAuthConfig): HeadersInit {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (cfg.apiKey) headers['Zotero-API-Key'] = cfg.apiKey;
    return headers;
}

export class ZoteroDatasetProvider implements IDatasetAdapter {
    private cfg: DatasetAuthConfig | null = null;

    async connect(cfg: DatasetAuthConfig): Promise<{ ok: boolean; message?: string }> {
        this.cfg = cfg;
        try {
            const res = await fetch(`${API_PREFIX}/test?limit=1&format=json`, { headers: buildHeaders(cfg) });
            if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
            return { ok: true };
        } catch (err: any) {
            return { ok: false, message: err?.message || 'connect error' };
        }
    }

    async listNodes(): Promise<DatasetNode[]> {
        // Build roots automatically: include user and all accessible group libraries.
        const cfg = this.requireCfg();
        const headers = buildHeaders(cfg);
        const nodes: DatasetNode[] = [];

        type Root = { kind: 'user' } | { kind: 'group'; id: string; name?: string };
        const roots: Root[] = [{ kind: 'user' }];
        try {
            const groupRes = await fetch(`${API_PREFIX}/groups`, { headers });
            if (groupRes.ok) {
                const groups = await groupRes.json();
                for (const g of groups || []) {
                    const id = String(g?.id ?? g?.data?.id ?? g?.groupID ?? g?.groupId ?? '');
                    if (!id) continue;
                    roots.push({ kind: 'group', id, name: g?.name || g?.data?.name });
                }
            }
        } catch {
            // ignore group fetch errors; still allow personal library
        }

        // Helper to push a collection as a node
        function pushCollection(ownerKey: string, c: any) {
            const key = c?.key || c?.data?.key || c?.data?.id || c?.id;
            const name = c?.name || c?.data?.name || 'Collection';
            const parentKey = c?.parentCollection || c?.data?.parentCollection || null;
            nodes.push({
                id: `${ownerKey}:col:${String(key)}`,
                name: String(name),
                kind: 'collection',
                parentId: parentKey ? `${ownerKey}:col:${String(parentKey)}` : `${ownerKey}:root`,
                totalItems: undefined,
                owner: ownerKey,
            });
        }

        // Fetch all collections (paginated) for each root
        async function fetchAllCollections(qs: URLSearchParams): Promise<any[]> {
            const all: any[] = [];
            let start = 0;
            const limit = 100;
            while (true) {
                const params = new URLSearchParams(qs);
                params.set('start', String(start));
                params.set('limit', String(limit));
                const url = `${API_PREFIX}/collections?${params.toString()}`;
                const res = await fetch(url, { headers });
                if (!res.ok) break;
                const data = await res.json();
                if (!Array.isArray(data) || data.length === 0) break;
                all.push(...data);
                if (data.length < limit) break;
                start += data.length;
            }
            return all;
        }

        for (const r of roots) {
            const ownerKey = r.kind === 'group' ? `group:${r.id}` : 'user';
            nodes.push({ id: `${ownerKey}:root`, name: r.kind === 'group' ? (r.name || `Group ${r.id}`) : '我的库', kind: 'root', parentId: null, owner: ownerKey });

            const usp = new URLSearchParams();
            if (r.kind === 'group') usp.set('group', r.id);
            const collections = await fetchAllCollections(usp);
            for (const c of collections) pushCollection(ownerKey, c);
        }

        return nodes;
    }

    async listPapers(nodeId: string, opts?: { cursor?: string; limit?: number }): Promise<{ items: DatasetPaperItem[]; next?: string }> {
        const cfg = this.requireCfg();
        const headers = buildHeaders(cfg);
        const limit = Math.min(Math.max(opts?.limit || 25, 1), 100);
        const start = opts?.cursor ? parseInt(opts.cursor, 10) : 0;
        const params = new URLSearchParams({ start: String(start), limit: String(limit), format: 'json' });
        let ownerKey = 'user';
        let collectionKey: string | null = null;
        if (nodeId.includes(':')) {
            const [owner, type, rest] = nodeId.split(':'); // e.g., user:root or group:123:col:ABCD
            if (owner === 'user') ownerKey = 'user';
            else if (owner === 'group') {
                // group:123:root or group:123:col:ABCD
                const parts = nodeId.split(':');
                // parts[1] = groupId
                ownerKey = `group:${parts[1]}`;
                // detect collection
                const idx = parts.indexOf('col');
                if (idx >= 0 && parts[idx + 1]) collectionKey = parts[idx + 1];
            }
            if (type === 'col' && rest) collectionKey = rest;
        } else {
            // legacy ids: 'root' or collectionKey
            if (nodeId !== 'root') collectionKey = nodeId;
        }
        if (ownerKey.startsWith('group:')) {
            const groupId = ownerKey.split(':')[1];
            params.set('group', groupId);
        }
        if (collectionKey) params.set('collection', collectionKey);
        const url = `${API_PREFIX}/items/top?${params.toString()}`;
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error(`Zotero items failed: ${res.status}`);
        const itemsRaw = await res.json();
        const items: DatasetPaperItem[] = (itemsRaw || [])
            .filter((it: any) => (it?.data?.itemType === 'journalArticle' || it?.data?.itemType === 'conferencePaper' || it?.data?.itemType === 'preprint' || it?.data?.itemType === 'report' || it?.data?.itemType === 'thesis' || it?.data?.DOI || it?.data?.url))
            .map((it: any) => {
                const data = it?.data || it;
                const creators = Array.isArray(data?.creators) ? data.creators : [];
                const authors = creators
                    .filter((c: any) => (c?.creatorType || '').toLowerCase().includes('author'))
                    .map((c: any) => [c?.firstName, c?.lastName].filter(Boolean).join(' ').trim())
                    .filter(Boolean);
                const year = data?.date ? Number(String(data.date).slice(0, 4)) : undefined;
                const doi = data?.DOI || null;
                const urlField = data?.url || null;
                return {
                    id: data?.key || data?.id || it?.key || it?.id,
                    title: data?.title || 'Untitled',
                    authors,
                    year: Number.isFinite(year) ? year : undefined,
                    doi: doi || null,
                    url: urlField || null,
                    s2Id: null,
                    extra: { itemType: data?.itemType, collections: data?.collections || [] }
                } as DatasetPaperItem;
            });
        const nextStart = start + (Array.isArray(itemsRaw) ? itemsRaw.length : 0);
        const next = itemsRaw.length < limit ? undefined : String(nextStart);
        return { items, next };
    }

    async listNotesByPaper(paperExternalId: string): Promise<DatasetNoteItem[]> {
        const cfg = this.requireCfg();
        const headers = buildHeaders(cfg);
        // Zotero 笔记作为 child item, type 'note'
        // 支持两种传入形式：
        // 1) 纯 itemKey（默认 user 库）
        // 2) 编码形式：`group|<groupId>|<itemKey>` 或 `user|<itemKey>`
        let groupParam = '';
        let itemIdForPath = paperExternalId;
        if (paperExternalId.includes('|')) {
            const parts = paperExternalId.split('|');
            if (parts[0] === 'group' && parts[1]) {
                groupParam = parts[1];
                itemIdForPath = parts[2] || '';
            } else if (parts[0] === 'user') {
                itemIdForPath = parts[1] || '';
            }
        }
        if (!itemIdForPath) itemIdForPath = paperExternalId;
        const url = `${API_PREFIX}/items/${encodeURIComponent(itemIdForPath)}/children?itemType=note${groupParam ? `&group=${encodeURIComponent(groupParam)}` : ''}`;
        const res = await fetch(url, { headers });
        if (!res.ok) return [];
        const rows = await res.json();
        const notes: DatasetNoteItem[] = (rows || []).map((r: any) => {
            const data = r?.data || r;
            return {
                id: data?.key || data?.id || r?.key || r?.id,
                paperExternalId,
                title: undefined,
                markdown: undefined,
                rawHtml: data?.note || '',
                tags: (data?.tags || []).map((t: any) => t?.tag).filter(Boolean),
                externalRef: { zoteroKey: data?.key }
            } as DatasetNoteItem;
        });
        return notes;
    }

    private requireCfg(): DatasetAuthConfig {
        if (!this.cfg) throw new Error('provider not connected');
        return this.cfg;
    }
}


