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
    LibraryItem,
    UserLiteratureMeta,
    Citation,
    Collection,
    ModelValidators,
    LITERATURE_CONSTANTS,
    LibraryItemSchema,
    UserLiteratureMetaSchema,
    CitationSchema,
    CollectionSchema,
} from '../models';
import type {
    LiteratureFilter,
    LiteratureSort,
    PaginatedResult,
} from '../models';

// 📊 集合项类型 - 临时定义，待后续统一
export type CollectionItem = {
    collectionId: string;
    paperId: string;
    addedAt: Date;
    addedBy: string;
    order: number;
};

// 📊 数据库配置
const DATABASE_NAME = 'ResearchNavigatorLiteratureDB_Enhanced';
const DATABASE_VERSION = 3;

// 📊 扩展常量定义
const EXTENDED_LITERATURE_CONSTANTS = {
    ...LITERATURE_CONSTANTS,
    MAX_CACHE_SIZE: 1000,
    DEFAULT_CACHE_TTL: 300, // 5分钟
};

// 🚨 简化的错误处理类
class DatabaseErrorHandler {
    static handle(error: any, context: {
        operation: string;
        layer: string;
        entityType?: string;
        inputData?: any;
        additionalInfo?: any;
    }) {
        console.error(`[${context.layer}] ${context.operation} failed:`, error);
        if (context.inputData) {
            console.error('Input data:', context.inputData);
        }
        if (context.additionalInfo) {
            console.error('Additional info:', context.additionalInfo);
        }
        return error instanceof Error ? error : new Error(String(error));
    }
}

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
export class literatureDatabase extends Dexie {
    // 📚 核心表定义
    libraries!: Table<LibraryItem, string>;
    userMetas!: Table<UserLiteratureMeta, string>;
    citations!: Table<Citation, string>;
    collections!: Table<Collection, string>;
    collectionItems!: Table<CollectionItem, string>;

