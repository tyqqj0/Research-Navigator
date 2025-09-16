/**
 * 📚 Literature Domain - Data Access Layer API Gateway
 * 
 * 架构: Feature-First + Domain-Driven Design
 * 设计原则: 最小暴露、单一入口、类型安全
 * 
 * 这个文件是文献领域的统一API入口，只暴露必要的接口：
 * - 🏪 Stores: 响应式状态管理 (主要接口)
 * - 📝 Models: 核心类型和验证接口
 * - 🚪 Entry Points: 文献添加和操作入口
 */

// =============================================================================
// 🏪 主要接口: Stores (响应式状态管理)
// =============================================================================

export {
    // 核心存储
    useLiteratureStore,
    useCollectionStore,

    // 存储状态类型
    type LiteratureStoreState,
    type LiteratureStoreActions,
    type CollectionStoreState,
    type CollectionStoreActions
} from './stores';

// =============================================================================
// 📝 核心模型: 选择性导出必要的类型和接口
// =============================================================================

export type {
    // 文献核心类型
    LibraryItem,
    LiteratureSource,
    UserLiteratureMeta,

    // 引用相关
    Citation,
    CitationDegree,
    CitationOverview,

    // 集合相关
    Collection,
    CollectionType,

    // 验证和输入类型
    CreateLibraryItemInput as CreateLiteratureInput,
    UpdateLibraryItemInput as UpdateLiteratureInput,
    CreateCitationInput,
    CreateCollectionInput as CreateCollectionData, // 重命名解决冲突

    // 查询和过滤
    LiteratureFilter,
    UserMetaFilter,
    CollectionType as CollectionFilter,

    // 统计类型
    UserLiteratureStats as LiteratureStats,
    LiteratureStatus,
    ComponentStatus
} from './models';

// =============================================================================
// 🚪 文献添加入口: 便捷的文献导入接口
// =============================================================================

// 导入内部使用的类型
import type {
    LibraryItem,
    LiteratureSource,
    UpdateLibraryItemInput,
    UpdateUserLiteratureMetaInput,
    EnhancedLibraryItem,
    Collection,
    CreateCollectionInput,
    UpdateCollectionInput,
    PaginatedResult,
    CreateComposedLiteratureInput,
    UpdateComposedLiteratureInput,
} from './models';

export interface LiteratureEntryPoint {
    /**
     * 通过统一标识添加文献（S2风格标识）
     * 支持: `S2:<sha>`, `CorpusId:<id>`, `DOI:<doi>`, `ARXIV:<id>`, `MAG:<id>`, `ACL:<id>`, `PMID:<id>`, `PMCID:<id>`, `URL:<url>`
     * 也支持直接传入裸的 DOI 或 URL（将自动规范化为前缀形式）
     */
    addByIdentifier(identifier: string, options?: {
        autoExtractCitations?: boolean;
        addToCollection?: string; // deprecated in favor of addToCollections
        addToCollections?: string[];
        tags?: string[]; // deprecated in favor of userMeta
        userMeta?: Partial<import('./models').CreateUserLiteratureMetaInput> | Partial<import('./models').UpdateUserLiteratureMetaInput>;
    }): Promise<LibraryItem>;

    /**
     * 批量导入文献（仅支持 identifier）
     */
    batchImport(entries: Array<{
        type: 'identifier';
        data: string;
        options?: any;
    }>): Promise<{
        successful: LibraryItem[];
        failed: Array<{ entry: any; error: string }>;
    }>;

    /** 在前端文献库中彻底删除一条文献记录（仅前端本地库，但是并非是从某个集合中移除，请注意区分） */
    deleteLiterature(paperId: string): Promise<boolean>;

    /** 更新文献核心数据（标题、作者、年份等） */
    updateLiterature(paperId: string, updates: UpdateLibraryItemInput): Promise<boolean>;

    /** 更新与用户相关的文献元数据（标签、评分、阅读状态、笔记等） */
    updateUserMeta(paperId: string, updates: UpdateUserLiteratureMetaInput): Promise<boolean>;
}

