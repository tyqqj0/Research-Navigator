/**
 * 👤 User Meta Service - 用户文献元数据服务
 * 
 * 职责:
 * 1. 用户元数据的业务逻辑
 * 2. 用户偏好和标签管理
 * 3. 阅读状态和进度跟踪
 * 
 * 设计原则:
 * - 单一职责：只处理用户元数据相关业务
 * - 业务封装：将复杂的用户数据操作封装成简单接口
 * - 数据验证：确保用户数据的完整性和一致性
 */

import { userMetaRepository, type UserMetaRepository } from '../repositories';
import {
    UserLiteratureMeta,
    CreateUserLiteratureMetaInput,
    UpdateUserLiteratureMetaInput,
    UserLiteratureStats,
    UserMetaFilter,
} from '../models';
import { AppError, ErrorType, ErrorSeverity, handleError } from '../../../../lib/errors';

/**
 * 🔧 用户元数据创建选项
 */
export interface UserMetaCreateOptions {
    /** 自动设置默认标签 */
    autoSetDefaultTags?: boolean;
    /** 初始阅读状态 */
    initialReadingStatus?: UserLiteratureMeta['readingStatus'];
}

/**
 * 📊 用户元数据服务统计
 */
export interface UserMetaServiceStats {
    totalOperations: number;
    averageResponseTime: number;
    errorRate: number;
    lastOperationAt: Date;
}

/**
 * 👤 User Meta Service 类
 */
export class UserMetaService {
    private stats: UserMetaServiceStats = {
        totalOperations: 0,
        averageResponseTime: 0,
        errorRate: 0,
        lastOperationAt: new Date(),
    };

    constructor(
        private readonly userMetaRepo: UserMetaRepository = userMetaRepository
    ) { }

    // ==================== 核心业务方法 ====================

    /**
     * 🔍 获取用户文献元数据
     */
    async getUserMeta(userId: string, paperId: string): Promise<UserLiteratureMeta | null> {
        const startTime = Date.now();

        try {
            this.stats.totalOperations++;

            const userMeta = await this.userMetaRepo.findByUserAndLiterature(userId, paperId);

            this.updateStats(startTime, true);
            return userMeta;
        } catch (error) {
            this.updateStats(startTime, false);
            console.error('[UserMetaService] getUserMeta failed:', error);
            return null;
        }
    }

    /**
     * 📋 获取用户的所有文献元数据
     */
    async getUserAllMetas(userId: string, filter?: UserMetaFilter): Promise<UserLiteratureMeta[]> {
        const startTime = Date.now();

        try {
            this.stats.totalOperations++;

            let userMetas = await this.userMetaRepo.findByUserId(userId);

            // 应用过滤器
            if (filter) {
                userMetas = this.applyFilter(userMetas, filter);
            }

            this.updateStats(startTime, true);
            return userMetas;
        } catch (error) {
            this.updateStats(startTime, false);
            console.error('[UserMetaService] getUserAllMetas failed:', error);
            return [];
        }
    }

    /**
     * ✨ 创建用户文献元数据
     */
    async createUserMeta(
        userId: string,
        paperId: string,
        input: CreateUserLiteratureMetaInput,
        options: UserMetaCreateOptions = {}
    ): Promise<UserLiteratureMeta | null> {
        const startTime = Date.now();

        try {
            this.stats.totalOperations++;

            // 业务逻辑：设置默认值
            const metaData: CreateUserLiteratureMetaInput = {
                ...input,
                userId,
                paperId,
                readingStatus: options.initialReadingStatus || input.readingStatus || 'unread',
            };

            // 自动设置默认标签
            if (options.autoSetDefaultTags && !metaData.tags?.length) {
                metaData.tags = ['new'];
            }

            const result = await this.userMetaRepo.createOrUpdate(userId, paperId, metaData);
            const createdMeta = await this.userMetaRepo.findByUserAndLiterature(userId, paperId);

            this.updateStats(startTime, true);
            return createdMeta;
        } catch (error) {
            this.updateStats(startTime, false);
            console.error('[UserMetaService] createUserMeta failed:', error);
            return null;
        }
    }

    /**
     * 📝 更新用户文献元数据
     */
    async updateUserMeta(
        userId: string,
        paperId: string,
        updates: UpdateUserLiteratureMetaInput
    ): Promise<UserLiteratureMeta | null> {
        const startTime = Date.now();

        try {
            this.stats.totalOperations++;

            // 业务逻辑：更新时间戳
            const updateData = {
                ...updates,
                updatedAt: new Date(),
            };

            // 业务逻辑：阅读状态变更时更新相关时间戳
            if (updates.readingStatus) {
                switch (updates.readingStatus) {
                    case 'reading':
                        updateData.readingStartedAt = new Date();
                        break;
                    case 'completed':
                        updateData.readingCompletedAt = new Date();
                        break;
                }
            }

            await this.userMetaRepo.update(paperId, updateData);
            const updatedMeta = await this.userMetaRepo.findByUserAndLiterature(userId, paperId);

            this.updateStats(startTime, true);
            return updatedMeta;
        } catch (error) {
            this.updateStats(startTime, false);
            console.error('[UserMetaService] updateUserMeta failed:', error);
            return null;
        }
    }

    /**
     * 🗑️ 删除用户文献元数据
     */
    async deleteUserMeta(userId: string, paperId: string): Promise<boolean> {
        const startTime = Date.now();

        try {
            this.stats.totalOperations++;

            await this.userMetaRepo.delete(paperId);

            this.updateStats(startTime, true);
            return true;
        } catch (error) {
            this.updateStats(startTime, false);
            console.error('[UserMetaService] deleteUserMeta failed:', error);
            return false;
        }
    }

    // ==================== 业务逻辑方法 ====================

