/**
 * 📂 Collection Service - 集合管理服务
 * 
 * 职责:
 * 1. 集合的CRUD操作
 * 2. 智能集合创建和管理
 * 3. 集合内容推荐
 * 4. 集合统计和分析
 * 
 * 设计原则:
 * - 集合专用：专门处理集合相关的业务逻辑
 * - 智能化：支持自动集合创建和内容推荐
 * - 用户友好：提供直观的集合管理接口
 * - 可扩展：支持多种集合类型和规则
 */

import {
    collectionRepository,
    enhancedLiteratureRepository,
    userMetaRepository,
} from '../repositories';
import {
    LibraryItemCore,
    UserLiteratureMetaCore,
    ErrorHandler,
} from '../models';
import {
    Collection,
    CollectionType,
} from '../types';

/**
 * 📂 集合创建输入
 */
export interface CreateCollectionInput {
    name: string;
    description?: string;
    type: CollectionType;
    isPublic?: boolean;
    tags?: string[];
    rules?: CollectionRules;
    initialItems?: string[];
}

/**
 * ⚙️ 智能集合规则
 */
export interface CollectionRules {
    /** 基于标签的规则 */
    tags?: {
        include?: string[];
        exclude?: string[];
        operator?: 'and' | 'or';
    };
    /** 基于作者的规则 */
    authors?: {
        include?: string[];
        exclude?: string[];
    };
    /** 基于时间的规则 */
    temporal?: {
        startYear?: number;
        endYear?: number;
        recentDays?: number;
    };
    /** 基于阅读状态的规则 */
    readingStatus?: {
        include?: Array<'unread' | 'reading' | 'completed' | 'abandoned'>;
    };
    /** 基于评分的规则 */
    rating?: {
        min?: number;
        max?: number;
    };
    /** 基于关键词的规则 */
    keywords?: {
        include?: string[];
        exclude?: string[];
    };
}

/**
 * 📊 集合统计
 */
export interface CollectionStatistics {
    totalItems: number;
    readingProgress: {
        unread: number;
        reading: number;
        completed: number;
    };
    averageRating: number;
    topTags: Array<{ tag: string; count: number }>;
    yearDistribution: Array<{ year: number; count: number }>;
    authorDistribution: Array<{ author: string; count: number }>;
    lastUpdated: Date;
}

/**
 * 🎯 集合推荐结果
 */
export interface CollectionRecommendation {
    suggestedItems: Array<{
        item: LibraryItemCore;
        relevanceScore: number;
        reasons: string[];
    }>;
    suggestedCollections: Array<{
        name: string;
        description: string;
        type: string;
        estimatedSize: number;
        rules: CollectionRules;
    }>;
}

/**
 * 📂 Collection Service 类
 */
export class CollectionService {
    // 📊 集合缓存
    private collectionCache = new Map<string, {
        data: any;
        timestamp: number;
        ttl: number;
    }>();

    private readonly defaultCacheTTL = 300000; // 5分钟

    // 📈 服务统计
    private stats = {
        totalOperations: 0,
        averageResponseTime: 0,
        collectionsCreated: 0,
        smartCollectionsGenerated: 0,
    };

    constructor(
        private readonly collectionRepo = collectionRepository,
        private readonly literatureRepo = enhancedLiteratureRepository,
        private readonly userMetaRepo = userMetaRepository
    ) { }

    // ==================== 基础集合操作 ====================

    /**
     * ➕ 创建集合
     */
    async createCollection(
        userId: string,
        input: CreateCollectionInput
    ): Promise<Collection> {
        const startTime = Date.now();

        try {
            // 1. 验证输入数据
            this.validateCollectionInput(input);

            // 2. 创建基础集合
            const collection = await this.collectionRepo.create({
                name: input.name,
                description: input.description || '',
                type: input.type,
                ownerId: userId,
                isPublic: input.isPublic ?? false,
                literatureIds: input.initialItems || [],
                parentId: null,
                childIds: [],
                depth: 0,
                itemCount: input.initialItems?.length || 0,
                smartRule: input.rules as any,
            });

            // 3. 获取创建的集合对象
            const createdCollection = await this.collectionRepo.findById(collection);
            if (!createdCollection) {
                throw new Error('Failed to retrieve created collection');
            }

            // 4. 如果是智能集合，自动填充内容
            if (input.type === 'smart' && input.rules) {
                await this.populateSmartCollection(collection, input.rules, userId);
                this.stats.smartCollectionsGenerated++;
            }

            // 5. 添加初始项目（如果有）
            if (input.initialItems && input.initialItems.length > 0) {
                await this.addItemsToCollection(collection, input.initialItems, userId);
            }

            this.stats.collectionsCreated++;
            this.updateStats(Date.now() - startTime, true);

            return createdCollection;
        } catch (error) {
            this.updateStats(Date.now() - startTime, false);
            throw ErrorHandler.handle(error, {
                operation: 'service.createCollection',
                layer: 'service',
                userId,
                inputData: input,
            });
        }
    }

