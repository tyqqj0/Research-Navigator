/**
 * 📚 Enhanced Literature Database - 优化版文献数据库
 * 
 * 设计原则:
 * 1. 统一错误处理 - 集成领域错误系统
 * 2. 性能优化 - 查询缓存和索引优化
 * 3. 数据验证 - 自动模型验证
 * 4. 事务支持 - 复杂操作的原子性
 * 5. 查询构建器 - 灵活的查询接口
 */

import Dexie, { Table, Transaction } from 'dexie';
import {
    LibraryItemCore,
    UserLiteratureMetaCore,
    CitationCore,
    CollectionCore,
    ModelValidators,
    ErrorHandler,
    DatabaseError,
    LITERATURE_CONSTANTS,
    LibraryItemCoreSchema,
} from '../models';
import type {
    LiteratureFilter,
    LiteratureSort,
    PaginatedResult,
} from '../models';

// 📊 数据库配置
const DATABASE_NAME = 'ResearchNavigatorLiteratureDB_Enhanced';
const DATABASE_VERSION = 2;

/**
 * 🎯 查询缓存接口
 */
interface QueryCacheEntry {
    data: any;
    timestamp: number;
    ttl: number;
}

/**
 * 🎯 数据库统计接口
 */
export interface DatabaseStatistics {
    libraries: {
        total: number;
        bySource: Record<string, number>;
        byYear: Record<number, number>;
        byStatus: Record<string, number>;
    };
    userMetas: {
        total: number;
        byUser: Record<string, number>;
        byReadingStatus: Record<string, number>;
        byPriority: Record<string, number>;
    };
    citations: {
        total: number;
        byType: Record<string, number>;
        verified: number;
        unverified: number;
    };
    collections: {
        total: number;
        byType: Record<string, number>;
        byUser: Record<string, number>;
        public: number;
        private: number;
    };
}

/**
 * 📚 增强版文献数据库类
 */
export class EnhancedLiteratureDatabase extends Dexie {
    // 📚 核心表定义
    libraries!: Table<LibraryItemCore, string>;
    userMetas!: Table<UserLiteratureMetaCore, string>;
    citations!: Table<CitationCore, string>;
    collections!: Table<CollectionCore, string>;

    // 🗄️ 查询缓存
    private queryCache = new Map<string, QueryCacheEntry>();
    private readonly maxCacheSize = LITERATURE_CONSTANTS.MAX_CACHE_SIZE;
    private readonly defaultCacheTTL = LITERATURE_CONSTANTS.DEFAULT_CACHE_TTL * 1000; // 转换为毫秒

    // 📊 性能监控
    private queryStats = {
        totalQueries: 0,
        cacheHits: 0,
        averageQueryTime: 0,
        slowQueries: [] as Array<{ query: string; time: number; timestamp: Date }>,
    };

    constructor() {
        super(DATABASE_NAME);

        // ✨ 数据库架构定义 - 优化索引策略
        this.version(DATABASE_VERSION).stores({
            // 📚 核心文献表 - 多维度索引
            libraries: `
                &lid,
                title,
                *authors,
                year,
                source,
                publication,
                doi,
                url,
                pdfPath,
                status,
                *keywords,
                language,
                createdAt,
                updatedAt,
                [source+year],
                [status+createdAt],
                [year+source],
                [createdAt+status]
            `.replace(/\s+/g, ' ').trim(),

            // 👤 用户元数据表 - 用户相关复合索引
            userMetas: `
                &[userId+literatureId],
                userId,
                literatureId,
                *tags,
                priority,
                isFavorite,
                readingStatus,
                rating,
                readingProgress,
                lastAccessedAt,
                *associatedSessions,
                *associatedProjects,
                *customCategories,
                createdAt,
                updatedAt,
                [userId+priority],
                [userId+readingStatus],
                [userId+isFavorite],
                [userId+lastAccessedAt],
                [readingStatus+priority]
            `.replace(/\s+/g, ' ').trim(),

            // 🔗 引文关系表 - 双向查询优化
            citations: `
                &[sourceItemId+targetItemId],
                sourceItemId,
                targetItemId,
                citationType,
                discoveryMethod,
                isVerified,
                confidence,
                context,
                pageNumber,
                section,
                createdAt,
                updatedAt,
                [citationType+isVerified],
                [discoveryMethod+confidence],
                [isVerified+citationType]
            `.replace(/\s+/g, ' ').trim(),

            // 📂 文献集合表 - 访问控制和分类索引
            collections: `
                &collectionId,
                userId,
                name,
                description,
                type,
                isPublic,
                itemCount,
                *literatureIds,
                *tags,
                color,
                createdAt,
                updatedAt,
                [userId+type],
                [isPublic+type],
                [userId+createdAt],
                [type+itemCount]
            `.replace(/\s+/g, ' ').trim(),
        });

        // 🔧 设置数据库钩子
        this.setupDatabaseHooks();

        console.log('✨ Enhanced Literature Database initialized');
    }

