/**
 * 📂 Collection Repository - 文献集合仓储
 * 
 * 新增功能: 统一的集合管理（通用集合、话题集合、智能集合等）
 * 设计原则: 支持层次结构、智能规则、动态更新
 */

import { BaseRepository } from './base-repository';
import { literatureDB, DatabaseUtils } from '../database';
import {
    Collection,
    CollectionType,
    SmartCollectionRule,
    CollectionStats,
    CreateCollectionInput,
    UpdateCollectionInput,
    CollectionQuery,
    CollectionSort,
    CollectionOperation,
    SmartCollectionResult,
    CollectionSchema
} from '../models';
import type { Table } from 'dexie';

/**
 * 📂 文献集合仓储实现
 */
export class CollectionRepository extends BaseRepository<Collection, string> {
    protected table: Table<Collection, string>;

    constructor() {
        super();
        this.table = literatureDB.collections;
    }

    protected generateId(): string {
        return DatabaseUtils.generateId();
    }

    /**
     * 🔍 根据所有者ID查找集合
     */
    async findByOwnerId(ownerUid: string): Promise<Collection[]> {
        try {
            return await this.table.where('ownerUid').equals(ownerUid).toArray();
        } catch (error) {
            console.error('[CollectionRepository] findByOwnerId failed:', error);
            return [];
        }
    }

    /**
     * 🔍 根据类型查找集合
     */
    async findByType(type: CollectionType): Promise<Collection[]> {
        try {
            return await this.table.where('type').equals(type).toArray();
        } catch (error) {
            console.error('[CollectionRepository] findByType failed:', error);
            return [];
        }
    }

    /**
     * 🔍 根据父级ID查找子集合
     */
    async findChildren(parentId: string): Promise<Collection[]> {
        try {
            return await this.table.where('parentId').equals(parentId).toArray();
        } catch (error) {
            console.error('[CollectionRepository] findChildren failed:', error);
            return [];
        }
    }

    /**
     * 🌳 获取集合层次树
     */
    async getCollectionTree(ownerUid: string): Promise<Collection[]> {
        try {
            const allCollections = await this.findByOwnerId(ownerUid);

            // 构建层次结构
            const collectionsMap = new Map<string, Collection>();
            allCollections.forEach(collection => {
                collectionsMap.set(collection.id, collection);
            });

            // 计算层次深度和子集合ID
            allCollections.forEach(collection => {
                if (collection.parentId && collectionsMap.has(collection.parentId)) {
                    const parent = collectionsMap.get(collection.parentId)!;
                    if (!parent.childIds.includes(collection.id)) {
                        parent.childIds.push(collection.id);
                    }

                    // 计算深度
                    let depth = 0;
                    let current = collection;
                    while (current.parentId && collectionsMap.has(current.parentId)) {
                        depth++;
                        current = collectionsMap.get(current.parentId)!;
                        if (depth > 10) break; // 防止循环引用
                    }
                    collection.depth = depth;
                }
            });

            return allCollections;
        } catch (error) {
            console.error('[CollectionRepository] getCollectionTree failed:', error);
            return [];
        }
    }