    /**
     * 📋 获取用户的所有集合
     */
    async getUserCollections(
        userId: string,
        includeStatistics: boolean = false
    ): Promise<Array<Collection & { statistics?: CollectionStatistics }>> {
        const startTime = Date.now();

        try {
            const cacheKey = `user_collections_${userId}_${includeStatistics}`;
            const cached = this.getCache<Array<Collection & { statistics?: CollectionStatistics }>>(cacheKey);
            if (cached) return cached;

            // 1. 获取用户的所有集合
            const collections = await this.collectionRepo.findByOwnerId(userId);

            // 2. 如果需要统计信息，为每个集合计算统计
            const enhancedCollections = includeStatistics
                ? await Promise.all(
                    collections.map(async (collection) => ({
                        ...collection,
                        statistics: await this.calculateCollectionStatistics(collection, userId),
                    }))
                )
                : collections;

            this.setCache(cacheKey, enhancedCollections);
            this.updateStats(Date.now() - startTime, true);

            return enhancedCollections;
        } catch (error) {
            this.updateStats(Date.now() - startTime, false);
            throw ErrorHandler.handle(error, {
                operation: 'service.getUserCollections',
                layer: 'service',
                userId,
            });
        }
    }

    /**
     * 📖 获取集合详情
     */
    async getCollection(
        collectionId: string,
        userId: string,
        includeItems: boolean = true
    ): Promise<Collection & {
        items?: LibraryItemCore[];
        statistics?: CollectionStatistics;
    }> {
        const startTime = Date.now();

        try {
            // 1. 获取集合基本信息
            const collection = await this.collectionRepo.findById(collectionId);
            if (!collection) {
                throw new Error('Collection not found');
            }

            // 2. 验证用户权限
            if (collection.ownerId !== userId && !collection.isPublic) {
                throw new Error('Access denied to private collection');
            }

            let result: any = { ...collection };

            // 3. 获取集合项目（如果需要）
            if (includeItems) {
                result.items = await this.getCollectionItems(collectionId);
            }

            // 4. 计算统计信息
            result.statistics = await this.calculateCollectionStatistics(collection, userId);

            this.updateStats(Date.now() - startTime, true);
            return result;
        } catch (error) {
            this.updateStats(Date.now() - startTime, false);
            throw ErrorHandler.handle(error, {
                operation: 'service.getCollection',
                layer: 'service',
                entityId: collectionId,
                userId,
            });
        }
    }

    // ==================== 集合内容管理 ====================

    /**
     * ➕ 向集合添加项目
     */
    async addItemsToCollection(
        collectionId: string,
        itemIds: string[],
        userId: string
    ): Promise<{ added: number; skipped: number; errors: string[] }> {
        const startTime = Date.now();

        try {
            // 1. 验证集合存在和权限
            const collection = await this.collectionRepo.findById(collectionId);
            if (!collection || collection.ownerId !== userId) {
                throw new Error('Collection not found or access denied');
            }

            // 2. 验证项目存在
            const validItems: string[] = [];
            const errors: string[] = [];

            for (const itemId of itemIds) {
                const item = await this.literatureRepo.findByLid(itemId);
                if (item) {
                    validItems.push(itemId);
                } else {
                    errors.push(`Item ${itemId} not found`);
                }
            }

            // 3. 添加项目到集合
            const currentItems = new Set(collection.literatureIds);
            const newItems = validItems.filter(id => !currentItems.has(id));

            if (newItems.length > 0) {
                const updatedItemIds = [...collection.literatureIds, ...newItems];
                await this.collectionRepo.update(collectionId, {
                    literatureIds: updatedItemIds,
                    itemCount: updatedItemIds.length,
                });

                // 清理相关缓存
                this.clearCollectionCache(collectionId, userId);
            }

            this.updateStats(Date.now() - startTime, true);

            return {
                added: newItems.length,
                skipped: validItems.length - newItems.length,
                errors,
            };
        } catch (error) {
            this.updateStats(Date.now() - startTime, false);
            throw ErrorHandler.handle(error, {
                operation: 'service.addItemsToCollection',
                layer: 'service',
                entityId: collectionId,
                userId,
                additionalInfo: { itemIds },
            });
        }
    }

