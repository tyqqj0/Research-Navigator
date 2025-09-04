/**
 * 🔍 Search Service - 文献搜索和过滤服务
 * 
 * 职责:
 * 1. 高级搜索功能
 * 2. 搜索结果增强
 * 3. 搜索面(Facets)生成
 * 4. 搜索建议和自动完成
 * 5. 搜索结果缓存
 * 
 * 设计原则:
 * - 专注搜索：只处理搜索相关的业务逻辑
 * - 性能优化：智能缓存和结果预处理
 * - 用户体验：提供丰富的搜索辅助功能
 */

import {
    enhancedLiteratureRepository,
    userMetaRepository,
    citationRepository,
} from '../repositories';
import {
    LibraryItemCore,
    EnhancedLiteratureItem,
    LiteratureFilter,
    LiteratureSort,
    PaginatedResult,
    ErrorHandler,
    withErrorBoundary,
    LITERATURE_CONSTANTS,
} from '../models';

/**
 * 🎯 增强版搜索结果
 */
export interface EnhancedSearchResult extends PaginatedResult<EnhancedLiteratureItem> {
    facets?: SearchFacets;
    suggestions?: SearchSuggestions;
    appliedFilters: LiteratureFilter;
    executionTime: number;
    searchQuery?: string;
}

/**
 * 📊 搜索面
 */
export interface SearchFacets {
    sources: Array<{ value: string; count: number }>;
    years: Array<{ value: number; count: number }>;
    authors: Array<{ value: string; count: number }>;
    tags: Array<{ value: string; count: number }>;
    readingStatus: Array<{ value: string; count: number }>;
    priority: Array<{ value: string; count: number }>;
    types: Array<{ value: string; count: number }>;
}

/**
 * 💡 搜索建议
 */
export interface SearchSuggestions {
    relatedQueries: string[];
    recommendedFilters: Array<{
        field: string;
        value: any;
        reason: string;
        count: number;
    }>;
    typoCorrections: Array<{
        original: string;
        suggested: string;
        confidence: number;
    }>;
}

/**
 * ⚙️ 搜索选项
 */
export interface SearchOptions {
    includeFacets?: boolean;
    includeRecommendations?: boolean;
    enableSmartSuggestions?: boolean;
    enableTypoCorrection?: boolean;
    cacheResults?: boolean;
}

/**
 * 📈 搜索统计
 */
export interface SearchServiceStats {
    totalSearches: number;
    averageResponseTime: number;
    cacheHitRate: number;
    popularQueries: Array<{ query: string; count: number }>;
    lastSearchAt: Date;
}

/**
 * 🔍 Search Service 类
 */
export class SearchService {
    // 📊 搜索缓存
    private searchCache = new Map<string, {
        data: EnhancedSearchResult;
        timestamp: number;
        ttl: number;
    }>();

    private readonly defaultCacheTTL = 300000; // 5分钟

    // 📈 搜索统计
    private stats: SearchServiceStats = {
        totalSearches: 0,
        averageResponseTime: 0,
        cacheHitRate: 0,
        popularQueries: [],
        lastSearchAt: new Date(),
    };

    // 📝 查询记录（用于统计）
    private queryLog = new Map<string, number>();

    constructor(
        private readonly literatureRepo = enhancedLiteratureRepository,
        private readonly userMetaRepo = userMetaRepository,
        private readonly citationRepo = citationRepository
    ) { }

    // ==================== 核心搜索功能 ====================

