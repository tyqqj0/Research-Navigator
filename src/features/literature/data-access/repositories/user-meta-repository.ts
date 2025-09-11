/**
 * 👤 User Literature Meta Repository - 用户文献元数据仓储
 * 
 * 新增功能: 管理用户个性化文献数据
 * 设计原则: 与核心文献数据完全分离
 */

import { BaseRepository } from './base-repository';
import { literatureDB, DatabaseUtils } from '../database';
import {
    UserLiteratureMeta,
    CreateUserLiteratureMetaInput,
    UpdateUserLiteratureMetaInput,
    UserMetaFilter,
    UserLiteratureStats,
    UserLiteratureMetaSchema
} from '../models';
import type { Table } from 'dexie';

/**
 * 👤 用户文献元数据仓储实现
 */
export class UserMetaRepository extends BaseRepository<UserLiteratureMeta, string> {
    protected table: Table<UserLiteratureMeta, string>;

    constructor() {
        super();
        this.table = literatureDB.userMetas;
    }

    protected generateId(): string {
        return DatabaseUtils.generateId();
    }

    /**
     * 🔍 根据用户ID和文献ID查找元数据
     */
    async findByUserAndLiterature(userId: string, paperId: string): Promise<UserLiteratureMeta | null> {
        try {
            const meta = await this.table
                .where('[userId+paperId]')
                .equals([userId, paperId])
                .first();

            return meta || null;
        } catch (error) {
            console.error('[UserMetaRepository] findByUserAndLiterature failed:', error);
            return null;
        }
    }

    /**
     * 📋 获取用户的所有文献元数据
     */
    async findByUserId(userId: string): Promise<UserLiteratureMeta[]> {
        try {
            return await this.table.where('userId').equals(userId).toArray();
        } catch (error) {
            console.error('[UserMetaRepository] findByUserId failed:', error);
            return [];
        }
    }

    /**
     * 📚 获取文献的所有用户元数据
     */
    async findByLiteratureId(paperId: string): Promise<UserLiteratureMeta[]> {
        try {
            return await this.table.where('paperId').equals(paperId).toArray();
        } catch (error) {
            console.error('[UserMetaRepository] findByLiteratureId failed:', error);
            return [];
        }
    }