// =============================================================================
// 🎯 统一数据访问接口: 高级操作和系统管理
// =============================================================================

export interface LiteratureDataAccessAPI {
    // 文献入口点
    readonly entry: LiteratureEntryPoint;

    // 集合子域入口
    readonly collections: CollectionDataAccessAPI;

    // 文献组合入口
    readonly literatures: LiteraturesDataAccessAPI;

    // 系统管理
    initialize(): Promise<{ isHealthy: boolean; initializationTime: number }>;
    performHealthCheck(): Promise<{ overall: boolean; recommendations: string[] }>;
    performMaintenance(): Promise<{ optimizations: string[]; executionTime: number }>;
    generateStatisticsReport(): Promise<{
        overview: any;
        insights: any;
        recommendations: string[];
    }>;

    // 高级查询
    searchLiterature(query: string, options?: any): Promise<LibraryItem[]>;
    findSimilarLiterature(itemId: string): Promise<LibraryItem[]>;
    analyzeCitationNetwork(itemId: string): Promise<any>;
    getInternalCitations(
        paperIds: string[],
        options?: { direction?: 'out' | 'in' | 'both'; includeStats?: boolean }
    ): Promise<{ edges: Array<{ source: string; target: string }>; stats?: { totalEdges: number; totalNodes: number; density: number; averageDegree: number } }>;

    // 数据导出
    exportData(format: 'json' | 'csv' | 'bibtex', options?: any): Promise<string>;

    // 清理
    shutdown(): Promise<void>;
}

// =============================================================================
// 📂 集合数据访问接口
// =============================================================================

export interface CollectionDataAccessAPI {
    createCollection(input: CreateCollectionInput): Promise<Collection>;
    updateCollection(id: string, input: UpdateCollectionInput): Promise<Collection>;
    deleteCollection(id: string): Promise<void>;

    addItemsToCollection(collectionId: string, paperIds: string[]): Promise<void>;
    removeItemsFromCollection(collectionId: string, paperIds: string[]): Promise<void>;

    getUserCollections(options?: { page?: number; pageSize?: number }): Promise<Collection[]>;
    getCollection(id: string): Promise<Collection | null>;
    searchCollections(params: {
        searchTerm?: string;
        type?: import('./models').CollectionType;
        isPublic?: boolean;
        hasItems?: boolean;
        page?: number;
        pageSize?: number;
    }): Promise<{ items: Collection[]; total: number; page: number; totalPages: number; hasMore: boolean }>;
}

// =============================================================================
// 📚 文献组合数据访问接口
// =============================================================================

export interface LiteraturesDataAccessAPI {
    create(input: CreateComposedLiteratureInput): Promise<EnhancedLibraryItem>;
    update(paperId: string, input: UpdateComposedLiteratureInput): Promise<EnhancedLibraryItem>;
    delete(paperId: string, options?: { deleteGlobally?: boolean }): Promise<void>;
    deleteBatch(requests: Array<{ paperId: string; deleteGlobally?: boolean }>): Promise<{ success: string[]; failed: Array<{ paperId: string; error: string }>; total: number }>;
    getUserLiteratures(): Promise<EnhancedLibraryItem[]>;
    getEnhanced(paperId: string): Promise<EnhancedLibraryItem | null>;
    search(filter?: import('./models').LiteratureFilter, sort?: import('./models').LiteratureSort, page?: number, pageSize?: number): Promise<PaginatedResult<EnhancedLibraryItem>>;
}

// =============================================================================
// 🚪 文献入口点实现
// =============================================================================

class LiteratureEntryPointImpl implements LiteratureEntryPoint {
    constructor(
        private readonly services = require('./services').literatureDomainServices,
        // private readonly repositories = require('./repositories').literatureDomainRepositories,
        private readonly composition = require('./services').literatureDomainServices.composition,
        private readonly authUtils = require('../../../stores/auth.store').authStoreUtils
    ) { }