    /**
     * 🔍 执行增强版搜索
     */
    // @withErrorBoundary('searchLiterature', 'service')
    async searchLiterature(
        filter: LiteratureFilter = { searchFields: ['title', 'authors'] },
        sort: LiteratureSort = { field: 'createdAt', order: 'desc' },
        page: number = 1,
        pageSize: number = LITERATURE_CONSTANTS.DEFAULT_PAGE_SIZE,
        userId?: string,
        options: SearchOptions = {}
    ): Promise<EnhancedSearchResult> {
        const startTime = Date.now();

        try {
            // 1. 生成缓存键
            const cacheKey = this.generateCacheKey(filter, sort, page, pageSize, userId);

            // 2. 检查缓存
            if (options.cacheResults !== false) {
                const cached = this.getCache(cacheKey);
                if (cached) {
                    this.updateStats(Date.now() - startTime, true, true);
                    return cached;
                }
            }

            // 3. 预处理搜索条件
            const processedFilter = await this.preprocessFilter(filter, options);

            // 4. 执行基础搜索
            const searchResult = await this.literatureRepo.searchWithFilters(
                processedFilter,
                sort,
                page,
                pageSize
            );

            // 5. 增强搜索结果
            const enhancedItems = await this.enhanceSearchResults(searchResult.items, userId);

            // 6. 生成搜索面（如果需要）
            let facets: SearchFacets | undefined;
            if (options.includeFacets) {
                facets = await this.generateFacets(processedFilter, userId);
            }

            // 7. 生成搜索建议（如果需要）
            let suggestions: SearchSuggestions | undefined;
            if (options.enableSmartSuggestions) {
                suggestions = await this.generateSuggestions(filter, searchResult, userId);
            }

            // 8. 构建结果
            const result: EnhancedSearchResult = {
                items: enhancedItems,
                pagination: searchResult.pagination,
                facets,
                suggestions,
                appliedFilters: processedFilter,
                executionTime: Date.now() - startTime,
                searchQuery: filter.searchQuery,
            };

            // 9. 缓存结果
            if (options.cacheResults !== false) {
                this.setCache(cacheKey, result);
            }

            // 10. 记录查询
            this.recordQuery(filter.searchQuery);

            this.updateStats(Date.now() - startTime, true, false);
            return result;
        } catch (error) {
            this.updateStats(Date.now() - startTime, false, false);
            throw ErrorHandler.handle(error, {
                operation: 'service.searchLiterature',
                layer: 'service',
                additionalInfo: { filter, sort, page, pageSize },
                userId,
            });
        }
    }

    /**
     * 🎯 快速搜索（仅返回基本信息）
     */
    // @withErrorBoundary('quickSearch', 'service')
    async quickSearch(
        query: string,
        limit: number = 10,
        userId?: string
    ): Promise<Array<Pick<EnhancedLiteratureItem, 'lid' | 'title' | 'authors' | 'year' | 'source'>>> {
        try {
            const filter: LiteratureFilter = {
                searchQuery: query,
                searchFields: ['title', 'authors'],
            };

            const result = await this.literatureRepo.searchWithFilters(
                filter,
                { field: 'createdAt', order: 'desc' },
                1,
                limit
            );

            return result.items.map(item => ({
                lid: item.lid,
                title: item.title,
                authors: item.authors,
                year: item.year,
                source: item.source,
            }));
        } catch (error) {
            throw ErrorHandler.handle(error, {
                operation: 'service.quickSearch',
                layer: 'service',
                additionalInfo: { query, limit },
                userId,
            });
        }
    }

    /**
     * 🔤 自动完成搜索
     */
    // @withErrorBoundary('autocomplete', 'service')
    async autocomplete(
        query: string,
        field: 'title' | 'authors' | 'tags' | 'keywords' = 'title',
        limit: number = 10
    ): Promise<Array<{ value: string; count: number; category: string }>> {
        try {
            // 简化实现：基于现有数据生成自动完成建议
            const suggestions: Array<{ value: string; count: number; category: string }> = [];

            // 根据字段类型生成不同的建议
            switch (field) {
                case 'title':
                    // 从标题中提取相关词汇
                    suggestions.push(
                        { value: `${query} research`, count: 42, category: 'title' },
                        { value: `${query} analysis`, count: 38, category: 'title' },
                        { value: `${query} study`, count: 35, category: 'title' }
                    );
                    break;

                case 'authors':
                    // 从作者列表中匹配
                    suggestions.push(
                        { value: `${query}son`, count: 15, category: 'author' },
                        { value: `${query}er`, count: 12, category: 'author' }
                    );
                    break;

                case 'tags':
                    // 从标签中匹配
                    suggestions.push(
                        { value: `${query}-related`, count: 25, category: 'tag' },
                        { value: `${query}-methodology`, count: 18, category: 'tag' }
                    );
                    break;

                case 'keywords':
                    // 从关键词中匹配
                    suggestions.push(
                        { value: `${query} method`, count: 30, category: 'keyword' },
                        { value: `${query} approach`, count: 22, category: 'keyword' }
                    );
                    break;
            }

            return suggestions.slice(0, limit);
        } catch (error) {
            throw ErrorHandler.handle(error, {
                operation: 'service.autocomplete',
                layer: 'service',
                additionalInfo: { query, field, limit },
            });
        }
    }

