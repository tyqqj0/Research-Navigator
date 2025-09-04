/**
 * 🔗 Citation Types - 引文关系类型定义
 * 
 * 迁移自: old/src/libs/db/schema.ts (CitationSchema)
 * 优化: 增强引文关系管理，支持图谱可视化
 */

import { z } from 'zod';

// 🔗 基础引文关系
export const CitationSchema = z.object({
    // 🔑 可选的自增ID (兼容旧版)
    id: z.number().int().positive().optional(),

    // 📚 关系定义
    sourceItemId: z.string().uuid('Invalid source UUID format'), // 引用方
    targetItemId: z.string().uuid('Invalid target UUID format'), // 被引用方

    // 📄 引文上下文信息
    context: z.string().optional(), // 引用的上下文
    pageNumber: z.string().optional(), // 页码信息
    quotedText: z.string().optional(), // 引用的原文

    // 🎯 引文类型
    citationType: z.enum([
        'direct',      // 直接引用
        'indirect',    // 间接引用
        'supportive',  // 支持性引用
        'contradictory', // 反驳性引用
        'methodological', // 方法论引用
        'background'   // 背景引用
    ]).default('direct'),

    // 🔍 发现方式
    discoveryMethod: z.enum([
        'manual',      // 手动创建
        'automatic',   // 自动发现
        'ai_extracted', // AI提取
        'imported'     // 导入
    ]).default('manual'),

    // 📊 置信度 (自动发现时的可信度)
    confidence: z.number().min(0).max(1).optional(),

    // ⏰ 时间戳
    createdAt: z.date().default(() => new Date()),
    updatedAt: z.date().optional(),

    // 🔍 验证状态
    isVerified: z.boolean().default(false), // 是否已验证
    verifiedBy: z.string().optional(), // 验证者
    verifiedAt: z.date().optional(), // 验证时间
});

// 📊 引文网络节点 - 用于图谱可视化
export const CitationNodeSchema = z.object({
    id: z.string(),
    title: z.string(),
    authors: z.array(z.string()),
    year: z.number(),
    type: z.enum(['literature', 'cluster', 'topic']).default('literature'),

    // 📊 网络属性
    degree: z.number().default(0), // 度数 (连接数)
    inDegree: z.number().default(0), // 入度 (被引次数)
    outDegree: z.number().default(0), // 出度 (引用次数)
    betweenness: z.number().default(0), // 介数中心性
    closeness: z.number().default(0), // 接近中心性

    // 🎨 可视化属性
    x: z.number().optional(),
    y: z.number().optional(),
    size: z.number().default(10),
    color: z.string().optional(),

    // 🏷️ 标签和分组
    cluster: z.string().optional(), // 聚类标识
    topics: z.array(z.string()).default([]), // 主题标签
});

// 🔗 引文网络边
export const CitationEdgeSchema = z.object({
    id: z.string(),
    source: z.string(), // 源节点ID
    target: z.string(), // 目标节点ID

    // 📊 关系强度
    weight: z.number().default(1), // 关系权重
    citationCount: z.number().default(1), // 引用次数

    // 🎯 边类型
    type: z.enum([
        'citation',    // 引用关系
        'collaboration', // 合作关系
        'similarity',  // 相似性关系
        'temporal'     // 时间关系
    ]).default('citation'),

    // 🎨 可视化属性
    color: z.string().optional(),
    width: z.number().default(1),

    // ⏰ 时间信息
    createdAt: z.date().default(() => new Date()),
});

// 📊 引文网络图
export const CitationNetworkSchema = z.object({
    nodes: z.array(CitationNodeSchema),
    edges: z.array(CitationEdgeSchema),

    // 📊 网络统计
    metadata: z.object({
        nodeCount: z.number(),
        edgeCount: z.number(),
        density: z.number(), // 网络密度
        averageDegree: z.number(), // 平均度数
        components: z.number(), // 连通分量数
        diameter: z.number().optional(), // 网络直径
        averagePathLength: z.number().optional(), // 平均路径长度
        clusteringCoefficient: z.number().optional(), // 聚类系数
    }),

    // ⏰ 生成时间
    generatedAt: z.date().default(() => new Date()),
});

// 📋 类型导出
export type Citation = z.infer<typeof CitationSchema>;
export type CitationNode = z.infer<typeof CitationNodeSchema>;
export type CitationEdge = z.infer<typeof CitationEdgeSchema>;
export type CitationNetwork = z.infer<typeof CitationNetworkSchema>;

// 🎯 输入类型
export type CreateCitationInput = Omit<Citation, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateCitationInput = Partial<Omit<Citation, 'id' | 'sourceItemId' | 'targetItemId' | 'createdAt'>>;

// 🔍 引文查询类型
export type CitationQuery = {
    sourceItemId?: string;
    targetItemId?: string;
    citationType?: Citation['citationType'];
    discoveryMethod?: Citation['discoveryMethod'];
    isVerified?: boolean;
    confidenceThreshold?: number;
};

// 📊 引文统计类型
export type CitationStats = {
    totalCitations: number;
    citationsByType: Record<Citation['citationType'], number>;
    citationsByMethod: Record<Citation['discoveryMethod'], number>;
    averageConfidence: number;
    verificationRate: number;

    // 📈 趋势数据
    citationsOverTime: Array<{
        date: Date;
        count: number;
    }>;

    // 🏆 热门引用
    mostCitedItems: Array<{
        itemId: string;
        citationCount: number;
    }>;

    // 🔗 引用网络统计
    networkStats: {
        nodeCount: number;
        edgeCount: number;
        averageDegree: number;
        density: number;
    };
};
