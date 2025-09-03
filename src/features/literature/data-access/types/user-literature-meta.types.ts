/**
 * 🏷️ User Literature Meta Types - 用户文献元数据类型定义
 * 
 * 新增功能: 分离用户个性化数据与核心文献数据
 * 设计原则: 核心数据 vs 用户元数据完全分离
 */

import { z } from 'zod';

// 🏷️ 用户文献元数据
export const UserLiteratureMetaSchema = z.object({
    // 🔑 唯一标识
    id: z.string().uuid(),

    // 👤 关联信息
    userId: z.string(), // 这个元数据属于哪个用户
    literatureId: z.string().uuid(), // 关联的文献ID (对应LibraryItem.id)

    // 🏷️ 用户标签
    tags: z.array(z.string()).default([]),

    // ⭐ 用户评级
    rating: z.number().min(1).max(5).optional(),

    // 📝 用户笔记
    personalNotes: z.string().optional(),

    // 🎯 阅读状态
    readingStatus: z.enum([
        'unread',      // 未读
        'reading',     // 阅读中
        'completed',   // 已完成
        'referenced',  // 仅参考
        'abandoned'    // 已放弃
    ]).default('unread'),

    // 📊 优先级
    priority: z.enum([
        'low',         // 低优先级
        'medium',      // 中优先级
        'high',        // 高优先级
        'urgent'       // 紧急
    ]).optional(),

    // 🔗 会话关联 - 保留旧版功能
    associatedSessions: z.array(z.string()).default([]),

    // 🏛️ 项目关联
    associatedProjects: z.array(z.string()).default([]),

    // 📂 自定义分类
    customCategories: z.array(z.string()).default([]),

    // 🔧 自定义字段 - 灵活扩展
    customFields: z.record(z.string(), z.any()).default({}),

    // ⏰ 时间戳
    createdAt: z.date(),
    updatedAt: z.date().optional(),

    // 📅 阅读相关时间
    lastAccessedAt: z.date().optional(),
    readingStartedAt: z.date().optional(),
    readingCompletedAt: z.date().optional(),
});

// 📋 类型导出
export type UserLiteratureMeta = z.infer<typeof UserLiteratureMetaSchema>;

// 🎯 输入类型
export type CreateUserLiteratureMetaInput = Omit<
    UserLiteratureMeta,
    'id' | 'createdAt' | 'updatedAt'
>;

export type UpdateUserLiteratureMetaInput = Partial<
    Omit<UserLiteratureMeta, 'id' | 'userId' | 'literatureId' | 'createdAt'>
>;

// 🔄 组合类型 - 包含用户元数据的增强文献
export type EnhancedLibraryItem = {
    // 核心文献数据
    literature: import('./library-item.types').LibraryItem;
    // 用户元数据
    userMeta?: UserLiteratureMeta;
};

// 📊 统计类型
export type UserLiteratureStats = {
    totalItems: number;
    readingStats: {
        unread: number;
        reading: number;
        completed: number;
        referenced: number;
        abandoned: number;
    };
    priorityStats: {
        low: number;
        medium: number;
        high: number;
        urgent: number;
    };
    tagStats: Array<{
        tag: string;
        count: number;
    }>;
    categoryStats: Array<{
        category: string;
        count: number;
    }>;
};

// 🔍 用户元数据筛选类型
export type UserMetaFilter = {
    tags?: string[];
    readingStatus?: UserLiteratureMeta['readingStatus'][];
    priority?: UserLiteratureMeta['priority'][];
    rating?: {
        min?: number;
        max?: number;
    };
    associatedSessions?: string[];
    associatedProjects?: string[];
    customCategories?: string[];
    hasPersonalNotes?: boolean;
};
