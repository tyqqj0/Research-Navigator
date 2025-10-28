/**
 * 🌐 Backend API Service - 后端接口服务
 * 
 * 核心理念: 前端作为智能缓存层，后端处理所有复杂业务逻辑
 * 功能: 文献查重、内容抓取、引用关系获取
 * 设计: API-First + 缓存优化 + 错误处理
 */

import { LibraryItem, ExtendedLibraryItem } from '../models';
import type { PaperSearchParams, SearchHit } from '../models';

// ⛳ 已移除旧的解析与批处理类型与方法，切换到 S2 风格 /api/v1/paper 接口

/**
 * 🔗 引用关系结果
 */
export interface CitationNetworkResult {
    paperIds: string[];
    citations: Array<{
        sourcePaperId: string;
        targetPaperId: string;
        citationType: string;
        confidence: number;
    }>;
    metadata: {
        totalNodes: number;
        totalEdges: number;
        analysisTime: number;
    };
}

/**
 * 🌐 Backend API Service
 * 
 * 核心原则：
 * 1. 所有复杂逻辑由后端处理
 * 2. 前端负责缓存和用户体验
 * 3. 支持批量操作和进度跟踪
 * 4. 优雅的错误处理和重试机制
 */
export class BackendApiService {
    private readonly baseUrl: string;
    private readonly apiKey?: string;
    private cache = new Map<string, any>();

    constructor(config: {
        baseUrl: string;
        apiKey?: string;
        timeout?: number;
    }) {
        this.baseUrl = config.baseUrl.replace(/\/$/, ''); // 移除末尾斜杠
        this.apiKey = config.apiKey;
    }

    // ==================== 健康检查 ====================

    async health(): Promise<any> {
        return await this.apiRequest('GET', `/api/v1/health`);
    }

    async healthDetailed(): Promise<any> {
        return await this.apiRequest('GET', `/api/v1/health/detailed`);
    }

