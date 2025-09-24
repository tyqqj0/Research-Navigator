/**
 * 🌐 Backend API Service - 后端接口服务
 * 
 * 核心理念: 前端作为智能缓存层，后端处理所有复杂业务逻辑
 * 功能: 文献查重、内容抓取、引用关系获取
 * 设计: API-First + 缓存优化 + 错误处理
 */

import { LibraryItem, ExtendedLibraryItem } from '../models';

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
    async getPapersBatch(paperIds: string[]): Promise<LibraryItem[]> {
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
                const response = await this.apiRequest('POST', '/api/v1/paper/batch', {
                    ids: needFetch
                });

                const items = Array.isArray(response) ? response : (response.papers || response.items || []);
                fetched = items.map((item: any) => this.mapBackendToFrontend(item));

                // 更新缓存
                fetched.forEach(item => {
                    const cacheKey = `paper_${item.paperId}`;
                    this.cache.set(cacheKey, {
                        data: item,
                        timestamp: Date.now()
                    });
                });
            }

            // 合并缓存和新获取的数据，按原顺序返回
            const result = paperIds.map(paperId => {
                return cached.find(item => item.paperId === paperId) ||
                    fetched.find(item => item.paperId === paperId);
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
            const arr = (response.citations || response.items || response || []) as any[];
            const result = arr.map((c: any) => ({
                sourcePaperId: c.paperId || c.paper_id || c.sourcePaperId || c.source_paper_id || c.sourceId || c.source_id,
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

            const response = await this.apiRequest('GET', `/api/v1/paper/${paperId}/references`);
            const arr = (response.references || response.items || response || []) as any[];
            const result = arr.map((c: any) => ({
                targetPaperId: c.paperId || c.paper_id || c.targetPaperId || c.target_paper_id || c.targetId || c.target_id,
                citationType: c.type || c.citationType,
                confidence: c.confidence || c.score || 1
            })).filter(x => !!x.targetPaperId);

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
    async searchPapers(query: {
        query: string;
        offset?: number;
        limit?: number;
        fields?: string[];
    }): Promise<{
        results: LibraryItem[];
        total: number;
        query: any;
        searchTime: number;
    }> {
        try {
            console.log('[BackendAPI] Searching papers:', query);

            const params = new URLSearchParams();
            if (query.query) params.set('query', query.query);
            if (typeof query.offset === 'number') params.set('offset', String(query.offset));
            if (typeof query.limit === 'number') params.set('limit', String(query.limit));
            if (query.fields && query.fields.length > 0) params.set('fields', query.fields.join(','));

            const response = await this.apiRequest('GET', `/api/v1/paper/search?${params.toString()}`);

            return {
                results: (response.data || response.results || []).map((item: any) => this.mapBackendToFrontend(item)),
                total: response.total || response.total_results || (response.data ? response.data.length : 0),
                query: response.query || { query: query.query },
                searchTime: response.search_time_ms || response.searchTime || 0
            };
        } catch (error) {
            console.error('[BackendAPI] Paper search failed:', error);
            throw new Error('Failed to search papers');
        }
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

        // console.log('[BackendAPI] API Request:', url, method, data);

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
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`API Error ${response.status}: ${errorData.message || response.statusText}`);
            }

            // console.log('[BackendAPI] API Response:', response);

            return await response.json();
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
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000',
    apiKey: process.env.NEXT_PUBLIC_API_KEY
});

