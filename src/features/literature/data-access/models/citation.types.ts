/**
 * 🔗 Citation Types - 引文关系类型定义
 * 
 * 简化版本：专注于纯关系存储，复杂分析在应用层处理
 * 设计原则：轻量、高效、职责单一
 */

import { z } from 'zod';

// 🔗 基础引文关系 - 极简设计
export const CitationSchema = z.object({
    // 📚 核心关系定义
    sourceItemId: z.string().uuid('Invalid source UUID format'), // 引用方LID
    // 允许目标为非UUID（外部/悬挂引用），仅要求非空字符串
    targetItemId: z.string().min(1, 'targetItemId is required'), // 被引用方LID（可为外部ID）

    // 📄 可选上下文信息
    context: z.string().optional(), // 引用上下文（如页码、章节等）

    // ⏰ 基础时间戳
    createdAt: z.date().default(() => new Date()),
});

// 📊 引文度数统计 - 按需计算的轻量级统计
export const CitationDegreeSchema = z.object({
    paperId: z.string().uuid(), // 文献LID
    inDegree: z.number().int().min(0), // 入度：被引用次数
    outDegree: z.number().int().min(0), // 出度：引用他人次数
    totalDegree: z.number().int().min(0), // 总度数
    lastCalculated: z.date(), // 最后计算时间
});

// 📊 引文关系概览 - 简化的统计信息
export const CitationOverviewSchema = z.object({
    totalCitations: z.number().int().min(0), // 总引文数
    uniqueSourceItems: z.number().int().min(0), // 唯一引用方数
    uniqueTargetItems: z.number().int().min(0), // 唯一被引用方数
    averageOutDegree: z.number().min(0), // 平均出度
    averageInDegree: z.number().min(0), // 平均入度
    lastUpdated: z.date(), // 最后更新时间
});

// 📋 类型导出
export type Citation = z.infer<typeof CitationSchema>;
export type CitationDegree = z.infer<typeof CitationDegreeSchema>;
export type CitationOverview = z.infer<typeof CitationOverviewSchema>;

// 🎯 输入类型
export type CreateCitationInput = Omit<Citation, 'createdAt'>;
export type UpdateCitationInput = Partial<Pick<Citation, 'context'>>;

// 🔍 引文查询类型
export type CitationQuery = {
    sourceItemId?: string;
    targetItemId?: string;
    hasContext?: boolean; // 是否包含上下文信息
    dateRange?: {
        start: Date;
        end: Date;
    };
};

// 📊 引文关系列表
export type CitationRelationship = {
    citation: Citation;
    relationType: 'outgoing' | 'incoming'; // 相对于查询LID的关系类型
};

// 🔍 引文搜索结果
export type CitationSearchResult = {
    citations: Citation[];
    total: number;
    hasMore: boolean;
};