    /**
     * 📚 获取论文详情
     */
    async getPaper(paperIdInput: string): Promise<LibraryItem> {
        // 统一处理传入的 ID：既兼容已编码，也兼容未编码
        const decodeSafe = (v: string) => {
            try { return decodeURIComponent(v); } catch { return v; }
        };
        const normalizedId = decodeSafe(paperIdInput);
        const needsEncoding = /^(DOI:|URL:)/i.test(normalizedId) || /\//.test(normalizedId);
        const idForPath = needsEncoding ? encodeURIComponent(normalizedId) : normalizedId;

        const cacheKey = `paper_${normalizedId}`;

        // 缓存命中
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < 300000) {
            return cached.data;
        }
        // 简单重试：最多 3 次，不做外部兜底
        let lastError: any;
        for (let attempt = 1; attempt <= 3; attempt += 1) {
            try {
                // console.log('[BackendAPI] Fetching paper:', { input: paperIdInput, normalizedId, idForPath, attempt });
                const response = await this.apiRequest('GET', `/api/v1/paper/${idForPath}`);
                const literature = this.mapBackendToFrontend(response);
                this.cache.set(cacheKey, { data: literature, timestamp: Date.now() });
                return literature;
            } catch (error: any) {
                lastError = error;
                // 固定短暂等待后重试
                if (attempt < 3) {
                    try { await new Promise(r => setTimeout(r, 150)); } catch { /* noop */ }
                }
            }
        }
        console.error('[BackendAPI] Failed to get paper after retries:', lastError);
        throw new Error('Failed to get paper');
    }

    /**
     * 📦 批量获取论文
     */
    async getPapersBatch(paperIds: string[], options?: { includeReferences?: boolean }): Promise<LibraryItem[]> {
        try {
            console.log(`[BackendAPI] Fetching ${paperIds.length} papers`);

            // 检查缓存中已有的文献
            const cached: LibraryItem[] = [];
            const needFetch: string[] = [];

            paperIds.forEach(paperId => {
                const cacheKey = `paper_${paperId}`;
                const cachedItem = this.cache.get(cacheKey);
                if (cachedItem && Date.now() - cachedItem.timestamp < 300000) {
                    cached.push(cachedItem.data);
                } else {
                    needFetch.push(paperId);
                }
            });

            // 批量获取未缓存的文献
            let fetched: LibraryItem[] = [];
            if (needFetch.length > 0) {
                try { console.debug('[BackendAPI] getPapersBatch request body preview', { idsPreview: needFetch.slice(0, 5), idsCount: needFetch.length }); } catch { /* noop */ }
                const response = await this.apiRequest('POST', '/api/v1/paper/batch', {
                    ids: needFetch,
                    // Some backends require explicit request to include references to save rate limits
                    includeReferences: options?.includeReferences === true
                });

                const items = Array.isArray(response) ? response : (response.papers || response.items || []);
                try {
                    const refsInBatch = (items || []).filter((it: any) =>
                        (Array.isArray(it?.references) && it.references.length > 0)
                        || (Array.isArray(it?.reference_list) && it.reference_list.length > 0)
                        || (Array.isArray(it?.refs) && it.refs.length > 0)
                    ).length;
                    console.debug('[BackendAPI] getPapersBatch response summary', {
                        fetchedCount: (items || []).length,
                        withReferences: refsInBatch,
                        firstItemKeys: items && items[0] ? Object.keys(items[0]) : []
                    });
                } catch { /* noop */ }
                const valid: LibraryItem[] = [];
                (items || []).forEach((item: any, idx: number) => {
                    if (!item) return; // 后端可能返回 null 占位，直接跳过
                    try {
                        const mapped = this.mapBackendToFrontend(item);
                        if (mapped && mapped.paperId) valid.push(mapped);
                    } catch (err) {
                        console.warn(`[BackendAPI] Skip invalid batch item at index ${idx}:`, err);
                    }
                });
                fetched = valid;

                // 更新缓存
                fetched.forEach(item => {
                    const cacheKey = `paper_${item.paperId}`;
                    this.cache.set(cacheKey, {
                        data: item,
                        timestamp: Date.now()
                    });
                });
            }

            // 合并缓存和新获取的数据，按原顺序返回（支持 DOI/ARXIV 请求ID 重映射）
            const allItems = [...cached, ...fetched];
            const byPaperId = new Map<string, LibraryItem>();
            const byDoi = new Map<string, LibraryItem>();
            const byArxiv = new Map<string, LibraryItem>();
            const normDoi = (s: string) => String(s || '').trim().toLowerCase();
            const normArxiv = (s: string) => String(s || '').trim().toLowerCase();
            for (const it of allItems) {
                if (!it) continue;
                if (it.paperId) byPaperId.set(it.paperId, it);
                const d = (it as any).doi as string | undefined;
                if (d && typeof d === 'string') {
                    const v = d.trim();
                    if (/^10\./i.test(v)) {
                        byDoi.set(normDoi(v), it);
                    } else if (/^\d{4}\.\d{4,5}(v\d+)?$/i.test(v) || /^arxiv:/i.test(v)) {
                        const val = v.replace(/^arxiv:/i, '');
                        byArxiv.set(normArxiv(val), it);
                    }
                }
            }

            const result = paperIds.map(reqId => {
                // 1) 直接按后端 paperId 命中
                if (byPaperId.has(reqId)) return byPaperId.get(reqId)!;
                // 2) DOI: 前缀
                const mDoi = reqId.match(/^DOI:(.+)$/i);
                if (mDoi) {
                    const key = normDoi(mDoi[1]);
                    if (byDoi.has(key)) return byDoi.get(key)!;
                }
                // 3) ARXIV: 前缀
                const mAx = reqId.match(/^ARXIV:(.+)$/i);
                if (mAx) {
                    const key = normArxiv(mAx[1]);
                    if (byArxiv.has(key)) return byArxiv.get(key)!;
                }
                return undefined as unknown as LibraryItem;
            }).filter(Boolean) as LibraryItem[];

            return result;
        } catch (error) {
            console.error('[BackendAPI] Failed to get batch papers:', error);
            throw new Error('Failed to get batch papers');
        }
    }

    // ==================== 引用关系 API ====================

    /**
     * 🔗 获取单个论文的引用（incoming）
     */
    async getPaperCitations(paperId: string): Promise<Array<{ sourcePaperId: string; citationType?: string; confidence?: number }>> {
        try {
            const cacheKey = `citations_in_${paperId}`;
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < 300000) {
                return cached.data;
            }

            const response = await this.apiRequest('GET', `/api/v1/paper/${paperId}/citations`);
            const raw = (response?.citations ?? response?.items ?? response ?? []);
            const arr: any[] = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' ? [raw] : []);
            const result = arr.map((c: any) => ({
                sourcePaperId: c.paperId || c.paper_id || c.sourcePaperId || c.source_paper_id || c.sourceId || c.source_id || c.id,
                citationType: c.type || c.citationType,
                confidence: c.confidence || c.score || 1
            })).filter(x => !!x.sourcePaperId);

            this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
            return result;
        } catch (error) {
            console.error('[BackendAPI] Failed to get citations:', error);
            throw new Error('Failed to get citations');
        }
    }

    /**
     * 🔗 获取单个论文的参考文献（outgoing）
     */
    async getPaperReferences(paperId: string): Promise<Array<{ targetPaperId: string; citationType?: string; confidence?: number }>> {
        try {
            const cacheKey = `references_out_${paperId}`;
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < 300000) {
                return cached.data;
            }

            try { console.debug('[BackendAPI] getPaperReferences request', { paperId }); } catch { /* noop */ }
            const response = await this.apiRequest('GET', `/api/v1/paper/${paperId}/references`);
            const raw = (response?.references
                ?? response?.referenceIds
                ?? response?.outboundCitations
                ?? response?.items
                ?? response
                ?? []);
            const arr: any[] = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' ? [raw] : []);
            try {
                const first: any = arr && arr.length > 0 ? arr[0] : undefined;
                console.debug('[BackendAPI] getPaperReferences raw summary', {
                    paperId,
                    rawType: Array.isArray(raw) ? 'array' : typeof raw,
                    rawLength: Array.isArray(raw) ? raw.length : (raw ? 1 : 0),
                    firstItemKeys: first && typeof first === 'object' ? Object.keys(first) : undefined,
                    firstItemIdFields: first && typeof first === 'object' ? {
                        paperId: first.paperId, paper_id: first.paper_id, targetPaperId: first.targetPaperId,
                        target_paper_id: first.target_paper_id, targetId: first.targetId, target_id: first.target_id, id: first.id
                    } : undefined
                });
            } catch { /* noop */ }
            const result = arr.map((c: any) => {
                if (typeof c === 'string') {
                    return { targetPaperId: c, citationType: 'reference', confidence: 1 };
                }
                return {
                    targetPaperId: c.paperId || c.paper_id || c.targetPaperId || c.target_paper_id || c.targetId || c.target_id || c.id,
                    citationType: c.type || c.citationType,
                    confidence: c.confidence || c.score || 1
                };
            }).filter(x => !!x.targetPaperId);
            try { console.debug('[BackendAPI] getPaperReferences mapped', { paperId, count: result.length, firstTarget: result[0]?.targetPaperId }); } catch { /* noop */ }

            this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
            return result;
        } catch (error) {
            console.error('[BackendAPI] Failed to get references:', error);
            throw new Error('Failed to get references');
        }
    }

    /**
     * 🔗 构建引用网络（基于 citations + references 本地拼装）
     */
    async getCitationNetwork(paperIds: string[]): Promise<CitationNetworkResult> {
        const start = Date.now();
        const edges: Array<{ sourcePaperId: string; targetPaperId: string; citationType: string; confidence: number }> = [];
        const seen = new Set<string>();

        for (const id of paperIds) {
            const [incoming, outgoing] = await Promise.all([
                this.getPaperCitations(id),
                this.getPaperReferences(id)
            ]);

            incoming.forEach(c => {
                if (!c.sourcePaperId) return;
                const key = `${c.sourcePaperId}->${id}`;
                if (seen.has(key)) return;
                seen.add(key);
                edges.push({
                    sourcePaperId: c.sourcePaperId,
                    targetPaperId: id,
                    citationType: c.citationType || 'citation',
                    confidence: c.confidence || 1
                });
            });

            outgoing.forEach(r => {
                if (!r.targetPaperId) return;
                const key = `${id}->${r.targetPaperId}`;
                if (seen.has(key)) return;
                seen.add(key);
                edges.push({
                    sourcePaperId: id,
                    targetPaperId: r.targetPaperId,
                    citationType: r.citationType || 'reference',
                    confidence: r.confidence || 1
                });
            });
        }

        return {
            paperIds,
            citations: edges,
            metadata: {
                totalNodes: paperIds.length,
                totalEdges: edges.length,
                analysisTime: Date.now() - start
            }
        };
    }

    // ==================== 搜索 API ====================

    /**
     * 🔍 搜索论文（S2风格）
     */
    async searchPapers(query: PaperSearchParams): Promise<{
        results: LibraryItem[];
        total: number;
        query: any;
        searchTime: number;
    }> {
        try {
            console.log('[BackendAPI] Searching papers:', query);

            const params = this.buildSearchParams(query);

            // 带指数退避的轻量重试（最多 3 次），仅针对网络/超时类错误
            let lastError: any;
            for (let attempt = 1; attempt <= 3; attempt += 1) {
                try {
                    const response = await this.apiRequest('GET', `/api/v1/paper/search?${this.stringifyParamsStrict(params)}`);
                    // 兼容空响应或非 JSON 响应
                    const list = Array.isArray(response)
                        ? response
                        : (Array.isArray(response?.data)
                            ? response.data
                            : (Array.isArray(response?.results)
                                ? response.results
                                : (Array.isArray(response?.papers) ? response.papers : [])));

                    const total = typeof response?.total === 'number'
                        ? response.total
                        : (typeof response?.total_results === 'number'
                            ? response.total_results
                            : (typeof response?.count === 'number'
                                ? response.count
                                : (Array.isArray(list) ? list.length : 0)));

                    const mapped = (list || []).map((item: any) => this.mapBackendToFrontend(item));
                    return {
                        results: mapped,
                        total,
                        query: (response && (response as any).query) || { query: query.query },
                        searchTime: (response && ((response as any).search_time_ms || (response as any).searchTime)) || 0
                    };
                } catch (err: any) {
                    lastError = err;
                    const msg = String(err?.message || '');
                    const isRetryable = msg.includes('Network timeout') || msg.includes('Network error');
                    if (attempt < 3 && isRetryable) {
                        // 200ms 基础 + 抖动的指数退避
                        const base = 200;
                        const backoff = base * Math.pow(2, attempt - 1);
                        const jitter = Math.floor(Math.random() * 120);
                        try { await new Promise(r => setTimeout(r, backoff + jitter)); } catch { /* noop */ }
                        continue;
                    }
                    break;
                }
            }
            console.error('[BackendAPI] Paper search failed after retries:', lastError);
            throw new Error('Failed to search papers');
        } catch (error) {
            console.error('[BackendAPI] Paper search failed:', error);
            throw new Error('Failed to search papers');
        }
    }

    /**
     * 🧱 参数构造器：将宽松的 PaperSearchParams 规范化为 URLSearchParams
     */
    private buildSearchParams(query: PaperSearchParams): URLSearchParams {
        const params = new URLSearchParams();
        if (query.query) params.set('query', query.query);
        if (typeof query.offset === 'number') params.set('offset', String(query.offset));
        if (typeof query.limit === 'number') {
            const safe = Math.max(1, Math.min(Number(query.limit) || 0, 100));
            params.set('limit', String(safe));
        }

        const rawFields = Array.isArray(query.fields)
            ? query.fields
            : (typeof query.fields === 'string' ? query.fields.split(',').map(s => s.trim()).filter(Boolean) : []);
        if (rawFields.length > 0) {
            // 后端不支持 doi 字段筛选，统一移除；并将 publication 规范化为 venue
            const sanitized = rawFields
                .map(f => f === 'publication' ? 'venue' : f)
                .filter(f => f !== 'doi');
            const ensureId = sanitized.includes('paperId') ? sanitized : [...sanitized, 'paperId'];
            const unique = Array.from(new Set(ensureId));
            params.set('fields', unique.join(','));
        }

        if (query.publicationDateOrYear) params.set('publicationDateOrYear', String(query.publicationDateOrYear));
        if (query.year != null) params.set('year', String(query.year));
        if (query.venue) {
            const venues = Array.isArray(query.venue) ? query.venue : String(query.venue).split(',').map(s => s.trim()).filter(Boolean);
            if (venues.length) params.set('venue', venues.join(','));
        }
        if (query.fieldsOfStudy) {
            const fos = Array.isArray(query.fieldsOfStudy) ? query.fieldsOfStudy : String(query.fieldsOfStudy).split(',').map(s => s.trim()).filter(Boolean);
            if (fos.length) params.set('fieldsOfStudy', fos.join(','));
        }
        if (query.publicationTypes) {
            const types = Array.isArray(query.publicationTypes) ? query.publicationTypes : String(query.publicationTypes).split(',').map(s => s.trim()).filter(Boolean);
            if (types.length) params.set('publicationTypes', types.join(','));
        }
        if (query.openAccessPdf === true) params.set('open_access', '1');
        if (query.minCitationCount != null) params.set('min_citation_count', String(query.minCitationCount));
        if (typeof query.matchTitle === 'boolean') params.set('match_title', String(!!query.matchTitle));
        // 显式控制 prefer_local：默认 false，用户显式开启时为 true
        params.set('prefer_local', String(query.preferLocal === true));
        if (typeof query.fallbackToS2 === 'boolean') params.set('fallback_to_s2', String(!!query.fallbackToS2));
        return params;
    }

    /**
     * 将 URLSearchParams 严格序列化：使用 %20 而非 + 表示空格，
     * 以避免部分后端/网关对 + 解析不一致导致的搜索差异。
     */
    private stringifyParamsStrict(params: URLSearchParams): string {
        return params.toString().replace(/\+/g, '%20');
    }

    /**
     * 🔎 返回命中结构（带可选得分/排名/高亮）
     */
    async searchPapersHits(query: PaperSearchParams): Promise<{
        hits: Array<SearchHit>;
        total: number;
        query: any;
        searchTime: number;
    }> {
        const params = this.buildSearchParams(query);
        // 解析 fields 以供最小映射使用（与 buildSearchParams 行为保持一致）
        const fieldsSpec = (() => {
            const src = Array.isArray(query.fields)
                ? query.fields
                : (typeof query.fields === 'string' ? query.fields.split(',').map(s => s.trim()).filter(Boolean) : []);
            if (src.length === 0) return undefined;
            const sanitized = src.map(f => f === 'publication' ? 'venue' : f);
            return Array.from(new Set(['paperId', ...sanitized]));
        })();
        let lastError: any;
        for (let attempt = 1; attempt <= 3; attempt += 1) {
            try {
                const response = await this.apiRequest('GET', `/api/v1/paper/search?${this.stringifyParamsStrict(params)}`);
                const list = Array.isArray(response)
                    ? response
                    : (Array.isArray(response?.data)
                        ? response.data
                        : (Array.isArray(response?.results)
                            ? response.results
                            : (Array.isArray(response?.papers) ? response.papers : [])));

                const total = typeof response?.total === 'number'
                    ? response.total
                    : (typeof response?.total_results === 'number'
                        ? response.total_results
                        : (typeof response?.count === 'number'
                            ? response.count
                            : (Array.isArray(list) ? list.length : 0)));

                const hits: Array<SearchHit> = (list || []).map((raw: any, idx: number) => {
                    const item = this.mapSearchResult(raw, fieldsSpec);
                    const score = typeof raw?.score === 'number' ? raw.score : (typeof raw?._score === 'number' ? raw._score : undefined);
                    const highlightsRaw = raw?.highlights || raw?.highlight;
                    const highlights = highlightsRaw && typeof highlightsRaw === 'object' ? {
                        title: Array.isArray(highlightsRaw.title) ? highlightsRaw.title : undefined,
                        abstract: Array.isArray(highlightsRaw.abstract) ? highlightsRaw.abstract : undefined,
                        authors: Array.isArray(highlightsRaw.authors) ? highlightsRaw.authors : undefined,
                        venue: Array.isArray(highlightsRaw.venue) ? highlightsRaw.venue : undefined,
                    } : undefined;
                    const source = raw?.source || raw?._index || undefined;
                    return { item, score, rank: idx + 1, highlights, source };
                });

                return {
                    hits,
                    total,
                    query: (response && (response as any).query) || { query: query.query },
                    searchTime: (response && ((response as any).search_time_ms || (response as any).searchTime)) || 0
                };
            } catch (err: any) {
                lastError = err;
                const msg = String(err?.message || '');
                const isRetryable = msg.includes('Network timeout') || msg.includes('Network error');
                if (attempt < 3 && isRetryable) {
                    const base = 200;
                    const backoff = base * Math.pow(2, attempt - 1);
                    const jitter = Math.floor(Math.random() * 120);
                    try { await new Promise(r => setTimeout(r, backoff + jitter)); } catch { /* noop */ }
                    continue;
                }
                break;
            }
        }
        console.error('[BackendAPI] Paper search (hits) failed after retries:', lastError);
        throw new Error('Failed to search papers');
    }

    /**
     * 🧭 仅映射最小命中项：paperId + 按需字段
     */
    private mapSearchResult(backendData: any, fieldsSpec?: string[] | undefined): any /* MinimalSearchItem */ {
        if (!backendData || typeof backendData !== 'object') {
            throw new Error('Invalid backend search hit');
        }
        const paperId = backendData.paperId || backendData.paper_id || backendData.id;
        if (!paperId) {
            throw new Error('Search hit missing paperId');
        }
        const want = new Set<string>((fieldsSpec || []).map(s => String(s)));
        // 默认输出字段（当未指定 fields 时）
        const defaults = ['title', 'year', 'authors', 'venue', 'url', 'doi'];
        const fields = (fieldsSpec && want.size > 0) ? Array.from(want) : defaults;

        const out: any = { paperId: String(paperId) };

        for (const f of fields) {
            if (f === 'paperId') continue; // 已填充
            switch (f) {
                case 'title':
                    if (backendData.title != null) out.title = backendData.title;
                    break;
                case 'year':
                    if (typeof backendData.year === 'number') out.year = backendData.year;
                    break;
                case 'authors': {
                    const authorsRaw = backendData.authors;
                    if (Array.isArray(authorsRaw)) {
                        const arr = authorsRaw
                            .map((a: any) => (a && typeof a === 'object') ? (a.name || a.fullName || a.display_name || a.displayName || a.author_name) : a)
                            .filter((x: any) => typeof x === 'string' && x.trim().length > 0);
                        if (arr.length) out.authors = arr;
                    }
                    break;
                }
                case 'venue': {
                    const v = backendData.venue || backendData.publication || backendData.publicationVenue?.name;
                    if (v) out.venue = v;
                    break;
                }
                case 'url': {
                    const u = backendData.url || backendData.s2Url || backendData.openAccessPdf?.url;
                    if (u) out.url = u;
                    break;
                }
                case 'doi': {
                    const d = backendData.doi || backendData.externalIds?.DOI;
                    if (d) out.doi = d;
                    break;
                }
                default: {
                    // 透传简单字段，避免强映射为 LibraryItem
                    const val = (backendData as any)[f];
                    if (val !== undefined) out[f] = val;
                }
            }
        }

        return out;
    }

    // ==================== 缓存 API ====================

    async clearPaperCache(paperId: string): Promise<{ success: boolean }> {
        try {
            await this.apiRequest('DELETE', `/api/v1/paper/${paperId}/cache`);
            this.cache.delete(`paper_${paperId}`);
            this.cache.delete(`citations_in_${paperId}`);
            this.cache.delete(`references_out_${paperId}`);
            return { success: true };
        } catch (error) {
            console.error('[BackendAPI] Failed to clear cache:', error);
            return { success: false };
        }
    }

    async warmPaperCache(paperId: string): Promise<{ success: boolean }> {
        try {
            await this.apiRequest('POST', `/api/v1/paper/${paperId}/cache/warm`);
            return { success: true };
        } catch (error) {
            console.error('[BackendAPI] Failed to warm cache:', error);
            return { success: false };
        }
    }

    // ==================== 工具方法 ====================

    /**
     * 🌐 通用API请求方法
     */
    private async apiRequest(
        method: 'GET' | 'POST' | 'PUT' | 'DELETE',
        endpoint: string,
        data?: any
    ): Promise<any> {
        const url = `${this.baseUrl}${endpoint}`;

        try {
            const bodyPreview = data && typeof data === 'object'
                ? (() => {
                    try {
                        const shaped = Array.isArray((data as any).ids)
                            ? { ...data, idsPreview: ((data as any).ids as any[]).slice(0, 5), idsCount: ((data as any).ids as any[]).length }
                            : data;
                        const s = JSON.stringify(shaped);
                        return s.length > 800 ? s.slice(0, 800) + '…' : s;
                    } catch { return undefined; }
                })()
                : undefined;
            console.debug('[BackendAPI][request]', { method, url, hasBody: !!data, bodyPreview });
        } catch { /* noop */ }

        const config: RequestInit = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
            }
        };

        if (data && (method === 'POST' || method === 'PUT')) {
            config.body = JSON.stringify(data);
        }

        try {
            const controller = new AbortController();
            const timeoutMs = 15000; // 15s 上限，避免卡死
            const timeout = setTimeout(() => controller.abort(), timeoutMs);
            const response = await fetch(url, { ...config, signal: controller.signal });
            clearTimeout(timeout);

            if (!response.ok) {
                let errorJson: any = undefined;
                let errorText: string | undefined = undefined;
                try {
                    errorJson = await response.json();
                } catch {
                    try {
                        errorText = await response.text();
                    } catch { /* noop */ }
                }
                try {
                    const errorBodyPreview = errorJson
                        ? (() => { try { const s = JSON.stringify(errorJson); return s.length > 1000 ? s.slice(0, 1000) + '…' : s; } catch { return undefined; } })()
                        : ((errorText || '').slice(0, 500));
                    console.error('[BackendAPI][response-error]', {
                        method,
                        url,
                        status: response.status,
                        statusText: response.statusText,
                        errorBodyPreview
                    });
                } catch { /* noop */ }
                const message = (errorJson && typeof errorJson === 'object' && (errorJson as any).message)
                    ? (errorJson as any).message
                    : response.statusText;
                throw new Error(`API Error ${response.status}: ${message}`);
            }

            const contentType = response.headers.get('content-type') || undefined;
            const contentLengthHeader = response.headers.get('content-length');
            const contentLength = contentLengthHeader ? Number(contentLengthHeader) : undefined;

            let json: any;
            let rawPreview: string | undefined;
            try {
                // 使用 clone 以便在 JSON 解析失败时读取原始文本
                const clone = response.clone();
                json = await response.json();
                try {
                    const topKeys = json && typeof json === 'object' && !Array.isArray(json) ? Object.keys(json) : undefined;
                    const length = Array.isArray(json)
                        ? json.length
                        : (json?.items?.length || json?.papers?.length || json?.data?.length || undefined);
                    const sample = Array.isArray(json)
                        ? json.slice(0, 1)
                        : (Array.isArray(json?.items) ? json.items.slice(0, 1) : undefined);
                    console.debug('[BackendAPI][response]', { method, url, status: response.status, contentType, contentLength, length, topKeys, sample });
                } catch { /* noop */ }
            } catch (e) {
                json = null;
                try {
                    const clone = (e && typeof (e as any) === 'object' && 'stack' in (e as any)) ? response.clone() : response.clone();
                    const text = await clone.text();
                    rawPreview = (text || '').slice(0, 200);
                } catch { /* noop */ }
                try {
                    console.debug('[BackendAPI][response-nonjson]', { method, url, status: response.status, contentType, contentLength, rawPreview });
                } catch { /* noop */ }
            }

            return json;
        } catch (error: any) {
            if (error?.name === 'AbortError') {
                throw new Error('Network timeout: Backend service did not respond in time');
            }
            if (error instanceof TypeError && error.message.includes('fetch')) {
                throw new Error('Network error: Unable to connect to backend service');
            }
            throw error;
        }
    }

    /**
     * 🔄 后端数据到前端数据的映射（兼容 S2 字段）
     */
    private mapBackendToFrontend(backendData: any): ExtendedLibraryItem {
        if (!backendData || typeof backendData !== 'object') {
            throw new Error('Invalid backend paper data');
        }
        const authorsArr = Array.isArray(backendData.authors)
            ? backendData.authors.map((a: any) => a?.name || a).filter(Boolean)
            : [];

        const publication = backendData.publication || backendData.venue || backendData.publicationVenue?.name || null;
        // 尝试从后端字段提取精确发表日期
        const publicationDateRaw = backendData.publicationDate || backendData.publication_date || backendData.publishedAt || backendData.published_at || backendData.datePublished || backendData.firstOnline || backendData.first_online || null;
        const normalizeDateString = (v: any, fallbackYear?: number): string | undefined => {
            if (!v && typeof fallbackYear === 'number') {
                const y = Math.max(1000, Math.min(9999, fallbackYear));
                return `${y}-01-01`;
            }
            if (!v) return undefined;
            const s = String(v).trim();
            if (!s) return undefined;
            // replace slashes, remove trailing time
            let t = s.replace(/\//g, '-').replace(/T.*$/, '');
            // pure year
            const mYear = t.match(/^(\d{4})$/);
            if (mYear) return `${mYear[1]}-01-01`;
            // year-month
            const mYm = t.match(/^(\d{4})-(\d{1,2})$/);
            if (mYm) {
                const mm = mYm[2].padStart(2, '0');
                return `${mYm[1]}-${mm}-01`;
            }
            // year-month-day
            const mYmd = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
            if (mYmd) {
                const mm = mYmd[2].padStart(2, '0');
                const dd = mYmd[3].padStart(2, '0');
                return `${mYmd[1]}-${mm}-${dd}`;
            }
            // fallback to Date parsing
            const d = new Date(s);
            if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
            return undefined;
        };
        const publicationDate = normalizeDateString(publicationDateRaw, backendData.year || undefined);
        const doi = backendData.doi || backendData.externalIds?.DOI || backendData.externalIds?.ArXiv || null;
        const url = backendData.url || backendData.s2Url || backendData.openAccessPdf?.url || null;
        const pdfPath = backendData.openAccessPdf?.url || backendData.pdf_url || backendData.pdf_path || null;
        const createdAt = backendData.created_at || backendData.createdAt || Date.now();
        const updatedAt = backendData.updated_at || backendData.updatedAt || createdAt;

        // Normalize references into parsedContent.extractedReferences and referenceDetails if provided by backend
        const refsRaw = backendData.references || backendData.reference_list || backendData.refs || undefined;
        let normalizedExtractedReferences: string[] | undefined;
        let referenceDetails: Array<{
            paperId: string;
            title?: string | null;
            venue?: string | null;
            year?: number;
            citationCount?: number;
            authors?: Array<{ authorId?: string; name: string }>;
        }> | undefined;
        if (Array.isArray(refsRaw)) {
            referenceDetails = [];
            normalizedExtractedReferences = refsRaw
                .map((r: any) => {
                    if (typeof r === 'string') {
                        // also push minimal detail
                        referenceDetails!.push({ paperId: r });
                        return r;
                    }
                    if (r && typeof r === 'object') {
                        const id = r.paperId || r.paper_id || r.id || r.targetPaperId || r.target_paper_id || r.targetId || r.target_id;
                        if (!id) return undefined;
                        // extract authors array robustly
                        const authorsRaw = r.authors || r.author_list || r.authorNames || r.author_names;
                        let authors: Array<{ authorId?: string; name: string }> | undefined;
                        if (Array.isArray(authorsRaw)) {
                            authors = authorsRaw
                                .map((a: any) => {
                                    if (!a) return undefined;
                                    if (typeof a === 'string') return { name: a };
                                    const name = a.name || a.fullName || a.display_name || a.displayName || a.author_name;
                                    const authorId = a.authorId || a.author_id || a.id;
                                    if (!name) return undefined;
                                    return authorId ? { authorId: String(authorId), name } : { name };
                                })
                                .filter(Boolean) as Array<{ authorId?: string; name: string }>;
                        }
                        const title = r.title || r.paperTitle || r.displayTitle || null;
                        const venue = r.venue || r.journal || r.publication || r.publicationVenue?.name || null;
                        const year = r.year || r.publicationYear || r.pub_year;
                        const citationCount = r.citationCount || r.citation_count || r.numCitations || r.citations;
                        referenceDetails!.push({
                            paperId: id,
                            title: title ?? null,
                            venue: venue ?? null,
                            year: typeof year === 'number' ? year : undefined,
                            citationCount: typeof citationCount === 'number' ? citationCount : undefined,
                            authors
                        });
                        return id;
                    }
                    return undefined;
                })
                .filter((x: any) => typeof x === 'string' && x.length > 0) as string[];
        }

        // Merge with backend provided parsed_content if any
        const parsedContent = (() => {
            const original = backendData.parsed_content || backendData.parsedContent || undefined;
            const merged = {
                ...(original || {}),
            } as any;
            if (normalizedExtractedReferences && normalizedExtractedReferences.length > 0) {
                merged.extractedReferences = normalizedExtractedReferences;
            }
            if (referenceDetails && referenceDetails.length > 0) {
                merged.referenceDetails = referenceDetails;
            }
            return Object.keys(merged).length > 0 ? merged : undefined;
        })();

        return {
            // spread the same fields again to avoid mutating previous object inline
            paperId: backendData.paperId || backendData.paper_id || backendData.id,
            title: backendData.title,
            authors: authorsArr,
            year: backendData.year,
            source: backendData.source || 'search',
            publication,
            publicationDate: publicationDate ?? undefined,
            abstract: backendData.abstract,
            summary: backendData.summary,
            doi,
            url,
            pdfPath,
            parsedContent,
            backendTask: backendData.backend_task || undefined,
            // Citation metrics (pass through from backend if available)
            citationCount: backendData.citationCount || backendData.citation_count,
            influentialCitationCount: backendData.influentialCitationCount || backendData.influential_citation_count,
            isOpenAccess: backendData.isOpenAccess || backendData.is_open_access || (backendData.openAccessPdf?.url != null),
            createdAt: new Date(createdAt),
            updatedAt: new Date(updatedAt)
        } as ExtendedLibraryItem;
    }

    /**
     * 🧹 清理缓存
     */
    clearCache(): void {
        this.cache.clear();
        console.log('[BackendAPI] Cache cleared');
    }

    /**
     * 📊 获取缓存统计
     */
    getCacheStats(): {
        totalEntries: number;
        memoryUsage: string;
        hitRate: number;
    } {
        return {
            totalEntries: this.cache.size,
            memoryUsage: `${Math.round(JSON.stringify([...this.cache.values()]).length / 1024)}KB`,
            hitRate: 0 // 可以实现实际的命中率统计
        };
    }
}

// 🏪 单例服务实例
export const backendApiService = new BackendApiService({
    // Prefer same-origin proxy to avoid mixed content; allow override for Node/server tools
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || '/api/backend',
    apiKey: process.env.NEXT_PUBLIC_API_KEY
});