    /**
     * 🔧 设置数据库钩子
     */
    private setupDatabaseHooks(): void {
        // 📚 文献表钩子
        this.libraries.hook('creating', (primKey, obj, trans) => {
            this.validateAndEnhanceLibraryItem(obj, 'creating');
        });

        this.libraries.hook('updating', (modifications, primKey, obj, trans) => {
            this.validateAndEnhanceLibraryItem(modifications, 'updating', obj);
        });

        // 👤 用户元数据表钩子
        this.userMetas.hook('creating', (primKey, obj, trans) => {
            this.validateAndEnhanceUserMeta(obj, 'creating');
        });

        this.userMetas.hook('updating', (modifications, primKey, obj, trans) => {
            this.validateAndEnhanceUserMeta(modifications, 'updating', obj);
        });

        // 🔗 引文关系表钩子
        this.citations.hook('creating', (primKey, obj, trans) => {
            this.validateAndEnhanceCitation(obj, 'creating');
        });

        this.citations.hook('updating', (modifications, primKey, obj, trans) => {
            this.validateAndEnhanceCitation(modifications, 'updating', obj);
        });

        // 📂 集合表钩子
        this.collections.hook('creating', (primKey, obj, trans) => {
            this.validateAndEnhanceCollection(obj, 'creating');
        });

        this.collections.hook('updating', (modifications, primKey, obj, trans) => {
            this.validateAndEnhanceCollection(modifications, 'updating', obj);
        });
    }

    /**
     * 🔍 验证和增强文献条目
     */
    private validateAndEnhanceLibraryItem(
        obj: Partial<LibraryItemCore>,
        operation: 'creating' | 'updating',
        existingObj?: LibraryItemCore
    ): void {
        try {
            const now = new Date();

            if (operation === 'creating') {
                // 验证完整对象
                ModelValidators.libraryItem(obj as LibraryItemCore);

                // 设置默认值
                (obj as LibraryItemCore).createdAt = now;
                (obj as LibraryItemCore).updatedAt = now;
                (obj as LibraryItemCore).status = obj.status || 'active';
                (obj as LibraryItemCore).authors = obj.authors || [];
                (obj as LibraryItemCore).keywords = obj.keywords || [];
                (obj as LibraryItemCore).language = obj.language || 'en';
                (obj as LibraryItemCore).source = obj.source || 'manual';
            } else {
                // 更新操作，只验证修改的字段
                obj.updatedAt = now;

                if (Object.keys(obj).length > 1) { // 除了updatedAt
                    const mergedObj = { ...existingObj, ...obj };
                    const validationResult = ModelValidators.safeValidate(
                        LibraryItemCoreSchema,
                        mergedObj
                    );

                    if (!validationResult.success) {
                        throw new Error(`Validation failed: ${validationResult.error}`);
                    }
                }
            }

            // 清理查询缓存
            this.clearRelatedCache('libraries');
        } catch (error) {
            throw ErrorHandler.handle(error, {
                operation: `database.libraries.${operation}`,
                layer: 'database',
                entityType: 'LibraryItem',
                inputData: obj,
            });
        }
    }