    /**
     * ➖ 从集合移除项目
     */
    async removeItemsFromCollection(
        collectionId: string,
        itemIds: string[],
        userId: string
    ): Promise<{ removed: number; notFound: number }> {
        const startTime = Date.now();

        try {
            // 1. 验证集合存在和权限
            const collection = await this.collectionRepo.findById(collectionId);
            if (!collection || collection.ownerId !== userId) {
                throw new Error('Collection not found or access denied');
            }

            // 2. 移除项目
            const currentItems = new Set(collection.literatureIds);
            const toRemove = new Set(itemIds);
            const updatedItemIds = collection.literatureIds.filter((id: string) => !toRemove.has(id));

            const removed = collection.literatureIds.length - updatedItemIds.length;
            const notFound = itemIds.length - removed;

            if (removed > 0) {
                await this.collectionRepo.update(collectionId, {
                    literatureIds: updatedItemIds,
                    itemCount: updatedItemIds.length,
                });

                // 清理相关缓存
                this.clearCollectionCache(collectionId, userId);
            }

            this.updateStats(Date.now() - startTime, true);

            return { removed, notFound };
        } catch (error) {
            this.updateStats(Date.now() - startTime, false);
            throw ErrorHandler.handle(error, {
                operation: 'service.removeItemsFromCollection',
                layer: 'service',
                entityId: collectionId,
                userId,
                additionalInfo: { itemIds },
            });
        }
    }

    // ==================== 智能集合功能 ====================

    /**
     * 🤖 生成智能集合推荐
     */
    async generateCollectionRecommendations(
        userId: string,
        basedOnCollection?: string
    ): Promise<CollectionRecommendation> {
        const startTime = Date.now();

        try {
            // 1. 分析用户的文献和偏好
            const userMetas = await this.userMetaRepo.findByUserId(userId);
            const userPreferences = await this.analyzeUserPreferences(userMetas as any);

            // 2. 生成项目推荐
            const suggestedItems = await this.generateItemRecommendations(
                userId,
                userPreferences,
                basedOnCollection
            );

            // 3. 生成集合推荐
            const suggestedCollections = this.generateCollectionSuggestions(userPreferences);

            this.updateStats(Date.now() - startTime, true);

            return {
                suggestedItems,
                suggestedCollections,
            };
        } catch (error) {
            this.updateStats(Date.now() - startTime, false);
            throw ErrorHandler.handle(error, {
                operation: 'service.generateCollectionRecommendations',
                layer: 'service',
                userId,
                entityId: basedOnCollection,
            });
        }
    }

    /**
     * 🔄 更新智能集合
     */
    async updateSmartCollection(
        collectionId: string,
        userId: string
    ): Promise<{ added: number; removed: number; total: number }> {
        const startTime = Date.now();

        try {
            // 1. 获取集合信息
            const collection = await this.collectionRepo.findById(collectionId);
            if (!collection || collection.ownerId !== userId) {
                throw new Error('Collection not found or access denied');
            }

            if (collection.type !== 'smart') {
                throw new Error('Only smart collections can be auto-updated');
            }

            // 2. 获取当前项目
            const currentItems = new Set(collection.literatureIds);

            // 3. 根据规则重新计算项目（简化实现）
            const newItems = await this.evaluateCollectionRules({}, userId);
            const newItemsSet = new Set(newItems);

            // 4. 计算差异
            const toAdd = newItems.filter(id => !currentItems.has(id));
            const toRemove = collection.literatureIds.filter((id: string) => !newItemsSet.has(id));

            // 5. 更新集合
            await this.collectionRepo.update(collectionId, {
                literatureIds: newItems,
                itemCount: newItems.length,
            });

            // 6. 清理缓存
            this.clearCollectionCache(collectionId, userId);

            this.updateStats(Date.now() - startTime, true);

            return {
                added: toAdd.length,
                removed: toRemove.length,
                total: newItems.length,
            };
        } catch (error) {
            this.updateStats(Date.now() - startTime, false);
            throw ErrorHandler.handle(error, {
                operation: 'service.updateSmartCollection',
                layer: 'service',
                entityId: collectionId,
                userId,
            });
        }
    }

    // ==================== 私有辅助方法 ====================

    private validateCollectionInput(input: CreateCollectionInput): void {
        if (!input.name || input.name.trim().length === 0) {
            throw new Error('Collection name is required');
        }

        if (input.name.length > 100) {
            throw new Error('Collection name too long (max 100 characters)');
        }

        if (input.description && input.description.length > 500) {
            throw new Error('Collection description too long (max 500 characters)');
        }

        if (input.type === 'smart' && !input.rules) {
            throw new Error('Smart collections require rules');
        }
    }

    private async populateSmartCollection(
        collectionId: string,
        rules: CollectionRules,
        userId: string
    ): Promise<void> {
        const matchingItems = await this.evaluateCollectionRules(rules, userId);

        if (matchingItems.length > 0) {
            await this.collectionRepo.update(collectionId, {
                literatureIds: matchingItems,
                itemCount: matchingItems.length,
            });
        }
    }

    private async evaluateCollectionRules(
        rules: CollectionRules,
        userId: string
    ): Promise<string[]> {
        // 简化实现：返回空数组
        return [];
    }