    private normalizeIdentifier(raw: string): { normalized: string; encoded: string } {
        const v = (raw || '').trim();
        const hasPrefix = /^(S2:|CorpusId:|DOI:|ARXIV:|MAG:|ACL:|PMID:|PMCID:|URL:)/i.test(v);
        let normalized = v;
        if (!hasPrefix) {
            if (/^https?:\/\//i.test(v)) {
                normalized = `URL:${v}`;
            } else if (/^10\.\S+\/\S+/.test(v)) {
                normalized = `DOI:${v}`;
            } else {
                // 默认走 S2 标识
                normalized = v
            }
        }
        return { normalized, encoded: encodeURIComponent(normalized) };
    }

    // 公共helper导出
    public static normalizeIdentifierHelper(raw: string): { normalized: string; encoded: string } {
        const v = (raw || '').trim();
        const hasPrefix = /^(S2:|CorpusId:|DOI:|ARXIV:|MAG:|ACL:|PMID:|PMCID:|URL:)/i.test(v);
        let normalized = v;
        if (!hasPrefix) {
            if (/^https?:\/\//i.test(v)) {
                normalized = `URL:${v}`;
            } else if (/^10\.\S+\/\S+/.test(v)) {
                normalized = `DOI:${v}`;
            } else {
                normalized = `S2:${v}`;
            }
        }
        return { normalized, encoded: encodeURIComponent(normalized) };
    }

    async addByIdentifier(identifier: string, options: {
        autoExtractCitations?: boolean;
        addToCollection?: string;
        addToCollections?: string[];
        tags?: string[];
        userMeta?: Partial<import('./models').CreateUserLiteratureMetaInput> | Partial<import('./models').UpdateUserLiteratureMetaInput>;
    } = {}): Promise<LibraryItem> {
        try {
            const { normalized, encoded } = this.normalizeIdentifier(identifier);

            // 1) 直接使用详细信息接口（兼容更多后端实现）
            // 对于带斜杠的标识（DOI/URL），需要编码；S2/CorpusId 等可以直接使用原始形式
            const idForPath = /^(DOI:|URL:)/i.test(normalized) ? encoded : normalized;
            const searchRes = await this.services.backend.getPaper(idForPath);
            const paper = searchRes;
            if (!paper) throw new Error('No paper found for identifier');

            // 2) 如果已存在则直接返回已存在项，避免重复报错
            try {
                const existing = await this.services.literature.getLiterature(paper.paperId);
                if (existing) {
                    // 同步到 Store（确保出现于列表）
                    try {
                        const enhanced = await this.composition.getEnhancedLiterature(paper.paperId);
                        if (enhanced) {
                            const literatureStore = require('./stores').useLiteratureStore;
                            (literatureStore as any).getState().addLiterature(enhanced as EnhancedLibraryItem);
                        }
                    } catch { }
                    return existing;
                }
            } catch { }

            // 3) 构造创建输入并创建（含可选的完整用户元数据）
            const refs = paper?.parsedContent?.extractedReferences;
            const pc = paper?.parsedContent as any;
            console.log('[LiteratureEntry] addByIdentifier refs from backend:', Array.isArray(refs) ? refs.length : 0);
            const created = await this.composition.createComposedLiterature({
                literature: {
                    paperId: paper.paperId, // 使用后端返回的原生ID（S2/CorpusId/DOI/URL）
                    title: paper.title,
                    authors: paper.authors || [],
                    year: paper.year,
                    publication: paper.publication || undefined,
                    abstract: paper.abstract || undefined,
                    summary: paper.summary || undefined,
                    doi: paper.doi || undefined,
                    url: paper.url || undefined,
                    pdfPath: paper.pdfPath || undefined,
                    source: 'search',
                    // 传递后端的 parsedContent（如果存在），避免只保留 refs
                    parsedContent: pc && typeof pc === 'object' ? pc : (refs && Array.isArray(refs) ? { extractedReferences: refs as any } : undefined),
                },
                userMeta: options.userMeta
                    ? { ...options.userMeta, tags: options.userMeta.tags || options.tags || [] }
                    : (options.tags && options.tags.length ? { tags: options.tags } : undefined),
            });

            // 4) 可选：加入一个或多个集合
            const collectionIds = [
                ...(options.addToCollections || []),
                ...(options.addToCollection ? [options.addToCollection] : [])
            ];
            if (collectionIds.length) {
                const userId = this.authUtils.getStoreInstance().requireAuth();
                for (const cid of collectionIds) {
                    try {
                        await this.services.collection.addLiteratureToCollection(cid, [created.literature.paperId], userId);
                        // 本地 CollectionStore 同步
                        try {
                            const collectionStore = require('./stores').useCollectionStore;
                            (collectionStore as any).getState().addLiteraturesToCollection(cid, [created.literature.paperId]);
                        } catch (e) {
                            console.warn('[LiteratureEntry] Failed to sync to CollectionStore', cid, e);
                        }
                    } catch (e) {
                        console.warn('[LiteratureEntry] Failed to add to collection', cid, e);
                    }
                }
            }

            // 5) 同步到本地 Store（文献）
            try {
                const literatureStore = require('./stores').useLiteratureStore;
                (literatureStore as any).getState().addLiterature(created as EnhancedLibraryItem);
            } catch (e) {
                console.warn('[LiteratureEntry] Failed to sync to LiteratureStore', e);
            }

            // 注：autoExtractCitations 为只读关系，暂不在前端写入

            return created.literature as LibraryItem;
        } catch (error) {
            console.error('[LiteratureEntry] Failed to add by identifier:', error);
            throw new Error(`添加失败：${identifier}。${error instanceof Error ? error.message : ''}`);
        }
    }

