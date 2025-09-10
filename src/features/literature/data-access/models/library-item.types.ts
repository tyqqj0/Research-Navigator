/**
 * 📚 Library Item Types - 核心文献条目类型定义
 * 
 * 迁移自: old/src/libs/db/schema.ts (LibraryItemSchema)
 * 优化: 分离用户元数据，简化核心结构，保持与后端API对齐
 */

import { z } from 'zod';
import { LiteratureSource, LITERATURE_SOURCES } from './literature-source.types';

// 🎯 核心文献实体 - 与后端严格对齐
export const LibraryItemSchema = z.object({
    // 🔑 主键 - 与后端LID保持一致
    paperId: z.string().uuid('Invalid UUID format'),

    // 📝 基础元数据
    title: z.string().min(1, 'Title is required'),
    authors: z.array(z.string()).min(1, 'At least one author is required'),
    year: z.number().int().min(1000).max(new Date().getFullYear() + 10),

    // 📚 出版信息
    publication: z.string().nullable().optional(),
    abstract: z.string().nullable().optional(),
    summary: z.string().nullable().optional(),

    // 🔗 标识符
    doi: z.string().nullable().optional(),
    url: z.string().url().nullable().optional(),

    // 📄 文件路径
    pdfPath: z.string().nullable().optional(),

    // 🏷️ 来源信息
    source: z.enum([
        LITERATURE_SOURCES.MANUAL,
        LITERATURE_SOURCES.SEARCH,
        LITERATURE_SOURCES.IMPORT,
        LITERATURE_SOURCES.KNOWLEDGE,
        LITERATURE_SOURCES.ZOTERO
    ]).optional(),

    // 🔍 解析内容 - 从PDF或后端解析的内容
    parsedContent: z.object({
        extractedText: z.string().nullable().optional(),
        extractedReferences: z.array(z.any()).optional(),
    }).optional(),

    // ⏰ 时间戳
    createdAt: z.date(),
    updatedAt: z.date().optional()
});

// 📊 后端任务状态类型 - 保留旧版强大的SSE功能
export const ComponentStatusSchema = z.object({
    status: z.enum(['success', 'processing', 'failed', 'pending']),
    stage: z.string(),
    progress: z.number().min(0).max(100),
    started_at: z.string().nullable(),
    completed_at: z.string().nullable(),
    error_info: z.object({}).nullable(),
    source: z.string().nullable(),
    attempts: z.number().min(0).max(3)
});

export const LiteratureStatusSchema = z.object({
    literature_id: z.string(),
    overall_status: z.enum(['completed', 'processing', 'failed']),
    overall_progress: z.number().min(0).max(100),
    component_status: z.object({
        metadata: ComponentStatusSchema,
        content: ComponentStatusSchema,
        references: ComponentStatusSchema
    }),
    created_at: z.string(),
    updated_at: z.string()
});

export const BackendTaskSchema = z.object({
    task_id: z.string(),
    execution_status: z.enum(['completed', 'processing', 'pending', 'failed']),
    result_type: z.enum(['created', 'duplicate']).nullable(),
    literature_id: z.string().nullable(),
    literature_status: LiteratureStatusSchema.nullable(),
    status: z.string(),
    overall_progress: z.number().min(0).max(100),
    current_stage: z.string().nullable(),
    resource_url: z.string().nullable(),
    error_info: z.object({}).nullable(),
    // 🔗 URL验证相关字段
    url_validation_status: z.enum(['success', 'failed']).nullable().optional(),
    url_validation_error: z.string().nullable().optional(),
    original_url: z.string().nullable().optional()
});

// 🎯 扩展的文献条目 - 包含后端任务信息
export const ExtendedLibraryItemSchema = LibraryItemSchema.extend({
    // 🚀 后端集成字段 - 保留旧版SSE实时更新能力
    backendTask: BackendTaskSchema.optional(),
});

// 📋 类型导出
export type LibraryItem = z.infer<typeof LibraryItemSchema>;
export type ExtendedLibraryItem = z.infer<typeof ExtendedLibraryItemSchema>;
export type BackendTask = z.infer<typeof BackendTaskSchema>;
export type LiteratureStatus = z.infer<typeof LiteratureStatusSchema>;
export type ComponentStatus = z.infer<typeof ComponentStatusSchema>;

// 🎯 创建文献条目的输入类型
export type CreateLibraryItemInput = Omit<LibraryItem, 'paperId' | 'createdAt' | 'updatedAt'>;
export type UpdateLibraryItemInput = Partial<Omit<LibraryItem, 'paperId' | 'createdAt'>>;

// 🔍 搜索和筛选类型
export type LiteratureFilter = {
    source?: LiteratureSource | 'all';
    searchTerm?: string;
    yearRange?: {
        start: number;
        end: number;
    };
    authors?: string[];
    hasAbstract?: boolean;
    hasPdf?: boolean;
};

export type LiteratureSortField = 'title' | 'year' | 'createdAt' | 'authors';
export type LiteratureSortOrder = 'asc' | 'desc';

export type LiteratureSort = {
    field: LiteratureSortField;
    order: LiteratureSortOrder;
};