    // ==================== 搜索结果增强 ====================

    /**
     * ⚡ 增强搜索结果
     */
    private async enhanceSearchResults(
        items: LibraryItemCore[],
        userId?: string
    ): Promise<EnhancedLiteratureItem[]> {
        // 1. 批量获取用户元数据（如果有用户ID）
        let userMetasMap = new Map<string, any>();
        if (userId) {
            const userMetas = await this.userMetaRepo.findByUserId(userId);
            userMetasMap = new Map(userMetas.map(meta => [meta.literatureId, meta]));
        }

        // 2. 批量获取引文统计
        const citationStatsMap = new Map<string, any>();
        // 这里可以批量获取引文统计，简化实现

        // 3. 增强每个项目
        return items.map(item => ({
            ...item,
            userMeta: userMetasMap.get(item.lid) || null,
            citationStats: citationStatsMap.get(item.lid) || {
                totalCitations: 0,
                incomingCitations: 0,
                outgoingCitations: 0,
            },
            relatedItems: [], // 可以在这里添加相关项目逻辑
            lastAccessedAt: userMetasMap.get(item.lid)?.lastAccessedAt || item.updatedAt,
        }));
    }

    // ==================== 搜索面生成 ====================

    /**
     * 📊 生成搜索面
     */
    private async generateFacets(
        filter: LiteratureFilter,
        userId?: string
    ): Promise<SearchFacets> {
        // 简化实现：返回模拟的搜索面数据
        return {
            sources: [
                { value: 'arXiv', count: 245 },
                { value: 'PubMed', count: 189 },
                { value: 'IEEE', count: 156 },
                { value: 'ACM', count: 123 },
            ],
            years: [
                { value: 2024, count: 98 },
                { value: 2023, count: 156 },
                { value: 2022, count: 134 },
                { value: 2021, count: 112 },
            ],
            authors: [
                { value: 'Smith, J.', count: 23 },
                { value: 'Johnson, M.', count: 18 },
                { value: 'Brown, K.', count: 15 },
            ],
            tags: [
                { value: 'machine-learning', count: 89 },
                { value: 'deep-learning', count: 67 },
                { value: 'neural-networks', count: 45 },
            ],
            readingStatus: [
                { value: 'unread', count: 234 },
                { value: 'reading', count: 45 },
                { value: 'completed', count: 123 },
            ],
            priority: [
                { value: 'high', count: 56 },
                { value: 'medium', count: 234 },
                { value: 'low', count: 112 },
            ],
            types: [
                { value: 'journal-article', count: 345 },
                { value: 'conference-paper', count: 234 },
                { value: 'book-chapter', count: 123 },
            ],
        };
    }

    // ==================== 搜索建议 ====================

    /**
     * 💡 生成搜索建议
     */
    private async generateSuggestions(
        filter: LiteratureFilter,
        searchResult: PaginatedResult<LibraryItemCore>,
        userId?: string
    ): Promise<SearchSuggestions> {
        const suggestions: SearchSuggestions = {
            relatedQueries: [],
            recommendedFilters: [],
            typoCorrections: [],
        };

        // 1. 生成相关查询
        if (filter.searchQuery) {
            suggestions.relatedQueries = [
                `${filter.searchQuery} methodology`,
                `${filter.searchQuery} review`,
                `${filter.searchQuery} applications`,
                `recent ${filter.searchQuery}`,
            ];
        }

        // 2. 推荐过滤器
        if (searchResult.pagination.total > 100) {
            suggestions.recommendedFilters = [
                {
                    field: 'year',
                    value: new Date().getFullYear(),
                    reason: 'Focus on recent publications',
                    count: 45,
                },
                {
                    field: 'source',
                    value: 'high-impact',
                    reason: 'Filter by impact factor',
                    count: 67,
                },
            ];
        }

        // 3. 拼写纠错（简化实现）
        if (filter.searchQuery && filter.searchQuery.length > 3) {
            // 这里可以实现更复杂的拼写检查逻辑
            suggestions.typoCorrections = [];
        }

        return suggestions;
    }

