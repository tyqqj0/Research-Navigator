/**
 * 📂 Collection Repository - 文献集合仓储
 * 
 * 新增功能: 统一的集合管理（通用集合、话题集合、智能集合等）
 * 设计原则: 支持层次结构、智能规则、动态更新
 */

import { BaseRepository } from './base-repository';
import { DatabaseUtils } from '../database';
import type { CollectionsArchiveDatabase } from '../database/collections-database';
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

    constructor(db: CollectionsArchiveDatabase) {
        super();
        this.table = db.collections;
    }

    private async ensureDbOpen(): Promise<void> {
        const anyTable: any = this.table as any;
        const db = anyTable?.db;
        if (db && typeof db.isOpen === 'function' && !db.isOpen()) {
            try { await db.open(); } catch { /* noop */ }
        }
    }

    private async withDexieRetry<T>(op: () => Promise<T>, attempts = 2): Promise<T> {
        let lastErr: unknown = null;
        for (let i = 0; i < Math.max(1, attempts); i++) {
            try {
                await this.ensureDbOpen();
                return await op();
            } catch (e: any) {
                lastErr = e;
                const msg = String(e?.message || e || '');
                const transient = msg.includes('DatabaseClosedError') || msg.includes('InvalidState') || msg.includes('VersionChangeError');
                if (!transient || i === attempts - 1) break;
                // brief backoff then retry
                try { await new Promise(r => setTimeout(r, 40 + i * 40)); } catch { /* noop */ }
            }
        }
        throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
    }

    protected generateId(): string {
        return DatabaseUtils.generateId();
    }

    /**
     * 🔍 根据所有者ID查找集合
     */
    async findByOwnerId(ownerUid: string): Promise<Collection[]> {
        try {
            const anyTable: any = this.table as any;
            const db = anyTable?.db;
            try { await db?.open?.(); } catch { /* ignore */ }
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
            const anyTable: any = this.table as any;
            const db = anyTable?.db;
            try { await db?.open?.(); } catch { /* ignore */ }
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
            const anyTable: any = this.table as any;
            const db = anyTable?.db;
            try { await db?.open?.(); } catch { /* ignore */ }
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
            const anyTable: any = this.table as any;
            const db = anyTable?.db;
            try { await db?.open?.(); } catch { /* ignore */ }
            const allCollections = await this.findByOwnerId(ownerUid);

            // 构建层次结构
            const collectionsMap = new Map<string, Collection>();
            allCollections.forEach(collection => {
                collectionsMap.set(collection.id, collection);
            });

            // 计算层次关系（子集合ID）
            allCollections.forEach(collection => {
                if (collection.parentId && collectionsMap.has(collection.parentId)) {
                    const parent = collectionsMap.get(collection.parentId)!;
                    if (!parent.childIds.includes(collection.id)) {
                        parent.childIds.push(collection.id);
                    }
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
            return await this.withDexieRetry(async () => {
                await this.ensureDbOpen();
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
                    const pid = query.parentId;
                    collection = collection.filter(item => (item.parentId ?? null) === pid);
                }

                if (query.isArchived !== undefined) {
                    collection = collection.filter(item => item.isArchived === query.isArchived);
                }

                if (query.searchTerm && typeof query.searchTerm === 'string') {
                    const searchTerm = query.searchTerm.toLowerCase();
                    collection = collection.filter(item =>
                        (item.name || '').toLowerCase().includes(searchTerm) ||
                        (!!item.description && (item.description || '').toLowerCase().includes(searchTerm))
                    );
                }

                if (query.hasItems !== undefined) {
                    collection = collection.filter(item =>
                        query.hasItems ? item.itemCount > 0 : item.itemCount === 0
                    );
                }

                // 排序与分页：统一在内存中对已过滤结果排序，避免因不同 Dexie 对象混用导致的异常
                let items: Collection[] = await collection.toArray();

                const direction = sort.order === 'desc' ? -1 : 1;
                const safeDate = (d?: Date | null) => (d instanceof Date ? d.getTime() : 0);
                const safeString = (s?: string | null) => (typeof s === 'string' ? s : '');

                if (sort.field === 'name') {
                    items.sort((a, b) => safeString(a.name).localeCompare(safeString(b.name)) * direction);
                } else if (sort.field === 'itemCount') {
                    items.sort((a, b) => (((a.itemCount || 0) - (b.itemCount || 0)) * direction));
                } else if (sort.field === 'updatedAt') {
                    items.sort((a, b) => (safeDate(a.updatedAt) - safeDate(b.updatedAt)) * direction);
                } else {
                    items.sort((a, b) => (safeDate(a.createdAt) - safeDate(b.createdAt)) * direction);
                }

                const total = items.length;
                const start = (page - 1) * pageSize;
                const paged = items.slice(start, start + pageSize);

                return {
                    items: paged,
                    total,
                    page,
                    pageSize,
                    totalPages: Math.ceil(total / pageSize)
                };
            });
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
                paperIds: input.paperIds || [],
                childIds: [],
                itemCount: input.paperIds?.length || 0,
                isArchived: false,
                createdAt: now,
                updatedAt: now
            };

            // 验证数据
            const validatedCollection = CollectionSchema.parse(collection);
            await this.table.add(validatedCollection);
            try {
                const { ArchiveManager } = require('@/lib/archive/manager');
                const sessionRepo = ArchiveManager.getServices().sessionRepository;
                await sessionRepo.markSyncDirty(`rn.v1.collection.${collection.id}`, true);
            } catch { /* noop */ }

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
        paperIds: string[]
    ): Promise<void> {
        try {
            const collection = await this.findById(collectionId);
            if (!collection) {
                throw new Error(`Collection ${collectionId} not found`);
            }

            // 去重添加
            const existingIds = new Set(collection.paperIds);
            const newIds = paperIds.filter(id => !existingIds.has(id));

            if (newIds.length > 0) {
                const updatedLiteratureIds = [...collection.paperIds, ...newIds];
                await this.update(collectionId, {
                    paperIds: updatedLiteratureIds,
                    itemCount: updatedLiteratureIds.length,
                    lastItemAddedAt: DatabaseUtils.now()
                });
                try {
                    const { ArchiveManager } = require('@/lib/archive/manager');
                    const sessionRepo = ArchiveManager.getServices().sessionRepository;
                    await sessionRepo.markSyncDirty(`rn.v1.collection.${collectionId}`, true);
                } catch { /* noop */ }
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
        paperIds: string[]
    ): Promise<void> {
        try {
            const collection = await this.findById(collectionId);
            if (!collection) {
                throw new Error(`Collection ${collectionId} not found`);
            }

            const idsToRemove = new Set(paperIds);
            const updatedLiteratureIds = collection.paperIds.filter(
                id => !idsToRemove.has(id)
            );

            await this.update(collectionId, {
                paperIds: updatedLiteratureIds,
                itemCount: updatedLiteratureIds.length
            });
            try {
                const { ArchiveManager } = require('@/lib/archive/manager');
                const sessionRepo = ArchiveManager.getServices().sessionRepository;
                await sessionRepo.markSyncDirty(`rn.v1.collection.${collectionId}`, true);
            } catch { /* noop */ }
        } catch (error) {
            console.error('[CollectionRepository] removeLiterature failed:', error);
            throw new Error('Failed to remove literature from collection');
        }
    }

    /**
     * 🧹 从指定用户的所有集合中移除文献
     */
    async removeLiteratureFromAllUserCollections(ownerUid: string, paperId: string): Promise<number> {
        try {
            const collections = await this.findByOwnerId(ownerUid);
            let affected = 0;
            for (const c of collections) {
                if (c.paperIds.includes(paperId)) {
                    const updated = c.paperIds.filter(id => id !== paperId);
                    await this.update(c.id, { paperIds: updated, itemCount: updated.length });
                    affected++;
                    try {
                        const { ArchiveManager } = require('@/lib/archive/manager');
                        const sessionRepo = ArchiveManager.getServices().sessionRepository;
                        await sessionRepo.markSyncDirty(`rn.v1.collection.${c.id}`, true);
                    } catch { /* noop */ }
                }
            }
            return affected;
        } catch (error) {
            console.error('[CollectionRepository] removeLiteratureFromAllUserCollections failed:', error);
            throw new Error('Failed to remove literature from user collections');
        }
    }

    /**
     * 🧹 从所有集合中移除某个文献（全局）
     */
    async removeLiteratureFromAllCollections(paperId: string): Promise<number> {
        try {
            const all = await this.table.toArray();
            let affected = 0;
            for (const c of all) {
                if (c.paperIds.includes(paperId)) {
                    const updated = c.paperIds.filter(id => id !== paperId);
                    await this.update(c.id, { paperIds: updated, itemCount: updated.length });
                    affected++;
                    try {
                        const { ArchiveManager } = require('@/lib/archive/manager');
                        const sessionRepo = ArchiveManager.getServices().sessionRepository;
                        await sessionRepo.markSyncDirty(`rn.v1.collection.${c.id}`, true);
                    } catch { /* noop */ }
                }
            }
            return affected;
        } catch (error) {
            console.error('[CollectionRepository] removeLiteratureFromAllCollections failed:', error);
            throw new Error('Failed to remove literature from all collections');
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
                    await this.addLiterature(operation.targetCollectionId, operation.paperIds);
                    try {
                        const { ArchiveManager } = require('@/lib/archive/manager');
                        const sessionRepo = ArchiveManager.getServices().sessionRepository;
                        await sessionRepo.markSyncDirty(`rn.v1.collection.${operation.targetCollectionId}`, true);
                    } catch { /* noop */ }
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
        paperIds: string[]
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
            const matchedItems = paperIds; // 实际需要根据规则筛选
            const currentItems = new Set(collection.paperIds);

            const addedItems = matchedItems.filter(id => !currentItems.has(id));
            const removedItems = collection.paperIds.filter(id => !matchedItems.includes(id));

            // 更新集合
            await this.update(collectionId, {
                paperIds: matchedItems,
                itemCount: matchedItems.length,
                lastItemAddedAt: addedItems.length > 0 ? DatabaseUtils.now() : collection.lastItemAddedAt
            });
            try {
                const { ArchiveManager } = require('@/lib/archive/manager');
                const sessionRepo = ArchiveManager.getServices().sessionRepository;
                await sessionRepo.markSyncDirty(`rn.v1.collection.${collectionId}`, true);
            } catch { /* noop */ }

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
                collectionId: collection.id,
                itemCount: collection.itemCount,
                lastItemAddedAt: collection.lastItemAddedAt,
                sourceDistribution: {},
                yearDistribution: {},
                calculatedAt: DatabaseUtils.now()
            } as any;

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
            } as any);
            try {
                const { ArchiveManager } = require('@/lib/archive/manager');
                const sessionRepo = ArchiveManager.getServices().sessionRepository;
                await sessionRepo.markSyncDirty(`rn.v1.collection.${collectionId}`, true);
            } catch { /* noop */ }
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
            } as any);
            try {
                const { ArchiveManager } = require('@/lib/archive/manager');
                const sessionRepo = ArchiveManager.getServices().sessionRepository;
                await sessionRepo.markSyncDirty(`rn.v1.collection.${collectionId}`, true);
            } catch { /* noop */ }
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
export function createCollectionRepository(db: CollectionsArchiveDatabase) {
    return new CollectionRepository(db);
}