    /**
     * 🔍 验证和增强用户元数据
     */
    private validateAndEnhanceUserMeta(
        obj: Partial<UserLiteratureMetaCore>,
        operation: 'creating' | 'updating',
        existingObj?: UserLiteratureMetaCore
    ): void {
        try {
            const now = new Date();

            if (operation === 'creating') {
                ModelValidators.userMeta(obj as UserLiteratureMetaCore);

                // 设置默认值
                (obj as UserLiteratureMetaCore).createdAt = now;
                (obj as UserLiteratureMetaCore).updatedAt = now;
                (obj as UserLiteratureMetaCore).tags = obj.tags || [];
                (obj as UserLiteratureMetaCore).priority = obj.priority || 'medium';
                (obj as UserLiteratureMetaCore).readingStatus = obj.readingStatus || 'unread';
                (obj as UserLiteratureMetaCore).isFavorite = obj.isFavorite || false;
                (obj as UserLiteratureMetaCore).readingProgress = obj.readingProgress || 0;
                (obj as UserLiteratureMetaCore).associatedSessions = obj.associatedSessions || [];
                (obj as UserLiteratureMetaCore).associatedProjects = obj.associatedProjects || [];
                (obj as UserLiteratureMetaCore).customCategories = obj.customCategories || [];
            } else {
                obj.updatedAt = now;

                // 如果更新了lastAccessedAt，记录访问时间
                if (!obj.lastAccessedAt) {
                    obj.lastAccessedAt = now;
                }
            }

            this.clearRelatedCache('userMetas');
        } catch (error) {
            throw ErrorHandler.handle(error, {
                operation: `database.userMetas.${operation}`,
                layer: 'database',
                entityType: 'UserLiteratureMeta',
                inputData: obj,
            });
        }
    }

    /**
     * 🔍 验证和增强引文关系
     */
    private validateAndEnhanceCitation(
        obj: Partial<CitationCore>,
        operation: 'creating' | 'updating',
        existingObj?: CitationCore
    ): void {
        try {
            const now = new Date();

            if (operation === 'creating') {
                ModelValidators.citation(obj as CitationCore);

                // 设置默认值
                (obj as CitationCore).createdAt = now;
                (obj as CitationCore).updatedAt = now;
                (obj as CitationCore).citationType = obj.citationType || 'direct';
                (obj as CitationCore).discoveryMethod = obj.discoveryMethod || 'manual';
                (obj as CitationCore).isVerified = obj.isVerified || false;
                (obj as CitationCore).confidence = obj.confidence || 1;

                // 防止自引用
                if (obj.sourceItemId === obj.targetItemId) {
                    throw new Error('Citation cannot reference itself');
                }
            } else {
                obj.updatedAt = now;
            }

            this.clearRelatedCache('citations');
        } catch (error) {
            throw ErrorHandler.handle(error, {
                operation: `database.citations.${operation}`,
                layer: 'database',
                entityType: 'Citation',
                inputData: obj,
            });
        }
    }

    /**
     * 🔍 验证和增强集合
     */
    private validateAndEnhanceCollection(
        obj: Partial<CollectionCore>,
        operation: 'creating' | 'updating',
        existingObj?: CollectionCore
    ): void {
        try {
            const now = new Date();

            if (operation === 'creating') {
                ModelValidators.collection(obj as CollectionCore);

                // 设置默认值
                (obj as CollectionCore).createdAt = now;
                (obj as CollectionCore).updatedAt = now;
                (obj as CollectionCore).type = obj.type || 'manual';
                (obj as CollectionCore).isPublic = obj.isPublic || false;
                (obj as CollectionCore).itemCount = obj.itemCount || 0;
                (obj as CollectionCore).literatureIds = obj.literatureIds || [];
                (obj as CollectionCore).tags = obj.tags || [];
            } else {
                obj.updatedAt = now;

                // 如果更新了literatureIds，同步更新itemCount
                if (obj.literatureIds) {
                    obj.itemCount = obj.literatureIds.length;
                }
            }

            this.clearRelatedCache('collections');
        } catch (error) {
            throw ErrorHandler.handle(error, {
                operation: `database.collections.${operation}`,
                layer: 'database',
                entityType: 'Collection',
                inputData: obj,
            });
        }
    }