    // 🗄️ 查询缓存
    private queryCache = new Map<string, QueryCacheEntry>();
    private readonly maxCacheSize = EXTENDED_LITERATURE_CONSTANTS.MAX_CACHE_SIZE;
    private readonly defaultCacheTTL = EXTENDED_LITERATURE_CONSTANTS.DEFAULT_CACHE_TTL * 1000; // 转换为毫秒

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
                &paperId,
                title,
                *authors,
                year,
                publicationDate,
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
                [year+publicationDate],
                [status+createdAt],
                [year+source],
                [createdAt+status]
            `.replace(/\s+/g, ' ').trim(),

            // 👤 用户元数据表 - 用户相关复合索引
            userMetas: `
                &[userId+paperId],
                userId,
                paperId,
                *tags,
                priority,
                isFavorite,
                readingStatus,
                rating,
                readingProgress,
                lastAccessedAt,
                createdAt,
                updatedAt,
                [userId+priority],
                [userId+readingStatus],
                [userId+isFavorite],
                [userId+lastAccessedAt],
                [readingStatus+priority]
            `.replace(/\s+/g, ' ').trim(),

            // 🔗 引文关系表 - 双向查询优化（与模型字段对齐）
            citations: `
                &[sourceItemId+targetItemId],
                sourceItemId,
                targetItemId,
                createdAt
            `.replace(/\s+/g, ' ').trim(),

            // 📂 文献集合表 - 与模型字段对齐 (id/ownerUid)
            collections: `
                &id,
                ownerUid,
                name,
                description,
                type,
                isPublic,
                createdAt,
                updatedAt,
                parentId
            `.replace(/\s+/g, ' ').trim(),

            // 🖇️ 集合-文献关联表 - 多对多关系优化
            collectionItems: `
                &[collectionId+paperId],
                collectionId,
                paperId,
                addedAt,
                addedBy,
                order,
                [collectionId+addedAt],
                [paperId+addedAt]
            `.replace(/\s+/g, ' ').trim(),
        });

        // 🔧 设置数据库钩子
        this.setupDatabaseHooks();

        console.log('✨ Enhanced Literature Database initialized');
    }

    // Ensure DB is open before operations that might be invoked early after HMR/tab restore
    public async ensureOpen(): Promise<void> {
        try {
            const anyDb: any = this as any;
            const isOpen = typeof anyDb?.isOpen === 'function' ? anyDb.isOpen() : true;
            if (!isOpen && typeof anyDb?.open === 'function') {
                await anyDb.open();
            }
        } catch {
            // no-op, Dexie will throw again if truly unusable
        }
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
        obj: Partial<LibraryItem>,
        operation: 'creating' | 'updating',
        existingObj?: LibraryItem
    ): void {
        try {
            const now = new Date();

            if (operation === 'creating') {
                // 验证完整对象 - 基本字段验证
                if (!obj.title || !obj.authors || !Array.isArray(obj.authors)) {
                    throw new Error('LibraryItem validation failed: title and authors are required');
                }

                // 设置默认值
                (obj as LibraryItem).createdAt = now;
                (obj as LibraryItem).updatedAt = now;
                (obj as LibraryItem).authors = obj.authors || [];
                (obj as LibraryItem).source = obj.source || 'manual';
            } else {
                // 更新操作，只验证修改的字段
                obj.updatedAt = now;

                if (Object.keys(obj).length > 1) { // 除了updatedAt
                    // 基本字段验证
                    if (obj.title !== undefined && typeof obj.title !== 'string') {
                        throw new Error('LibraryItem validation failed: title must be a string');
                    }
                    if (obj.authors !== undefined && !Array.isArray(obj.authors)) {
                        throw new Error('LibraryItem validation failed: authors must be an array');
                    }
                }
            }

            // 清理查询缓存
            this.clearRelatedCache('libraries');
        } catch (error) {
            throw DatabaseErrorHandler.handle(error, {
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
        obj: Partial<UserLiteratureMeta>,
        operation: 'creating' | 'updating',
        existingObj?: UserLiteratureMeta
    ): void {
        try {
            const now = new Date();

            if (operation === 'creating') {
                // 使用Zod schema验证
                const validationResult = UserLiteratureMetaSchema.safeParse(obj);
                if (!validationResult.success) {
                    throw new Error(`Validation failed: ${validationResult.error.message}`);
                }

                // 设置默认值
                (obj as UserLiteratureMeta).createdAt = now;
                (obj as UserLiteratureMeta).updatedAt = now;
                (obj as UserLiteratureMeta).tags = obj.tags || [];
                (obj as UserLiteratureMeta).priority = obj.priority || 'medium';
                (obj as UserLiteratureMeta).readingStatus = obj.readingStatus || 'unread';
                // removed deprecated association fields
            } else {
                obj.updatedAt = now;

                // 如果更新了lastAccessedAt，记录访问时间
                if (!obj.lastAccessedAt) {
                    obj.lastAccessedAt = now;
                }
            }

            this.clearRelatedCache('userMetas');
        } catch (error) {
            throw DatabaseErrorHandler.handle(error, {
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
        obj: Partial<Citation>,
        operation: 'creating' | 'updating',
        existingObj?: Citation
    ): void {
        try {
            const now = new Date();

            if (operation === 'creating') {
                // 使用Zod schema验证
                const validationResult = CitationSchema.safeParse(obj);
                if (!validationResult.success) {
                    throw new Error(`Validation failed: ${validationResult.error.message}`);
                }

                // 设置默认值
                (obj as Citation).createdAt = now;

                // 防止自引用
                if ((obj as any).sourceItemId === (obj as any).targetItemId) {
                    throw new Error('Citation cannot reference itself');
                }
            } else {
                // 更新操作 - 仅允许更新 context
            }

            this.clearRelatedCache('citations');
        } catch (error) {
            throw DatabaseErrorHandler.handle(error, {
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
        obj: Partial<Collection>,
        operation: 'creating' | 'updating',
        existingObj?: Collection
    ): void {
        try {
            const now = new Date();

            if (operation === 'creating') {
                // 使用Zod schema验证
                const validationResult = CollectionSchema.safeParse(obj);
                if (!validationResult.success) {
                    throw new Error(`Validation failed: ${validationResult.error.message}`);
                }

                // 设置默认值
                (obj as Collection).createdAt = now;
                (obj as Collection).updatedAt = now;
                (obj as Collection).type = obj.type || 'general';
                (obj as Collection).isPublic = obj.isPublic || false;
                (obj as Collection).paperIds = obj.paperIds || [];
            } else {
                obj.updatedAt = now;

                // 如果更新了paperIds，记录变化
                if (obj.paperIds) {
                    // 集合项数量由paperIds数组长度决定
                    console.log(`Collection ${existingObj?.id || 'unknown'} updated with ${obj.paperIds.length} items`);
                }
            }

            this.clearRelatedCache('collections');
        } catch (error) {
            throw DatabaseErrorHandler.handle(error, {
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
            if (oldestKey) {
                this.queryCache.delete(oldestKey);
            }
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
    ): Promise<PaginatedResult<LibraryItem>> {
        const startTime = Date.now();
        this.queryStats.totalQueries++;

        try {
            // 生成缓存键
            const cacheKey = `search_literatures_${JSON.stringify({ filter, sort, page, pageSize })}`;

            // 尝试从缓存获取
            const cached = this.getCache<PaginatedResult<LibraryItem>>(cacheKey);
            if (cached) {
                return cached;
            }

            // 构建查询
            let query = this.libraries.toCollection();

            // 应用过滤器
            if (filter.source && filter.source !== 'all') {
                query = this.libraries.where('source').equals(filter.source);
            }

            if (filter.yearRange) {
                query = this.libraries.where('year')
                    .between(filter.yearRange.start, filter.yearRange.end, true, true);
            }

            if (filter.authors?.length) {
                query = query.filter(item =>
                    filter.authors!.some(author =>
                        item.authors.some(itemAuthor =>
                            itemAuthor.toLowerCase().includes(author.toLowerCase())
                        )
                    )
                );
            }

            // 文本搜索
            if (filter.searchTerm) {
                const searchTerm = filter.searchTerm.toLowerCase();
                query = query.filter(item => {
                    return item.title.toLowerCase().includes(searchTerm) ||
                        item.authors.some(author => author.toLowerCase().includes(searchTerm)) ||
                        (item.abstract?.toLowerCase().includes(searchTerm) || false);
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

            // 移除hasDoi过滤器，因为LibraryItem没有doi字段

            // 排序
            if (sort.field === 'title' || sort.field === 'year' || sort.field === 'createdAt') {
                // Dexie Collection.sortBy 返回的是已排序数组，需要在内存中分页
                const sortedItems = await (query as any).sortBy(sort.field);
                if (sort.order === 'desc') {
                    sortedItems.reverse();
                }

                // 重新分页
                const offset = (page - 1) * pageSize;
                const paginatedItems = sortedItems.slice(offset, offset + pageSize);

                const result: PaginatedResult<LibraryItem> = {
                    items: paginatedItems,
                    total: sortedItems.length,
                    page,
                    pageSize,
                    totalPages: Math.ceil(sortedItems.length / pageSize),
                };

                // 缓存结果
                this.setCache(cacheKey, result, this.defaultCacheTTL);

                // 记录性能
                const queryTime = Date.now() - startTime;
                this.updateQueryStats(queryTime);

                return result;
            } else if (sort.field === 'authors') {
                // 按第一个作者排序 - 需要特殊处理
                const sortedItems = await query.toArray();
                sortedItems.sort((a, b) => {
                    const authorA = a.authors[0] || '';
                    const authorB = b.authors[0] || '';
                    const comparison = authorA.localeCompare(authorB);
                    return sort.order === 'desc' ? -comparison : comparison;
                });

                // 重新构建查询
                const offset = (page - 1) * pageSize;
                const paginatedItems = sortedItems.slice(offset, offset + pageSize);

                const result: PaginatedResult<LibraryItem> = {
                    items: paginatedItems,
                    total: sortedItems.length,
                    page,
                    pageSize,
                    totalPages: Math.ceil(sortedItems.length / pageSize),
                };

                // 缓存结果
                this.setCache(cacheKey, result, this.defaultCacheTTL);

                // 记录性能
                const queryTime = Date.now() - startTime;
                this.updateQueryStats(queryTime);

                return result;
            }

            // 分页
            const offset = (page - 1) * pageSize;
            const [items, total] = await Promise.all([
                query.offset(offset).limit(pageSize).toArray(),
                query.count()
            ]);

            const result: PaginatedResult<LibraryItem> = {
                items,
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
            };

            // 缓存结果
            this.setCache(cacheKey, result, this.defaultCacheTTL);

            // 记录性能
            const queryTime = Date.now() - startTime;
            this.updateQueryStats(queryTime);

            return result;
        } catch (error) {
            throw DatabaseErrorHandler.handle(error, {
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
                    byStatus: {}, // LibraryItem没有status字段，返回空对象
                },
                userMetas: {
                    total: userMetas.length,
                    byUser: this.groupBy(userMetas, 'userId'),
                    byReadingStatus: this.groupBy(userMetas, 'readingStatus'),
                    byPriority: this.groupBy(userMetas, 'priority'),
                },
                citations: {
                    total: citations.length,
                    byType: {}, // Citation没有citationType字段
                    verified: 0, // Citation没有isVerified字段
                    unverified: citations.length, // 所有都认为未验证
                },
                collections: {
                    total: collections.length,
                    byType: this.groupBy(collections, 'type'),
                    byUser: {}, // Collection没有userId字段
                    public: collections.filter(c => c.isPublic).length,
                    private: collections.filter(c => !c.isPublic).length,
                },
            };

            // 缓存统计信息（较长的TTL）
            this.setCache(cacheKey, stats, this.defaultCacheTTL * 10);
            return stats;
        } catch (error) {
            throw DatabaseErrorHandler.handle(error, {
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
            let orphanedUserMetas = 0;
            let orphanedCitations = 0;

            await this.transaction('rw', this.libraries, this.userMetas, this.citations, async () => {
                // 获取所有有效的文献ID
                const validLiteratureIds = new Set(
                    (await this.libraries.toArray()).map((item: any) => item.paperId)
                );

                // 清理孤立的用户元数据
                orphanedUserMetas = await this.userMetas
                    .filter((meta: any) => !validLiteratureIds.has(meta.paperId))
                    .delete();

                // 清理孤立的引文关系
                orphanedCitations = await this.citations
                    .filter((citation: any) =>
                        !validLiteratureIds.has(citation.sourceItemId) ||
                        !validLiteratureIds.has(citation.targetItemId)
                    )
                    .delete();
            });

            // 清理缓存
            this.clearAllCache();

            const result = {
                orphanedUserMetas,
                orphanedCitations,
                duplicateLiteratures: 0, // TODO: 实现重复检测
                executionTime: Date.now() - startTime,
            };

            console.log('🔧 Database maintenance completed:', result);
            return result;
        } catch (error) {
            throw DatabaseErrorHandler.handle(error, {
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
    public getPerformanceStats(): any {
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
        performance: any;
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
export const literatureDB = new literatureDatabase();

export default literatureDB;