    /**
     * 🏷️ 添加标签到文献
     */
    async addTag(userId: string, paperId: string, tag: string): Promise<boolean> {
        try {
            const userMeta = await this.getUserMeta(userId, paperId);
            if (!userMeta) return false;

            const currentTags = userMeta.tags || [];
            if (!currentTags.includes(tag)) {
                const updatedTags = [...currentTags, tag];
                await this.updateUserMeta(userId, paperId, { tags: updatedTags });
                return true;
            }

            return false; // 标签已存在
        } catch (error) {
            console.error('[UserMetaService] addTag failed:', error);
            return false;
        }
    }

    /**
     * 🗑️ 从文献移除标签
     */
    async removeTag(userId: string, paperId: string, tag: string): Promise<boolean> {
        try {
            const userMeta = await this.getUserMeta(userId, paperId);
            if (!userMeta) return false;

            const currentTags = userMeta.tags || [];
            if (currentTags.includes(tag)) {
                const updatedTags = currentTags.filter(t => t !== tag);
                await this.updateUserMeta(userId, paperId, { tags: updatedTags });
                return true;
            }

            return false; // 标签不存在
        } catch (error) {
            console.error('[UserMetaService] removeTag failed:', error);
            return false;
        }
    }

    /**
     * ⭐ 设置文献评分
     */
    async setRating(userId: string, paperId: string, rating: number): Promise<boolean> {
        try {
            if (rating < 1 || rating > 5) {
                throw new Error('Rating must be between 1 and 5');
            }

            await this.updateUserMeta(userId, paperId, { rating });
            return true;
        } catch (error) {
            console.error('[UserMetaService] setRating failed:', error);
            return false;
        }
    }

    /**
     * 📊 获取用户统计信息
     */
    async getUserStats(userId: string): Promise<UserLiteratureStats> {
        try {
            const userMetas = await this.getUserAllMetas(userId);

            const stats: UserLiteratureStats = {
                totalItems: userMetas.length,
                readingStats: {
                    unread: 0,
                    reading: 0,
                    completed: 0,
                    referenced: 0,
                    abandoned: 0,
                },
                priorityStats: {
                    low: 0,
                    medium: 0,
                    high: 0,
                    urgent: 0,
                },
                tagStats: [],
            };

            // 计算统计信息
            const tagCounts = new Map<string, number>();

            userMetas.forEach(meta => {
                // 阅读状态统计
                stats.readingStats[meta.readingStatus]++;

                // 优先级统计
                if (meta.priority) {
                    stats.priorityStats[meta.priority]++;
                }

                // 标签统计
                meta.tags?.forEach(tag => {
                    tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
                });

                // 分类统计移除
            });

            // 转换为数组格式
            stats.tagStats = Array.from(tagCounts.entries())
                .map(([tag, count]) => ({ tag, count }))
                .sort((a, b) => b.count - a.count);

            // 分类统计移除

            return stats;
        } catch (error) {
            console.error('[UserMetaService] getUserStats failed:', error);
            return {
                totalItems: 0,
                readingStats: { unread: 0, reading: 0, completed: 0, referenced: 0, abandoned: 0 },
                priorityStats: { low: 0, medium: 0, high: 0, urgent: 0 },
                tagStats: [],
            };
        }
    }

    // ==================== 工具方法 ====================

    /**
     * 📊 获取服务统计信息
     */
    getServiceStats(): UserMetaServiceStats {
        return { ...this.stats };
    }

    /**
     * 🧹 清理缓存
     */
    async clearCache(): Promise<void> {
        // 如果有缓存实现，在这里清理
        console.log('[UserMetaService] Cache cleared');
    }

    // ==================== 私有辅助方法 ====================

    /**
     * 🔍 应用过滤器
     */
    private applyFilter(userMetas: UserLiteratureMeta[], filter: UserMetaFilter): UserLiteratureMeta[] {
        return userMetas.filter(meta => {
            // 标签过滤
            if (filter.tags?.length) {
                const hasMatchingTag = filter.tags.some(tag => meta.tags?.includes(tag));
                if (!hasMatchingTag) return false;
            }

            // 阅读状态过滤
            if (filter.readingStatus?.length) {
                if (!filter.readingStatus.includes(meta.readingStatus)) return false;
            }

            // 优先级过滤
            if (filter.priority?.length) {
                if (!meta.priority || !filter.priority.includes(meta.priority)) return false;
            }

            // 评分过滤
            if (filter.rating) {
                if (!meta.rating) return false;
                if (filter.rating.min && meta.rating < filter.rating.min) return false;
                if (filter.rating.max && meta.rating > filter.rating.max) return false;
            }

            // 笔记过滤
            if (filter.hasPersonalNotes !== undefined) {
                const hasNotes = !!meta.personalNotes && meta.personalNotes.trim().length > 0;
                if (filter.hasPersonalNotes !== hasNotes) return false;
            }

            return true;
        });
    }

    /**
     * 📊 更新统计信息
     */
    private updateStats(startTime: number, success: boolean): void {
        const responseTime = Date.now() - startTime;

        // 更新平均响应时间
        this.stats.averageResponseTime =
            (this.stats.averageResponseTime * (this.stats.totalOperations - 1) + responseTime)
            / this.stats.totalOperations;

        // 更新错误率
        if (!success) {
            this.stats.errorRate =
                (this.stats.errorRate * (this.stats.totalOperations - 1) + 1)
                / this.stats.totalOperations;
        } else {
            this.stats.errorRate =
                (this.stats.errorRate * (this.stats.totalOperations - 1))
                / this.stats.totalOperations;
        }

        this.stats.lastOperationAt = new Date();
    }
}

// 导出单例实例
export const userMetaService = new UserMetaService();