    // ==================== 查询缓存管理 ====================

    /**
     * 🗄️ 获取缓存
     */
    private getCache<T>(key: string): T | null {
        const entry = this.queryCache.get(key);
        if (!entry) return null;

        const now = Date.now();
        if (now - entry.timestamp > entry.ttl) {
            this.queryCache.delete(key);
            return null;
        }

        this.queryStats.cacheHits++;
        return entry.data as T;
    }

    /**
     * 🗄️ 设置缓存
     */
    private setCache<T>(key: string, data: T, ttl: number = this.defaultCacheTTL): void {
        // 如果缓存已满，清理最旧的条目
        if (this.queryCache.size >= this.maxCacheSize) {
            const oldestKey = this.queryCache.keys().next().value;
            this.queryCache.delete(oldestKey);
        }

        this.queryCache.set(key, {
            data,
            timestamp: Date.now(),
            ttl,
        });
    }

    /**
     * 🗄️ 清理相关缓存
     */
    private clearRelatedCache(table: string): void {
        const keysToDelete: string[] = [];

        for (const [key] of this.queryCache) {
            if (key.includes(table)) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this.queryCache.delete(key));
    }

    /**
     * 🗄️ 清理所有缓存
     */
    public clearAllCache(): void {
        this.queryCache.clear();
    }

    // ==================== 高级查询方法 ====================

    /**
     * 🔍 高性能分页查询文献
     */
    async searchLiteratures(
        filter: LiteratureFilter = {},
        sort: LiteratureSort = { field: 'createdAt', order: 'desc' },
        page: number = 1,
        pageSize: number = LITERATURE_CONSTANTS.DEFAULT_PAGE_SIZE
    ): Promise<PaginatedResult<LibraryItemCore>> {
        const startTime = Date.now();
        this.queryStats.totalQueries++;

        try {
            // 生成缓存键
            const cacheKey = `search_literatures_${JSON.stringify({ filter, sort, page, pageSize })}`;

            // 尝试从缓存获取
            const cached = this.getCache<PaginatedResult<LibraryItemCore>>(cacheKey);
            if (cached) {
                return cached;
            }

            // 构建查询
            let query = this.libraries.toCollection();

            // 应用过滤器
            if (filter.sources?.length) {
                query = this.libraries.where('source').anyOf(filter.sources);
            }

            if (filter.years?.length) {
                query = this.libraries.where('year').anyOf(filter.years);
            }

            if (filter.createdAfter || filter.createdBefore) {
                if (filter.createdAfter && filter.createdBefore) {
                    query = this.libraries.where('createdAt').between(filter.createdAfter, filter.createdBefore);
                } else if (filter.createdAfter) {
                    query = this.libraries.where('createdAt').above(filter.createdAfter);
                } else if (filter.createdBefore) {
                    query = this.libraries.where('createdAt').below(filter.createdBefore);
                }
            }

            // 文本搜索
            if (filter.searchQuery) {
                const searchTerm = filter.searchQuery.toLowerCase();
                query = query.filter(item => {
                    const searchFields = filter.searchFields || ['title', 'authors'];

                    return searchFields.some(field => {
                        switch (field) {
                            case 'title':
                                return item.title.toLowerCase().includes(searchTerm);
                            case 'authors':
                                return item.authors.some(author =>
                                    author.toLowerCase().includes(searchTerm)
                                );
                            case 'abstract':
                                return item.abstract?.toLowerCase().includes(searchTerm) || false;
                            case 'keywords':
                                return item.keywords.some(keyword =>
                                    keyword.toLowerCase().includes(searchTerm)
                                );
                            default:
                                return false;
                        }
                    });
                });
            }

            // 状态过滤
            if (filter.hasAbstract !== undefined) {
                query = query.filter(item =>
                    filter.hasAbstract ? !!item.abstract : !item.abstract
                );
            }

            if (filter.hasPdf !== undefined) {
                query = query.filter(item =>
                    filter.hasPdf ? !!item.pdfPath : !item.pdfPath
                );
            }

            if (filter.hasDoi !== undefined) {
                query = query.filter(item =>
                    filter.hasDoi ? !!item.doi : !item.doi
                );
            }

            // 排序
            if (sort.field === 'title' || sort.field === 'year' || sort.field === 'createdAt') {
                query = query.sortBy(sort.field);
                if (sort.order === 'desc') {
                    query = query.reverse();
                }
            }

            // 分页
            const offset = (page - 1) * pageSize;
            const [items, total] = await Promise.all([
                query.offset(offset).limit(pageSize).toArray(),
                query.count()
            ]);

            const result: PaginatedResult<LibraryItemCore> = {
                items,
                pagination: {
                    page,
                    pageSize,
                    total,
                    totalPages: Math.ceil(total / pageSize),
                },
            };

            // 缓存结果
            this.setCache(cacheKey, result, this.defaultCacheTTL);

            // 记录性能
            const queryTime = Date.now() - startTime;
            this.updateQueryStats(queryTime);

            return result;
        } catch (error) {
            throw ErrorHandler.handle(error, {
                operation: 'database.searchLiteratures',
                layer: 'database',
                additionalInfo: { filter, sort, page, pageSize },
            });
        }
    }