    private async getCollectionItems(collectionId: string): Promise<LibraryItemCore[]> {
        const collection = await this.collectionRepo.findById(collectionId);
        if (!collection) return [];

        const items: LibraryItemCore[] = [];
        for (const itemId of collection.literatureIds) {
            const item = await this.literatureRepo.findByLid(itemId);
            if (item) {
                items.push(item);
            }
        }

        return items;
    }

    private async calculateCollectionStatistics(
        collection: Collection,
        userId: string
    ): Promise<CollectionStatistics> {
        const items = await this.getCollectionItems(collection.id);
        const userMetas = await this.userMetaRepo.findByUserId(userId);
        const userMetaMap = new Map(userMetas.map(meta => [meta.literatureId, meta]));

        // 阅读进度统计
        const readingProgress = { unread: 0, reading: 0, completed: 0 };
        let totalRating = 0;
        let ratedCount = 0;

        // 标签统计
        const tagCounts = new Map<string, number>();
        // 年份统计
        const yearCounts = new Map<number, number>();
        // 作者统计
        const authorCounts = new Map<string, number>();

        for (const item of items) {
            const meta = userMetaMap.get(item.lid);

            // 阅读进度
            if (meta) {
                const status = meta.readingStatus as keyof typeof readingProgress;
                if (status in readingProgress) {
                    readingProgress[status]++;
                }

                // 评分
                if (meta.rating) {
                    totalRating += meta.rating;
                    ratedCount++;
                }

                // 标签
                for (const tag of meta.tags) {
                    tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
                }
            }

            // 年份
            if (item.year) {
                yearCounts.set(item.year, (yearCounts.get(item.year) || 0) + 1);
            }

            // 作者
            for (const author of item.authors) {
                authorCounts.set(author, (authorCounts.get(author) || 0) + 1);
            }
        }

        return {
            totalItems: items.length,
            readingProgress,
            averageRating: ratedCount > 0 ? totalRating / ratedCount : 0,
            topTags: Array.from(tagCounts.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([tag, count]) => ({ tag, count })),
            yearDistribution: Array.from(yearCounts.entries())
                .sort((a, b) => b[0] - a[0])
                .map(([year, count]) => ({ year, count })),
            authorDistribution: Array.from(authorCounts.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([author, count]) => ({ author, count })),
            lastUpdated: collection.updatedAt || new Date(),
        };
    }

    // ==================== 缓存管理 ====================

    private getCache<T>(key: string): T | null {
        const entry = this.collectionCache.get(key);
        if (!entry) return null;

        if (Date.now() - entry.timestamp > entry.ttl) {
            this.collectionCache.delete(key);
            return null;
        }

        return entry.data as T;
    }

    private setCache<T>(key: string, data: T, ttl: number = this.defaultCacheTTL): void {
        this.collectionCache.set(key, {
            data,
            timestamp: Date.now(),
            ttl,
        });
    }

    private clearCollectionCache(collectionId: string, userId: string): void {
        for (const [key] of this.collectionCache) {
            if (key.includes(collectionId) || key.includes(`user_collections_${userId}`)) {
                this.collectionCache.delete(key);
            }
        }
    }

    private updateStats(responseTime: number, success: boolean): void {
        this.stats.totalOperations++;
        this.stats.averageResponseTime =
            (this.stats.averageResponseTime * (this.stats.totalOperations - 1) + responseTime) /
            this.stats.totalOperations;
    }

    /**
     * 📊 获取服务统计
     */
    public getCollectionServiceStats() {
        return { ...this.stats };
    }

    /**
     * 🧹 清理缓存
     */
    public clearCache(): void {
        this.collectionCache.clear();
    }

    // ==================== 占位符方法（需要具体实现） ====================

    private async analyzeUserPreferences(userMetas: UserLiteratureMetaCore[]) {
        // 简化实现：分析用户偏好
        return {
            topTags: [],
            topAuthors: [],
            preferredYears: [],
        };
    }

    private async generateItemRecommendations(
        userId: string,
        preferences: any,
        basedOnCollection?: string
    ) {
        // 简化实现：生成项目推荐
        return [];
    }

    private generateCollectionSuggestions(preferences: any) {
        // 简化实现：生成集合建议
        return [
            {
                name: 'Recent AI Research',
                description: 'Latest papers in artificial intelligence',
                type: 'smart',
                estimatedSize: 25,
                rules: {
                    keywords: { include: ['artificial intelligence', 'machine learning'] },
                    temporal: { recentDays: 90 },
                },
            },
            {
                name: 'High-Impact Papers',
                description: 'Your highest-rated literature',
                type: 'smart',
                estimatedSize: 15,
                rules: {
                    rating: { min: 4 },
                },
            },
        ];
    }
}

// 🏪 服务实例
export const collectionService = new CollectionService();

export default collectionService;