    /**
     * 🔍 高级筛选查询
     */
    async searchWithFilters(
        userId: string,
        filter: UserMetaFilter = {},
        page: number = 1,
        pageSize: number = 20
    ): Promise<{
        items: UserLiteratureMeta[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    }> {
        try {
            let query = this.table.where('userId').equals(userId);

            // 🏷️ 标签筛选
            if (filter.tags && filter.tags.length > 0) {
                query = query.filter(meta =>
                    filter.tags!.some(tag => meta.tags.includes(tag))
                );
            }

            // 📖 阅读状态筛选
            if (filter.readingStatus && filter.readingStatus.length > 0) {
                query = query.filter(meta =>
                    filter.readingStatus!.includes(meta.readingStatus)
                );
            }

            // ⭐ 优先级筛选
            if (filter.priority && filter.priority.length > 0) {
                query = query.filter(meta =>
                    meta.priority ? filter.priority!.includes(meta.priority) : false
                );
            }

            // ⭐ 评分筛选
            if (filter.rating) {
                query = query.filter(meta => {
                    if (!meta.rating) return false;
                    const min = filter.rating!.min ?? 0;
                    const max = filter.rating!.max ?? 5;
                    return meta.rating >= min && meta.rating <= max;
                });
            }

            // 📝 笔记筛选
            if (filter.hasPersonalNotes !== undefined) {
                query = query.filter(meta =>
                    filter.hasPersonalNotes ? !!meta.personalNotes : !meta.personalNotes
                );
            }

            return await this.paginate(query, page, pageSize);
        } catch (error) {
            console.error('[UserMetaRepository] searchWithFilters failed:', error);
            throw new Error('Failed to search user metadata with filters');
        }
    }

    /**
     * 🎯 创建或更新用户元数据
     */
    async createOrUpdate(
        userId: string,
        paperId: string,
        input: Omit<CreateUserLiteratureMetaInput, 'userId' | 'paperId'>
    ): Promise<string> {
        try {
            const existing = await this.findByUserAndLiterature(userId, paperId);

            if (existing) {
                // 更新现有元数据
                await this.update(existing.id, {
                    ...input,
                    updatedAt: DatabaseUtils.now()
                });
                return existing.id;
            } else {
                // 创建新元数据
                const now = DatabaseUtils.now();
                const newMeta: UserLiteratureMeta = {
                    id: this.generateId(),
                    userId,
                    paperId,
                    ...input,
                    tags: input.tags || [],
                    readingStatus: input.readingStatus || 'unread',
                    customFields: input.customFields || {},
                    createdAt: now,
                    updatedAt: now
                };

                // 验证数据
                const validatedMeta = UserLiteratureMetaSchema.parse(newMeta);
                await this.table.add(validatedMeta);

                return newMeta.id;
            }
        } catch (error) {
            console.error('[UserMetaRepository] createOrUpdate failed:', error);
            throw new Error('Failed to create or update user metadata');
        }
    }

    /**
     * 🏷️ 添加标签到文献
     */
    async addTag(userId: string, paperId: string, tag: string): Promise<void> {
        try {
            const meta = await this.findByUserAndLiterature(userId, paperId);

            if (meta) {
                if (!meta.tags.includes(tag)) {
                    const updatedTags = [...meta.tags, tag];
                    await this.update(meta.id, { tags: updatedTags });
                }
            } else {
                // 创建新元数据
                await this.createOrUpdate(userId, paperId, {
                    tags: [tag],
                    readingStatus: 'unread',
                    customFields: {}
                });
            }
        } catch (error) {
            console.error('[UserMetaRepository] addTag failed:', error);
            throw new Error('Failed to add tag');
        }
    }

    /**
     * 🗑️ 从文献移除标签
     */
    async removeTag(userId: string, paperId: string, tag: string): Promise<void> {
        try {
            const meta = await this.findByUserAndLiterature(userId, paperId);

            if (meta && meta.tags.includes(tag)) {
                const updatedTags = meta.tags.filter(t => t !== tag);
                await this.update(meta.id, { tags: updatedTags });
            }
        } catch (error) {
            console.error('[UserMetaRepository] removeTag failed:', error);
            throw new Error('Failed to remove tag');
        }
    }

    /**
     * 📊 获取用户文献统计
     */
    async getUserStatistics(userId: string): Promise<UserLiteratureStats> {
        try {
            const userMetas = await this.findByUserId(userId);

            const stats: UserLiteratureStats = {
                totalItems: userMetas.length,
                readingStats: {
                    unread: 0,
                    reading: 0,
                    completed: 0,
                    referenced: 0,
                    abandoned: 0
                },
                priorityStats: {
                    low: 0,
                    medium: 0,
                    high: 0,
                    urgent: 0
                },
                tagStats: [],
                categoryStats: []
            };

            // 计算阅读状态统计
            userMetas.forEach(meta => {
                stats.readingStats[meta.readingStatus]++;

                if (meta.priority) {
                    stats.priorityStats[meta.priority]++;
                }
            });

            // 计算标签统计
            const tagCounts = new Map<string, number>();
            userMetas.forEach(meta => {
                meta.tags.forEach(tag => {
                    tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
                });
            });

            stats.tagStats = Array.from(tagCounts.entries())
                .map(([tag, count]) => ({ tag, count }))
                .sort((a, b) => b.count - a.count);

            return stats;
        } catch (error) {
            console.error('[UserMetaRepository] getUserStatistics failed:', error);
            throw new Error('Failed to get user statistics');
        }
    }

    /**
     * 🔗 更新会话关联
     */
    // deprecated session associations removed

    /**
     * 🧹 清理孤儿元数据
     */
    async cleanupOrphanedMetas(validLiteratureIds: string[]): Promise<number> {
        try {
            const validIdsSet = new Set(validLiteratureIds);
            const allMetas = await this.table.toArray();

            const orphanedMetas = allMetas.filter(meta =>
                !validIdsSet.has(meta.paperId)
            );

            if (orphanedMetas.length > 0) {
                await this.bulkDelete(orphanedMetas.map(meta => meta.id));
                console.log(`[UserMetaRepository] Cleaned up ${orphanedMetas.length} orphaned metadata`);
            }

            return orphanedMetas.length;
        } catch (error) {
            console.error('[UserMetaRepository] cleanupOrphanedMetas failed:', error);
            throw new Error('Failed to cleanup orphaned metadata');
        }
    }
}

// 🏪 单例导出
export const userMetaRepository = new UserMetaRepository();