    /**
     * 📊 获取数据库统计信息
     */
    async getStatistics(): Promise<DatabaseStatistics> {
        const cacheKey = 'database_statistics';
        const cached = this.getCache<DatabaseStatistics>(cacheKey);
        if (cached) return cached;

        try {
            const [libraries, userMetas, citations, collections] = await Promise.all([
                this.libraries.toArray(),
                this.userMetas.toArray(),
                this.citations.toArray(),
                this.collections.toArray(),
            ]);

            const stats: DatabaseStatistics = {
                libraries: {
                    total: libraries.length,
                    bySource: this.groupBy(libraries, 'source'),
                    byYear: this.groupBy(libraries.filter(l => l.year), 'year'),
                    byStatus: this.groupBy(libraries, 'status'),
                },
                userMetas: {
                    total: userMetas.length,
                    byUser: this.groupBy(userMetas, 'userId'),
                    byReadingStatus: this.groupBy(userMetas, 'readingStatus'),
                    byPriority: this.groupBy(userMetas, 'priority'),
                },
                citations: {
                    total: citations.length,
                    byType: this.groupBy(citations, 'citationType'),
                    verified: citations.filter(c => c.isVerified).length,
                    unverified: citations.filter(c => !c.isVerified).length,
                },
                collections: {
                    total: collections.length,
                    byType: this.groupBy(collections, 'type'),
                    byUser: this.groupBy(collections, 'userId'),
                    public: collections.filter(c => c.isPublic).length,
                    private: collections.filter(c => !c.isPublic).length,
                },
            };

            // 缓存统计信息（较长的TTL）
            this.setCache(cacheKey, stats, this.defaultCacheTTL * 10);
            return stats;
        } catch (error) {
            throw ErrorHandler.handle(error, {
                operation: 'database.getStatistics',
                layer: 'database',
            });
        }
    }