    /**
     * 🔍 高级搜索集合
     */
    async searchWithFilters(
        query: CollectionQuery = {},
        sort: CollectionSort = { field: 'createdAt', order: 'desc' },
        page: number = 1,
        pageSize: number = 20
    ): Promise<{
        items: Collection[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    }> {
        try {
            let collection = this.table.toCollection();

            // 应用筛选条件
            if (query.ownerUid) {
                collection = this.table.where('ownerUid').equals(query.ownerUid);
            }

            if (query.type) {
                collection = collection.filter(item => item.type === query.type);
            }

            if (query.isPublic !== undefined) {
                collection = collection.filter(item => item.isPublic === query.isPublic);
            }

            if (query.parentId !== undefined) {
                collection = collection.filter(item => item.parentId === query.parentId);
            }

            if (query.isArchived !== undefined) {
                collection = collection.filter(item => item.isArchived === query.isArchived);
            }

            if (query.searchTerm) {
                const searchTerm = query.searchTerm.toLowerCase();
                collection = collection.filter(item =>
                    item.name.toLowerCase().includes(searchTerm) ||
                    (item.description && item.description.toLowerCase().includes(searchTerm))
                );
            }

            if (query.hasItems !== undefined) {
                collection = collection.filter(item =>
                    query.hasItems ? item.itemCount > 0 : item.itemCount === 0
                );
            }

            // 排序
            if (sort.field === 'name') {
                collection = collection.sortBy('name');
            } else if (sort.field === 'itemCount') {
                collection = collection.sortBy('itemCount');
            } else if (sort.field === 'updatedAt') {
                collection = collection.sortBy('updatedAt');
            } else {
                collection = collection.sortBy('createdAt');
            }

            if (sort.order === 'desc') {
                collection = collection.reverse();
            }

            return await this.paginate(collection, page, pageSize);
        } catch (error) {
            console.error('[CollectionRepository] searchWithFilters failed:', error);
            throw new Error('Failed to search collections with filters');
        }
    }

    /**
     * ➕ 创建集合
     */
    async createCollection(input: CreateCollectionInput): Promise<string> {
        try {
            const now = DatabaseUtils.now();
            const collection: Collection = {
                id: this.generateId(),
                ...input,
                lids: input.lids || [],
                childIds: [],
                itemCount: input.lids?.length || 0,
                isArchived: false,
                createdAt: now,
                updatedAt: now
            };

            // 验证数据
            const validatedCollection = CollectionSchema.parse(collection);
            await this.table.add(validatedCollection);

            return collection.id;
        } catch (error) {
            console.error('[CollectionRepository] createCollection failed:', error);
            throw new Error('Failed to create collection');
        }
    }

    /**
     * 📚 添加文献到集合
     */
    async addLiterature(
        collectionId: string,
        lids: string[]
    ): Promise<void> {
        try {
            const collection = await this.findById(collectionId);
            if (!collection) {
                throw new Error(`Collection ${collectionId} not found`);
            }

            // 去重添加
            const existingIds = new Set(collection.lids);
            const newIds = lids.filter(id => !existingIds.has(id));

            if (newIds.length > 0) {
                const updatedLiteratureIds = [...collection.lids, ...newIds];
                await this.update(collectionId, {
                    lids: updatedLiteratureIds,
                    itemCount: updatedLiteratureIds.length,
                    lastItemAddedAt: DatabaseUtils.now()
                });
            }
        } catch (error) {
            console.error('[CollectionRepository] addLiterature failed:', error);
            throw new Error('Failed to add literature to collection');
        }
    }

    /**
     * 🗑️ 从集合移除文献
     */
    async removeLiterature(
        collectionId: string,
        lids: string[]
    ): Promise<void> {
        try {
            const collection = await this.findById(collectionId);
            if (!collection) {
                throw new Error(`Collection ${collectionId} not found`);
            }

            const idsToRemove = new Set(lids);
            const updatedLiteratureIds = collection.lids.filter(
                id => !idsToRemove.has(id)
            );

            await this.update(collectionId, {
                lids: updatedLiteratureIds,
                itemCount: updatedLiteratureIds.length
            });
        } catch (error) {
            console.error('[CollectionRepository] removeLiterature failed:', error);
            throw new Error('Failed to remove literature from collection');
        }
    }

    /**
     * 🔄 执行集合操作
     */
    async executeOperation(operation: CollectionOperation): Promise<void> {
        try {
            switch (operation.type) {
                case 'add_literature':
                    // 操作由具体的集合ID在上层逻辑中确定
                    break;

                case 'remove_literature':
                    // 操作由具体的集合ID在上层逻辑中确定
                    break;

                case 'move_literature':
                    if (!operation.targetCollectionId) {
                        throw new Error('Target collection ID required for move operation');
                    }
                    // 这里需要在service层实现，因为涉及多个集合
                    break;

                case 'copy_literature':
                    if (!operation.targetCollectionId) {
                        throw new Error('Target collection ID required for copy operation');
                    }
                    await this.addLiterature(operation.targetCollectionId, operation.lids);
                    break;
            }
        } catch (error) {
            console.error('[CollectionRepository] executeOperation failed:', error);
            throw new Error('Failed to execute collection operation');
        }
    }

    /**
     * 🤖 执行智能集合规则
     */
    async executeSmartRule(
        collectionId: string,
        lids: string[]
    ): Promise<SmartCollectionResult> {
        try {
            const collection = await this.findById(collectionId);
            if (!collection || collection.type !== 'smart' || !collection.smartRule) {
                throw new Error('Invalid smart collection');
            }

            const startTime = Date.now();
            const rule = collection.smartRule;

            // 这里需要实现复杂的筛选逻辑
            // 为简化实现，我们先返回基础结果
            const matchedItems = lids; // 实际需要根据规则筛选
            const currentItems = new Set(collection.lids);

            const addedItems = matchedItems.filter(id => !currentItems.has(id));
            const removedItems = collection.lids.filter(id => !matchedItems.includes(id));

            // 更新集合
            await this.update(collectionId, {
                lids: matchedItems,
                itemCount: matchedItems.length,
                lastItemAddedAt: addedItems.length > 0 ? DatabaseUtils.now() : collection.lastItemAddedAt
            });

            const result: SmartCollectionResult = {
                collectionId,
                matchedItems,
                addedItems,
                removedItems,
                totalMatched: matchedItems.length,
                executedAt: DatabaseUtils.now(),
                executionTime: Date.now() - startTime
            };

            return result;
        } catch (error) {
            console.error('[CollectionRepository] executeSmartRule failed:', error);
            throw new Error('Failed to execute smart collection rule');
        }
    }

    /**
     * 📊 计算集合统计信息
     */
    async calculateStats(collectionId: string): Promise<CollectionStats> {
        try {
            const collection = await this.findById(collectionId);
            if (!collection) {
                throw new Error(`Collection ${collectionId} not found`);
            }

            // 这里需要与文献仓储协作获取详细统计
            // 为简化实现，返回基础统计
            const stats: CollectionStats = {
                totalItems: collection.itemCount,
                sourceDistribution: {},
                yearDistribution: {},
                authorDistribution: [],
                tagDistribution: [],
                additionTrend: [],
                completionRate: 0,
                citationStats: {
                    totalCitations: 0,
                    averageCitationsPerItem: 0
                },
                lastUpdated: DatabaseUtils.now()
            };

            return stats;
        } catch (error) {
            console.error('[CollectionRepository] calculateStats failed:', error);
            throw new Error('Failed to calculate collection statistics');
        }
    }

    /**
     * 🗂️ 归档集合
     */
    async archiveCollection(collectionId: string): Promise<void> {
        try {
            await this.update(collectionId, {
                isArchived: true,
                archivedAt: DatabaseUtils.now()
            });
        } catch (error) {
            console.error('[CollectionRepository] archiveCollection failed:', error);
            throw new Error('Failed to archive collection');
        }
    }

    /**
     * 📤 恢复集合
     */
    async restoreCollection(collectionId: string): Promise<void> {
        try {
            await this.update(collectionId, {
                isArchived: false,
                archivedAt: undefined
            });
        } catch (error) {
            console.error('[CollectionRepository] restoreCollection failed:', error);
            throw new Error('Failed to restore collection');
        }
    }

    /**
     * 🧹 清理过期的临时集合
     */
    async cleanupExpiredCollections(): Promise<number> {
        try {
            const now = DatabaseUtils.now();
            const expiredCollections = await this.table
                .where('type').equals('temporary')
                .filter(collection =>
                    collection.expiresAt && collection.expiresAt <= now as any
                )
                .toArray();

            if (expiredCollections.length > 0) {
                await this.bulkDelete(expiredCollections.map(collection => collection.id));
                console.log(`[CollectionRepository] Cleaned up ${expiredCollections.length} expired collections`);
            }

            return expiredCollections.length;
        } catch (error) {
            console.error('[CollectionRepository] cleanupExpiredCollections failed:', error);
            throw new Error('Failed to cleanup expired collections');
        }
    }

    /**
     * 📊 获取用户集合统计
     */
    async getUserCollectionStats(ownerUid: string): Promise<{
        total: number;
        byType: Record<CollectionType, number>;
        totalItems: number;
        averageItemsPerCollection: number;
    }> {
        try {
            const userCollections = await this.findByOwnerId(ownerUid);

            const stats = {
                total: userCollections.length,
                byType: {
                    general: 0,
                    topic: 0,
                    project: 0,
                    smart: 0,
                    temporary: 0
                } as Record<CollectionType, number>,
                totalItems: 0,
                averageItemsPerCollection: 0
            };

            userCollections.forEach(collection => {
                stats.byType[collection.type]++;
                stats.totalItems += collection.itemCount;
            });

            stats.averageItemsPerCollection = stats.total > 0 ?
                stats.totalItems / stats.total : 0;

            return stats;
        } catch (error) {
            console.error('[CollectionRepository] getUserCollectionStats failed:', error);
            throw new Error('Failed to get user collection statistics');
        }
    }
}

// 🏪 单例导出
export const collectionRepository = new CollectionRepository();