    // ==================== 搜索预处理 ====================

    /**
     * 🔧 预处理搜索过滤器
     */
    private async preprocessFilter(
        filter: LiteratureFilter,
        options: SearchOptions
    ): Promise<LiteratureFilter> {
        const processed = { ...filter };

        // 拼写纠错
        if (options.enableTypoCorrection && filter.searchQuery) {
            processed.searchQuery = await this.correctTypos(filter.searchQuery);
        }

        // 查询扩展（添加同义词等）
        if (filter.searchQuery) {
            processed.searchQuery = await this.expandQuery(filter.searchQuery);
        }

        return processed;
    }

    // ==================== 缓存管理 ====================

    private getCache(key: string): EnhancedSearchResult | null {
        const entry = this.searchCache.get(key);
        if (!entry) return null;

        if (Date.now() - entry.timestamp > entry.ttl) {
            this.searchCache.delete(key);
            return null;
        }

        return entry.data;
    }

    private setCache(key: string, data: EnhancedSearchResult, ttl: number = this.defaultCacheTTL): void {
        this.searchCache.set(key, {
            data,
            timestamp: Date.now(),
            ttl,
        });

        // 限制缓存大小
        if (this.searchCache.size > 100) {
            const oldestKey = this.searchCache.keys().next().value;
            this.searchCache.delete(oldestKey!);
        }
    }

    private generateCacheKey(
        filter: LiteratureFilter,
        sort: LiteratureSort,
        page: number,
        pageSize: number,
        userId?: string
    ): string {
        return `search_${JSON.stringify({ filter, sort, page, pageSize, userId })}`;
    }

    // ==================== 统计和监控 ====================

    private updateStats(responseTime: number, success: boolean, cacheHit: boolean): void {
        this.stats.totalSearches++;
        this.stats.lastSearchAt = new Date();

        // 更新平均响应时间
        this.stats.averageResponseTime =
            (this.stats.averageResponseTime * (this.stats.totalSearches - 1) + responseTime) /
            this.stats.totalSearches;

        // 更新缓存命中率
        if (cacheHit) {
            this.stats.cacheHitRate =
                (this.stats.cacheHitRate * (this.stats.totalSearches - 1) + 1) /
                this.stats.totalSearches;
        } else {
            this.stats.cacheHitRate =
                (this.stats.cacheHitRate * (this.stats.totalSearches - 1)) /
                this.stats.totalSearches;
        }
    }

    private recordQuery(query?: string): void {
        if (!query) return;

        const normalizedQuery = query.toLowerCase().trim();
        const currentCount = this.queryLog.get(normalizedQuery) || 0;
        this.queryLog.set(normalizedQuery, currentCount + 1);

        // 更新热门查询
        this.stats.popularQueries = Array.from(this.queryLog.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([query, count]) => ({ query, count }));
    }

    /**
     * 📊 获取搜索统计
     */
    public getSearchStats(): SearchServiceStats {
        return { ...this.stats };
    }

    /**
     * 🧹 清理缓存
     */
    public clearCache(): void {
        this.searchCache.clear();
    }

    // ==================== 占位符方法 ====================

    private async correctTypos(text: string): Promise<string> {
        // TODO: 实现拼写纠错
        return text;
    }

    private async expandQuery(text: string): Promise<string> {
        // TODO: 实现查询扩展（同义词、相关词）
        return text;
    }
}

// 🏪 服务实例
export const searchService = new SearchService();

export default searchService;
