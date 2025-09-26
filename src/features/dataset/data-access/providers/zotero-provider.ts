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
        // Zotero 没有强层级集合树（有 collections），这里拉取 collections 作为节点；根节点作为占位
        const cfg = this.requireCfg();
        const headers = buildHeaders(cfg);
        const url = `${API_PREFIX}/collections`;
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error(`Zotero collections failed: ${res.status}`);
        const data = await res.json();
        const nodes: DatasetNode[] = [
            { id: 'root', name: '全部条目', kind: 'root', totalItems: undefined }
        ];
        for (const c of data || []) {
            const key = c?.key || c?.data?.key || c?.data?.id || c?.id;
            const name = c?.name || c?.data?.name || 'Collection';
            nodes.push({ id: String(key), name: String(name), kind: 'collection', parentId: undefined, totalItems: undefined });
        }
        return nodes;
    }

    async listPapers(nodeId: string, opts?: { cursor?: string; limit?: number }): Promise<{ items: DatasetPaperItem[]; next?: string }> {
        const cfg = this.requireCfg();
        const headers = buildHeaders(cfg);
        const limit = Math.min(Math.max(opts?.limit || 25, 1), 100);
        const start = opts?.cursor ? parseInt(opts.cursor, 10) : 0;
        const params = new URLSearchParams({ start: String(start), limit: String(limit), format: 'json' });
        if (nodeId !== 'root') params.set('collection', nodeId);
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
        const nextStart = start + itemsRaw.length;
        const next = itemsRaw.length < limit ? undefined : String(nextStart);
        return { items, next };
    }

    async listNotesByPaper(paperExternalId: string): Promise<DatasetNoteItem[]> {
        const cfg = this.requireCfg();
        const headers = buildHeaders(cfg);
        // Zotero 笔记作为 child item, type 'note'
        const url = `${API_PREFIX}/items/${encodeURIComponent(paperExternalId)}/children?itemType=note`;
        const res = await fetch(url, { headers });
        if (!res.ok) return [];
        const rows = await res.json();
        const notes: DatasetNoteItem[] = (rows || []).map((r: any) => {
            const data = r?.data || r;
            return {
                id: data?.key || data?.id || r?.key || r?.id,
                paperExternalId,
                title: (data?.note || '').slice(0, 40),
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