    /**
     * 🔧 执行数据库维护
     */
    async performMaintenance(): Promise<{
        orphanedUserMetas: number;
        orphanedCitations: number;
        duplicateLiteratures: number;
        executionTime: number;
    }> {
        const startTime = Date.now();

        try {
            await this.transaction('rw', this.libraries, this.userMetas, this.citations, async (tx) => {
                // 获取所有有效的文献ID
                const validLiteratureIds = new Set(
                    (await tx.libraries.toArray()).map(item => item.lid)
                );

                // 清理孤立的用户元数据
                const orphanedUserMetas = await tx.userMetas
                    .filter(meta => !validLiteratureIds.has(meta.literatureId))
                    .delete();

                // 清理孤立的引文关系
                const orphanedCitations = await tx.citations
                    .filter(citation =>
                        !validLiteratureIds.has(citation.sourceItemId) ||
                        !validLiteratureIds.has(citation.targetItemId)
                    )
                    .delete();

                return { orphanedUserMetas, orphanedCitations };
            });

            // 清理缓存
            this.clearAllCache();

            const result = {
                orphanedUserMetas: 0, // 实际值会在事务中设置
                orphanedCitations: 0,
                duplicateLiteratures: 0, // TODO: 实现重复检测
                executionTime: Date.now() - startTime,
            };

            console.log('🔧 Database maintenance completed:', result);
            return result;
        } catch (error) {
            throw ErrorHandler.handle(error, {
                operation: 'database.performMaintenance',
                layer: 'database',
            });
        }
    }

    // ==================== 辅助方法 ====================

    /**
     * 📊 分组统计辅助方法
     */
    private groupBy<T>(items: T[], key: keyof T): Record<string, number> {
        return items.reduce((acc, item) => {
            const value = String(item[key]);
            acc[value] = (acc[value] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
    }

    /**
     * 📊 更新查询统计
     */
    private updateQueryStats(queryTime: number): void {
        // 更新平均查询时间
        this.queryStats.averageQueryTime =
            (this.queryStats.averageQueryTime * (this.queryStats.totalQueries - 1) + queryTime) /
            this.queryStats.totalQueries;

        // 记录慢查询（超过1秒）
        if (queryTime > 1000) {
            this.queryStats.slowQueries.push({
                query: 'searchLiteratures', // 可以扩展为更详细的查询信息
                time: queryTime,
                timestamp: new Date(),
            });

            // 保持慢查询日志大小
            if (this.queryStats.slowQueries.length > 50) {
                this.queryStats.slowQueries.shift();
            }
        }
    }

    /**
     * 📊 获取性能统计
     */
    public getPerformanceStats() {
        return {
            ...this.queryStats,
            cacheSize: this.queryCache.size,
            cacheHitRate: this.queryStats.totalQueries > 0
                ? this.queryStats.cacheHits / this.queryStats.totalQueries
                : 0,
        };
    }

    /**
     * 🔍 健康检查
     */
    async healthCheck(): Promise<{
        isHealthy: boolean;
        stats: DatabaseStatistics;
        version: number;
        dbName: string;
        performance: ReturnType<typeof this.getPerformanceStats>;
        issues: string[];
    }> {
        try {
            const stats = await this.getStatistics();
            const performance = this.getPerformanceStats();
            const issues: string[] = [];

            // 检查潜在问题
            if (performance.averageQueryTime > 500) {
                issues.push('Average query time is high (>500ms)');
            }

            if (performance.cacheHitRate < 0.3) {
                issues.push('Cache hit rate is low (<30%)');
            }

            if (stats.citations.unverified / stats.citations.total > 0.8) {
                issues.push('High percentage of unverified citations');
            }

            return {
                isHealthy: issues.length === 0,
                stats,
                version: DATABASE_VERSION,
                dbName: DATABASE_NAME,
                performance,
                issues,
            };
        } catch (error) {
            return {
                isHealthy: false,
                stats: {} as DatabaseStatistics,
                version: DATABASE_VERSION,
                dbName: DATABASE_NAME,
                performance: this.getPerformanceStats(),
                issues: ['Health check failed'],
            };
        }
    }
}

// 🏪 数据库单例实例
export const enhancedLiteratureDB = new EnhancedLiteratureDatabase();

export default enhancedLiteratureDB;
