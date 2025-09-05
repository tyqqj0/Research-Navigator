/**
 * 📂 Collection Types - 文献集合类型定义
 * 
 * 设计理念: 统一"文献集合"和"研究话题"概念，通过type字段区分
 * 新增功能: 支持层次结构、智能分组、动态规则
 */

import { z } from 'zod';
import { LiteratureFilter } from './library-item.types';

// 📂 集合类型枚举
export const COLLECTION_TYPES = {
    GENERAL: 'general',        // 通用文献集合
    TOPIC: 'topic',           // 研究话题集合
    PROJECT: 'project',       // 项目关联集合
    SMART: 'smart',          // 智能规则集合
    TEMPORARY: 'temporary'    // 临时集合
} as const;

export type CollectionType = typeof COLLECTION_TYPES[keyof typeof COLLECTION_TYPES];

// 🎯 智能集合规则 - 动态筛选规则
export const SmartCollectionRuleSchema = z.object({
    id: z.string(),
    name: z.string(),

    // 🔍 筛选条件
    filter: z.object({
        // 基础筛选 (继承自LiteratureFilter)
        source: z.array(z.string()).optional(),
        searchTerm: z.string().optional(),
        yearRange: z.object({
            start: z.number(),
            end: z.number()
        }).optional(),
        authors: z.array(z.string()).optional(),
        hasAbstract: z.boolean().optional(),
        hasPdf: z.boolean().optional(),

        // 高级筛选
        tags: z.array(z.string()).optional(),
        readingStatus: z.array(z.string()).optional(),
        priority: z.array(z.string()).optional(),
        rating: z.object({
            min: z.number().optional(),
            max: z.number().optional()
        }).optional(),

        // 引文关系筛选
        citationCount: z.object({
            min: z.number().optional(),
            max: z.number().optional()
        }).optional(),

        // 时间筛选
        createdAfter: z.date().optional(),
        createdBefore: z.date().optional(),
        lastAccessedAfter: z.date().optional(),
    }),

    // 🔄 规则逻辑
    operator: z.enum(['AND', 'OR']).default('AND'),

    // ⚡ 自动更新
    autoUpdate: z.boolean().default(true),
    updateInterval: z.number().default(3600), // 秒

    // ⏰ 时间戳
    createdAt: z.date(),
    updatedAt: z.date().optional(),
});

// ==================== Store层数据 ====================

// 📂 集合 - 仓库级别的原子数据
export const CollectionSchema = z.object({
    // 🔑 唯一标识
    id: z.string().uuid(),

    // 📝 基本信息
    name: z.string().min(1, 'Collection name is required'),
    description: z.string().optional(),

    // 🎯 集合类型
    type: z.enum([
        COLLECTION_TYPES.GENERAL,
        COLLECTION_TYPES.TOPIC,
        COLLECTION_TYPES.PROJECT,
        COLLECTION_TYPES.SMART,
        COLLECTION_TYPES.TEMPORARY
    ]),

    // 👤 所有者信息
    ownerUid: z.string(),
    isPublic: z.boolean().default(false),

    // 📚 文献关联 - 核心关系数据
    lids: z.array(z.string()).default([]),

    // 🤖 智能规则 (仅SMART类型使用)
    smartRule: SmartCollectionRuleSchema.optional(),

    // 🏗️ 层次结构 - 核心结构数据
    parentId: z.string().uuid().nullable().optional(),
    childIds: z.array(z.string()).default([]),

    // ⏰ 时间戳
    createdAt: z.date(),
    updatedAt: z.date().optional(),

    // 🗂️ 基础状态
    isArchived: z.boolean().default(false),
    expiresAt: z.date().optional(), // 过期时间 (TEMPORARY类型)
});

// ==================== UI层数据 ====================

