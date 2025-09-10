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
    useCitationStore,
    useCollectionStore,

    // 存储状态类型
    type LiteratureStoreState,
    type LiteratureStoreActions,
    type CitationStoreState,
    // type CitationStoreActions,
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
import type { LibraryItem, LiteratureSource } from './models';

export interface LiteratureEntryPoint {
    /**
     * 通过DOI添加文献
     */
    addByDOI(doi: string, options?: {
        autoExtractCitations?: boolean;
        addToCollection?: string;
        tags?: string[];
    }): Promise<LibraryItem>;

    /**
     * 通过URL添加文献
     */
    addByURL(url: string, options?: {
        autoExtractCitations?: boolean;
        addToCollection?: string;
        tags?: string[];
    }): Promise<LibraryItem>;

    /**
     * 通过标题和作者手动添加
     */
    addByMetadata(metadata: {
        title: string;
        authors: string[];
        year?: number;
        journal?: string;
        abstract?: string;
        keywords?: string[];
    }, options?: {
        autoExtractCitations?: boolean;
        addToCollection?: string;
        tags?: string[];
    }): Promise<LibraryItem>;

    /**
     * 批量导入文献
     */
    batchImport(entries: Array<{
        type: 'doi' | 'url' | 'metadata';
        data: string | object;
        options?: any;
    }>): Promise<{
        successful: LibraryItem[];
        failed: Array<{ entry: any; error: string }>;
    }>;
}

// =============================================================================
// 🎯 统一数据访问接口: 高级操作和系统管理
// =============================================================================

export interface LiteratureDataAccessAPI {
    // 文献入口点
    readonly entry: LiteratureEntryPoint;

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

    // 数据导出
    exportData(format: 'json' | 'csv' | 'bibtex', options?: any): Promise<string>;

    // 清理
    shutdown(): Promise<void>;
}

// =============================================================================
// 🚪 文献入口点实现
// =============================================================================

class LiteratureEntryPointImpl implements LiteratureEntryPoint {
    constructor(
        private readonly literatureStore = require('./stores').useLiteratureStore(),
        private readonly services = require('./services').literatureDomainServices
    ) { }

    async addByDOI(doi: string, options: {
        autoExtractCitations?: boolean;
        addToCollection?: string;
        tags?: string[];
    } = {}): Promise<LibraryItem> {
        try {
            // 1. 通过DOI获取元数据
            const metadata = await this.services.literature.fetchMetadataByDOI(doi);

            // 2. 创建文献项
            const item = await this.literatureStore.createItem({
                ...metadata,
                doi,
                tags: options.tags || [],
                source: 'doi' as LiteratureSource
            });

            // 3. 可选操作
            if (options.autoExtractCitations) {
                await this.services.citation.extractAndLinkCitations(item.id);
            }

            if (options.addToCollection) {
                const collectionStore = require('./stores').useCollectionStore();
                await collectionStore.addItemToCollection(options.addToCollection, item.id);
            }

            return item;
        } catch (error) {
            console.error('[LiteratureEntry] Failed to add by DOI:', error);
            throw new Error(`Failed to add literature by DOI: ${doi}`);
        }
    }

    async addByURL(url: string, options: {
        autoExtractCitations?: boolean;
        addToCollection?: string;
        tags?: string[];
    } = {}): Promise<LibraryItem> {
        try {
            // 1. 从URL提取元数据
            const metadata = await this.services.literature.fetchMetadataByURL(url);

            // 2. 创建文献项
            const item = await this.literatureStore.createItem({
                ...metadata,
                url,
                tags: options.tags || [],
                source: 'url' as LiteratureSource
            });

            // 3. 可选操作
            if (options.autoExtractCitations) {
                await this.services.citation.extractAndLinkCitations(item.id);
            }

            if (options.addToCollection) {
                const collectionStore = require('./stores').useCollectionStore();
                await collectionStore.addItemToCollection(options.addToCollection, item.id);
            }

            return item;
        } catch (error) {
            console.error('[LiteratureEntry] Failed to add by URL:', error);
            throw new Error(`Failed to add literature by URL: ${url}`);
        }
    }

    async addByMetadata(metadata: {
        title: string;
        authors: string[];
        year?: number;
        journal?: string;
        abstract?: string;
        keywords?: string[];
    }, options: {
        autoExtractCitations?: boolean;
        addToCollection?: string;
        tags?: string[];
    } = {}): Promise<LibraryItem> {
        try {
            // 创建文献项
            const item = await this.literatureStore.createItem({
                title: metadata.title,
                authors: metadata.authors,
                year: metadata.year,
                journal: metadata.journal,
                abstract: metadata.abstract,
                keywords: metadata.keywords || [],
                tags: options.tags || [],
                source: 'manual' as LiteratureSource
            });

            // 可选操作
            if (options.autoExtractCitations && metadata.abstract) {
                await this.services.citation.extractAndLinkCitations(item.id);
            }

            if (options.addToCollection) {
                const collectionStore = require('./stores').useCollectionStore();
                await collectionStore.addItemToCollection(options.addToCollection, item.id);
            }

            return item;
        } catch (error) {
            console.error('[LiteratureEntry] Failed to add by metadata:', error);
            throw new Error(`Failed to add literature by metadata: ${metadata.title}`);
        }
    }

    async batchImport(entries: Array<{
        type: 'doi' | 'url' | 'metadata';
        data: string | object;
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
                    case 'doi':
                        item = await this.addByDOI(entry.data as string, entry.options);
                        break;
                    case 'url':
                        item = await this.addByURL(entry.data as string, entry.options);
                        break;
                    case 'metadata':
                        item = await this.addByMetadata(entry.data as any, entry.options);
                        break;
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
}

// =============================================================================
// 🎯 统一数据访问实现
// =============================================================================

export class LiteratureDataAccess implements LiteratureDataAccessAPI {
    public readonly entry: LiteratureEntryPoint;

    constructor(
        public readonly repositories = require('./repositories').literatureDomainRepositories,
        public readonly services = require('./services').literatureDomainServices,
        public readonly database = require('./database').literatureDB
    ) {
        this.entry = new LiteratureEntryPointImpl();
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
            return await this.services.literature.searchLiterature(query, options);
        } catch (error) {
            console.error('[LiteratureDataAccess] Search failed:', error);
            throw new Error(`Failed to search literature: ${query}`);
        }
    }

    async findSimilarLiterature(itemId: string): Promise<LibraryItem[]> {
        try {
            return await this.services.ai.findSimilarLiterature(itemId);
        } catch (error) {
            console.error('[LiteratureDataAccess] Similar literature search failed:', error);
            throw new Error(`Failed to find similar literature for: ${itemId}`);
        }
    }

    async analyzeCitationNetwork(itemId: string): Promise<any> {
        try {
            return await this.services.citation.analyzeCitationNetwork(itemId);
        } catch (error) {
            console.error('[LiteratureDataAccess] Citation network analysis failed:', error);
            throw new Error(`Failed to analyze citation network for: ${itemId}`);
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
// 🏪 单例实例和便捷导出
// =============================================================================

/**
 * 📚 文献数据访问层单例实例
 * 
 * 使用示例:
 * ```typescript
 * import { literatureDataAccess } from '@/features/literature/data-access';
 * 
 * // 添加文献
 * const item = await literatureDataAccess.entry.addByDOI('10.1000/example');
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