    // 旧的 addByDOI/addByURL/addByMetadata 已移除，统一使用 addByIdentifier；
    // 手动元数据请通过 batchImport 的 metadata 类型传入

    async batchImport(entries: Array<{
        type: 'identifier';
        data: string;
        options?: any;
    }>): Promise<{
        successful: LibraryItem[];
        failed: Array<{ entry: any; error: string }>;
    }> {
        const successful: LibraryItem[] = [];
        const failed: Array<{ entry: any; error: string }> = [];

        for (const entry of entries) {
            try {
                let item: LibraryItem;

                switch (entry.type) {
                    case 'identifier': {
                        item = await this.addByIdentifier(entry.data as string, entry.options);
                        break;
                    }
                    default:
                        throw new Error(`Unsupported entry type: ${entry.type}`);
                }

                successful.push(item);
            } catch (error) {
                failed.push({
                    entry,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }

        return { successful, failed };
    }

    async deleteLiterature(paperId: string): Promise<boolean> {
        try {
            const res = await this.services.literature.deleteLiterature(paperId, { cascadeDelete: true });
            const ok = !!res?.success;

            // 同步到本地 Store（文献）
            if (ok) {
                try {
                    const literatureStore = require('./stores').useLiteratureStore;
                    (literatureStore as any).getState().removeLiterature(paperId);
                } catch (e) {
                    console.warn('[LiteratureEntry] Failed to sync deletion to LiteratureStore', e);
                }

                // 同步到本地 Store（集合：从所有集合移除该文献）
                try {
                    const collectionStore = require('./stores').useCollectionStore;
                    const state = (collectionStore as any).getState();
                    const allCollections = state.getAllCollections();
                    allCollections.forEach((c: any) => state.removeLiteratureFromCollection(c.id, paperId));
                } catch (e) {
                    console.warn('[LiteratureEntry] Failed to sync deletion to CollectionStore', e);
                }
            }

            return ok;
        } catch (error) {
            console.error('[LiteratureEntry] Failed to delete literature:', error);
            return false;
        }
    }

    async updateLiterature(paperId: string, updates: UpdateLibraryItemInput): Promise<boolean> {
        try {
            await this.services.literature.updateLiterature(paperId, updates);

            // 获取增强后的文献并同步到 Store
            try {
                const enhanced = await this.composition.getEnhancedLiterature(paperId);
                if (enhanced) {
                    const literatureStore = require('./stores').useLiteratureStore;
                    (literatureStore as any).getState().updateLiterature(paperId, enhanced as EnhancedLibraryItem);
                }
            } catch (e) {
                console.warn('[LiteratureEntry] Failed to sync update to LiteratureStore', e);
            }

            return true;
        } catch (error) {
            console.error('[LiteratureEntry] Failed to update literature:', error);
            return false;
        }
    }

    async updateUserMeta(paperId: string, updates: UpdateUserLiteratureMetaInput): Promise<boolean> {
        try {
            // 使用组合服务更新并拿到增强结果，便于同步 Store
            const enhanced = await this.composition.updateUserMeta(paperId, updates);

            try {
                const literatureStore = require('./stores').useLiteratureStore;
                (literatureStore as any).getState().updateLiterature(paperId, enhanced as EnhancedLibraryItem);
            } catch (e) {
                console.warn('[LiteratureEntry] Failed to sync userMeta update to LiteratureStore', e);
            }

            return !!enhanced;
        } catch (error) {
            console.error('[LiteratureEntry] Failed to update user meta:', error);
            return false;
        }
    }
}

// =============================================================================
// 🎯 统一数据访问实现
// =============================================================================

export class LiteratureDataAccess implements LiteratureDataAccessAPI {
    public readonly entry: LiteratureEntryPoint;
    public readonly collections: CollectionDataAccessAPI;
    public readonly literatures: LiteraturesDataAccessAPI;

    constructor(
        private readonly repositories = require('./repositories').literatureDomainRepositories,
        private readonly services = require('./services').literatureDomainServices,
        private readonly database = require('./database').literatureDB
    ) {
        this.entry = new LiteratureEntryPointImpl();
        this.collections = new CollectionDataAccessImpl();
        this.literatures = new LiteraturesDataAccessImpl();
    }

    // =============================================================================
    // 🚀 系统管理方法
    // =============================================================================

    async initialize(): Promise<{ isHealthy: boolean; initializationTime: number }> {
        const startTime = Date.now();

        try {
            console.log('[LiteratureDataAccess] Initializing data access layer...');

            // 1. 数据库健康检查
            const dbHealth = await this.database.healthCheck();

            // 2. 仓储层健康检查
            const repoHealth = await this.repositories.getHealthStatus();

            // 3. 服务层初始化（无返回值）
            await this.services.initialize();

            const isHealthy = dbHealth.isHealthy && repoHealth.isHealthy;
            const initializationTime = Date.now() - startTime;

            console.log('[LiteratureDataAccess] Data access layer initialized:', { isHealthy, initializationTime });
            return { isHealthy, initializationTime };
        } catch (error) {
            console.error('[LiteratureDataAccess] Initialization failed:', error);
            throw new Error('Failed to initialize literature data access layer');
        }
    }

    async performHealthCheck(): Promise<{ overall: boolean; recommendations: string[] }> {
        const recommendations: string[] = [];

        try {
            const [dbHealth, repoHealth, serviceStatus] = await Promise.all([
                this.database.healthCheck(),
                this.repositories.getHealthStatus(),
                this.services.getServiceStatus()
            ]);

            // 分析健康状态并生成建议
            if (!dbHealth.isHealthy) {
                recommendations.push('Database connection issues detected');
            }

            if (dbHealth.stats.libraries === 0) {
                recommendations.push('No literature data found - consider importing initial dataset');
            }

            if (repoHealth.totalRecords.citation === 0 && repoHealth.totalRecords.literature > 10) {
                recommendations.push('No citations found - consider running citation linking');
            }

            const overall = dbHealth.isHealthy && repoHealth.isHealthy && serviceStatus.overall;

            return { overall, recommendations };
        } catch (error) {
            console.error('[LiteratureDataAccess] Health check failed:', error);
            return {
                overall: false,
                recommendations: ['Health check system failure', ...recommendations]
            };
        }
    }

    async performMaintenance(): Promise<{ optimizations: string[]; executionTime: number }> {
        const startTime = Date.now();
        const optimizations: string[] = [];

        try {
            console.log('[LiteratureDataAccess] Starting comprehensive maintenance...');

            // 1. 数据库维护
            const dbMaintenance = await this.database.performMaintenance();
            if (dbMaintenance.orphanedUserMetas > 0 || dbMaintenance.orphanedCitations > 0) {
                optimizations.push(`Cleaned ${dbMaintenance.orphanedUserMetas + dbMaintenance.orphanedCitations} orphaned records`);
            }

            // 2. 仓储层维护
            const repoMaintenance = await this.repositories.performMaintenance();
            if (repoMaintenance.duplicateLiterature > 0) {
                optimizations.push(`Removed ${repoMaintenance.duplicateLiterature} duplicate literature items`);
            }

            // 3. 服务层智能维护
            const serviceMaintenance = await this.services.performIntelligentMaintenance();
            optimizations.push(...serviceMaintenance.recommendations);

            const executionTime = Date.now() - startTime;

            console.log('[LiteratureDataAccess] Comprehensive maintenance completed:', { optimizations, executionTime });
            return { optimizations, executionTime };
        } catch (error) {
            console.error('[LiteratureDataAccess] Maintenance failed:', error);
            throw new Error('Failed to perform maintenance');
        }
    }

    async generateStatisticsReport(): Promise<{
        overview: any;
        insights: any;
        recommendations: string[];
    }> {
        try {
            console.log('[LiteratureDataAccess] Generating comprehensive statistics report...');

            const [dbHealth, domainStats] = await Promise.all([
                this.database.healthCheck(),
                this.repositories.getDomainStatistics(),
            ]);

            const recommendations: string[] = [];

            // 生成洞察和建议
            if (dbHealth.stats.libraries.total < 100) {
                recommendations.push('Consider importing more literature for better AI insights');
            }

            if (dbHealth.stats.citations.total === 0) {
                recommendations.push('No citation network - run citation linking to discover relationships');
            }

            return {
                overview: dbHealth.stats,
                insights: {
                    mostCitedLiterature: [],
                    citationNetworkStats: {},
                },
                recommendations
            };
        } catch (error) {
            console.error('[LiteratureDataAccess] Statistics report generation failed:', error);
            throw new Error('Failed to generate statistics report');
        }
    }

    // =============================================================================
    // 🔍 高级查询方法
    // =============================================================================

    async searchLiterature(query: string, options: any = {}): Promise<LibraryItem[]> {
        try {
            const backend = this.services.backend;
            const res = await backend.searchPapers({ query, limit: options.limit || 20, offset: options.offset || 0 });
            return res.results || [];
        } catch (error) {
            console.error('[LiteratureDataAccess] Search failed:', error);
            throw new Error(`Failed to search literature: ${query}`);
        }
    }

    async findSimilarLiterature(itemId: string): Promise<LibraryItem[]> {
        try {
            // 简化：基于标题近似搜索
            const item = await this.repositories.literature.findByLid(itemId);
            if (!item) return [];
            const result = await this.repositories.literature.findByTitleSimilar(item.title, 0.6, 10);
            return result.filter((lit: LibraryItem) => lit.paperId !== itemId);
        } catch (error) {
            console.error('[LiteratureDataAccess] Similar literature search failed:', error);
            throw new Error(`Failed to find similar literature for: ${itemId}`);
        }
    }

    async analyzeCitationNetwork(itemId: string): Promise<any> {
        try {
            // 使用现有的网络获取函数（基于起点）
            return await this.services.citation.getCitationNetwork([itemId], 2, true);
        } catch (error) {
            console.error('[LiteratureDataAccess] Citation network analysis failed:', error);
            throw new Error(`Failed to analyze citation network for: ${itemId}`);
        }
    }

    async getInternalCitations(
        paperIds: string[],
        options: { direction?: 'out' | 'in' | 'both'; includeStats?: boolean } = {}
    ): Promise<{ edges: Array<{ source: string; target: string }>; stats?: { totalEdges: number; totalNodes: number; density: number; averageDegree: number } }> {
        try {
            const result = await this.services.citation.getInternalCitations(paperIds, options);
            return result;
        } catch (error) {
            console.error('[LiteratureDataAccess] getInternalCitations failed:', error);
            throw new Error('Failed to get internal citations');
        }
    }

    // =============================================================================
    // 📤 数据导出方法
    // =============================================================================

    async exportData(format: 'json' | 'csv' | 'bibtex', options: any = {}): Promise<string> {
        try {
            // 简化：直接从仓储中导出基本JSON
            const items = await this.repositories.literature.findAll();
            if (format === 'json') {
                return JSON.stringify(items);
            }
            if (format === 'csv') {
                const header = 'paperId,title,year\n';
                const rows = items.map((i: any) => `${i.paperId},"${(i.title || '').replace(/"/g, '""')}",${i.year || ''}`).join('\n');
                return header + rows;
            }
            if (format === 'bibtex') {
                const entries = items.map((i: any) => `@article{${i.paperId},\n  title={${i.title}},\n  year={${i.year || ''}}\n}`).join('\n\n');
                return entries;
            }
            throw new Error(`Unsupported export format: ${format}`);
        } catch (error) {
            console.error('[LiteratureDataAccess] Data export failed:', error);
            throw new Error(`Failed to export data in ${format} format`);
        }
    }

    async shutdown(): Promise<void> {
        try {
            console.log('[LiteratureDataAccess] Shutting down data access layer...');

            // 清理服务层资源
            await this.services.cleanup();

            // 关闭数据库连接
            if (this.database.close) {
                await this.database.close();
            }

            console.log('[LiteratureDataAccess] Data access layer shutdown completed');
        } catch (error) {
            console.error('[LiteratureDataAccess] Shutdown failed:', error);
            throw new Error('Failed to shutdown data access layer');
        }
    }
}

// =============================================================================
// 📂 集合数据访问实现
// =============================================================================

class CollectionDataAccessImpl implements CollectionDataAccessAPI {
    constructor(
        private readonly services = require('./services').literatureDomainServices,
        private readonly repositories = require('./repositories').literatureDomainRepositories,
        private readonly authUtils = require('../../../stores/auth.store').authStoreUtils
    ) { }

    private requireUserId(): string {
        return this.authUtils.getStoreInstance().requireAuth();
    }

    async createCollection(input: CreateCollectionInput): Promise<Collection> {
        const userId = this.requireUserId();
        const payload: CreateCollectionInput = { ...input, ownerUid: input.ownerUid || userId } as CreateCollectionInput;
        return await this.services.collection.createCollection(userId, payload);
    }

    async updateCollection(id: string, input: UpdateCollectionInput): Promise<Collection> {
        const userId = this.requireUserId();
        return await this.services.collection.updateCollection(id, userId, input);
    }

    async deleteCollection(id: string): Promise<void> {
        const userId = this.requireUserId();
        await this.services.collection.deleteCollection(id, userId);
    }

    async addItemsToCollection(collectionId: string, paperIds: string[]): Promise<void> {
        const userId = this.requireUserId();
        await this.services.collection.addLiteratureToCollection(collectionId, paperIds, userId);
    }

    async removeItemsFromCollection(collectionId: string, paperIds: string[]): Promise<void> {
        const userId = this.requireUserId();
        await this.services.collection.removeLiteratureFromCollection(collectionId, paperIds, userId);
    }

    async getUserCollections(options: { page?: number; pageSize?: number } = {}): Promise<Collection[]> {
        const userId = this.requireUserId();
        const page = options.page || 1;
        const pageSize = options.pageSize || 100;
        const result = await this.services.collection.queryCollections(
            { ownerUid: userId },
            { field: 'createdAt', order: 'desc' },
            page,
            pageSize
        );
        return result.items;
    }

    async getCollection(id: string): Promise<Collection | null> {
        const c = await this.repositories.collection.findById(id);
        return c || null;
    }

    async searchCollections(params: {
        searchTerm?: string;
        type?: import('./models').CollectionType;
        isPublic?: boolean;
        hasItems?: boolean;
        page?: number;
        pageSize?: number;
    }): Promise<{ items: Collection[]; total: number; page: number; totalPages: number; hasMore: boolean }> {
        const userId = this.requireUserId();
        const page = params.page || 1;
        const pageSize = params.pageSize || 20;

        const result = await this.services.collection.queryCollections(
            {
                ownerUid: userId,
                type: params.type,
                isPublic: params.isPublic,
                hasItems: params.hasItems,
                searchTerm: params.searchTerm,
            },
            { field: 'createdAt', order: 'desc' },
            page,
            pageSize
        );

        const hasMore = result.page < result.totalPages;
        return { ...result, hasMore };
    }
}

// =============================================================================
// 📚 文献组合数据访问实现
// =============================================================================

class LiteraturesDataAccessImpl implements LiteraturesDataAccessAPI {
    constructor(
        private readonly services = require('./services').literatureDomainServices.composition
    ) { }

    async create(input: CreateComposedLiteratureInput): Promise<EnhancedLibraryItem> {
        return await this.services.createComposedLiterature(input);
    }

    async update(paperId: string, input: UpdateComposedLiteratureInput): Promise<EnhancedLibraryItem> {
        return await this.services.updateComposedLiterature(paperId, input);
    }

    async delete(paperId: string, options: { deleteGlobally?: boolean } = {}): Promise<void> {
        await this.services.deleteComposedLiterature(paperId, options);
    }

    async deleteBatch(requests: Array<{ paperId: string; deleteGlobally?: boolean }>): Promise<{ success: string[]; failed: Array<{ paperId: string; error: string }>; total: number }> {
        return await this.services.deleteComposedLiteratureBatch(requests);
    }

    async getUserLiteratures(): Promise<EnhancedLibraryItem[]> {
        return await this.services.getUserComposedLiteratures();
    }

    async getEnhanced(paperId: string): Promise<EnhancedLibraryItem | null> {
        return await this.services.getEnhancedLiterature(paperId);
    }

    async search(
        filter: import('./models').LiteratureFilter = {},
        sort: import('./models').LiteratureSort = { field: 'createdAt', order: 'desc' },
        page: number = 1,
        pageSize: number = 20
    ): Promise<PaginatedResult<EnhancedLibraryItem>> {
        return await this.services.searchEnhancedLiteratures(filter, sort, page, pageSize);
    }
}

// =============================================================================
// 🏪 单例实例和便捷导出
// =============================================================================

/**
 * 📚 文献数据访问层单例实例
 * 
 * 使用示例:
 * ```typescript
 * import { literatureDataAccess } from '@/features/literature/data-access';
 * 
 * // 添加文献（统一标识）
 * const item = await literatureDataAccess.entry.addByIdentifier('10.1000/example');
 * 
 * // 搜索文献
 * const results = await literatureDataAccess.searchLiterature('machine learning');
 * 
 * // 系统管理
 * const health = await literatureDataAccess.performHealthCheck();
 * ```
 */
export const literatureDataAccess = new LiteratureDataAccess();

/**
 * 🚪 便捷的文献入口点 - 直接导出以简化使用
 */
export const literatureEntry = literatureDataAccess.entry;

/**
 * 🔧 Helper: 规范化文献标识
 */
export const normalizeLiteratureIdentifier = (raw: string) =>
    (LiteratureEntryPointImpl as any).normalizeIdentifierHelper(raw);