// 🎨 集合UI配置 - UI层管理的展示数据
export const CollectionUIConfigSchema = z.object({
    collectionId: z.string().uuid(),

    // 🏷️ 视觉配置
    icon: z.string().optional(),
    color: z.string().optional(),

    // 🔧 用户偏好设置
    sortBy: z.enum(['title', 'year', 'createdAt', 'addedAt']).default('addedAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    viewMode: z.enum(['list', 'grid', 'compact']).default('list'),

    // 🔔 通知设置
    notifyOnUpdate: z.boolean().default(false),

    // ⏰ 时间戳
    updatedAt: z.date(),
});

// ==================== 统计层数据 ====================

// 📊 集合统计 - 独立的统计数据
export const CollectionStatsSchema = z.object({
    collectionId: z.string().uuid(),

    // 基础统计
    itemCount: z.number().default(0),
    lastItemAddedAt: z.date().optional(),

    // 详细统计
    sourceDistribution: z.record(z.string(), z.number()),
    yearDistribution: z.record(z.string(), z.number()),

    // ⏰ 统计时间
    calculatedAt: z.date(),
});

// ==================== 兼容性类型 ====================

// 📂 完整集合 - 向后兼容的完整类型（用于迁移期间）
export const LegacyCollectionSchema = CollectionSchema.extend({
    // UI配置字段（将逐步迁移到CollectionUIConfig）
    icon: z.string().optional(),
    color: z.string().optional(),
    settings: z.object({
        sortBy: z.enum(['title', 'year', 'createdAt', 'addedAt']).default('addedAt'),
        sortOrder: z.enum(['asc', 'desc']).default('desc'),
        autoArchive: z.boolean().default(false),
        archiveAfterDays: z.number().optional(),
        notifyOnUpdate: z.boolean().default(false),
    }).default({
        sortBy: 'addedAt',
        sortOrder: 'desc',
        autoArchive: false,
        notifyOnUpdate: false
    }),

    // 统计字段（将逐步迁移到CollectionStats）
    itemCount: z.number().default(0),
    lastItemAddedAt: z.date().optional(),

    // 其他遗留字段
    topicId: z.string().nullable().optional(),
    projectId: z.string().nullable().optional(),
    depth: z.number().default(0),
    archivedAt: z.date().optional(),
});

// ==================== 高级统计数据 ====================

// 📊 详细集合统计 - 用于分析和报告
export const DetailedCollectionStatsSchema = z.object({
    collectionId: z.string().uuid(),

    // 基础统计
    totalItems: z.number(),

    // 📚 文献分布
    sourceDistribution: z.record(z.string(), z.number()),
    yearDistribution: z.record(z.string(), z.number()),
    authorDistribution: z.array(z.object({
        author: z.string(),
        count: z.number()
    })),

    // 🏷️ 标签统计
    tagDistribution: z.array(z.object({
        tag: z.string(),
        count: z.number()
    })),

    // 📈 趋势数据
    additionTrend: z.array(z.object({
        date: z.date(),
        count: z.number()
    })),

    // ⭐ 质量指标
    averageRating: z.number().optional(),
    completionRate: z.number(), // 阅读完成率

    // 🔗 引文分析
    citationStats: z.object({
        totalCitations: z.number(),
        averageCitationsPerItem: z.number(),
        mostCitedItem: z.object({
            id: z.string(),
            citationCount: z.number()
        }).optional(),
    }),

    // ⏰ 更新时间
    calculatedAt: z.date(),
});

// ==================== 类型导出 ====================

// 核心类型
export type Collection = z.infer<typeof CollectionSchema>;
export type SmartCollectionRule = z.infer<typeof SmartCollectionRuleSchema>;

// UI和统计类型
export type CollectionUIConfig = z.infer<typeof CollectionUIConfigSchema>;
export type CollectionStats = z.infer<typeof CollectionStatsSchema>;
export type DetailedCollectionStats = z.infer<typeof DetailedCollectionStatsSchema>;

// 兼容性类型
export type LegacyCollection = z.infer<typeof LegacyCollectionSchema>;

// ==================== 输入类型 ====================

// 创建集合输入 - 基于核心Collection类型
export type CreateCollectionInput = Omit<Collection, 'id' | 'createdAt' | 'updatedAt' | 'childIds'>;
export type UpdateCollectionInput = Partial<Omit<Collection, 'id' | 'ownerUid' | 'createdAt'>>;

// 🔍 集合查询类型
export type CollectionQuery = {
    ownerUid?: string;
    type?: CollectionType;
    isPublic?: boolean;
    parentId?: string | null;
    isArchived?: boolean;
    searchTerm?: string;
    hasItems?: boolean;
};

// 📊 集合排序类型
export type CollectionSort = {
    field: 'name' | 'createdAt' | 'updatedAt' | 'itemCount';
    order: 'asc' | 'desc';
};

// 🔄 集合操作类型
export type CollectionOperation = {
    type: 'add_literature' | 'remove_literature' | 'move_literature' | 'copy_literature';
    lids: string[];
    targetCollectionId?: string; // 用于move/copy操作
};

// 🤖 智能集合执行结果
export type SmartCollectionResult = {
    collectionId: string;
    matchedItems: string[];
    addedItems: string[];
    removedItems: string[];
    totalMatched: number;
    executedAt: Date;
    executionTime: number; // 毫秒
};
