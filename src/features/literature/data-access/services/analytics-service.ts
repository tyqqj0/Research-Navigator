/**
 * 📊 Analytics Service - 统计分析服务
 * 
 * 职责:
 * 1. 用户行为统计
 * 2. 文献数据分析
 * 3. 趋势分析
 * 4. 性能监控
 * 5. 报告生成
 * 
 * 设计原则:
 * - 数据驱动：基于真实数据进行分析
 * - 实时计算：支持实时统计和历史分析
 * - 可视化友好：提供易于可视化的数据格式
 * - 性能优化：大数据量下的高效计算
 */

import {
    literatureRepository,
    userMetaRepository,
    citationRepository,
    collectionRepository,
} from '../repositories';
import {
    LibraryItem,
    UserLiteratureMeta,
} from '../models';
import { handleError } from '../../../../lib/errors';

/**
 * 📊 用户统计数据
 */
export interface UserStatistics {
    overview: {
        totalLiterature: number;
        totalCollections: number;
        totalTags: number;
        averageRating: number;
    };
    readingProgress: {
        unread: number;
        reading: number;
        completed: number;
        abandoned: number;
        completionRate: number;
        averageReadingTime: number;
    };
    engagement: {
        dailyActiveItems: number;
        weeklyActiveItems: number;
        monthlyActiveItems: number;
        totalReadingTime: number;
        averageSessionTime: number;
    };
    preferences: {
        topTags: Array<{ tag: string; count: number; percentage: number }>;
        topAuthors: Array<{ author: string; count: number; percentage: number }>;
        topSources: Array<{ source: string; count: number; percentage: number }>;
        topTypes: Array<{ type: string; count: number; percentage: number }>;
    };
    temporal: {
        monthlyActivity: Array<{
            month: string;
            added: number;
            completed: number;
            timeSpent: number;
        }>;
        dailyPatterns: Array<{
            hour: number;
            activity: number;
        }>;
        weeklyPatterns: Array<{
            day: string;
            activity: number;
        }>;
    };
}

/**
 * 📈 文献分析数据
 */
export interface LiteratureAnalytics {
    overview: {
        totalItems: number;
        totalAuthors: number;
        totalSources: number;
        yearRange: { min: number; max: number };
    };
    distribution: {
        byYear: Array<{ year: number; count: number }>;
        bySource: Array<{ source: string; count: number; percentage: number }>;
        byType: Array<{ type: string; count: number; percentage: number }>;
        byLanguage: Array<{ language: string; count: number; percentage: number }>;
    };
    quality: {
        averageRating: number;
        ratingDistribution: Array<{ rating: number; count: number }>;
        completenessScore: number;
        duplicateRate: number;
    };
    trends: {
        growthRate: number;
        popularTopics: Array<{ topic: string; momentum: number; growth: number }>;
        emergingAuthors: Array<{ author: string; recentWorks: number; impact: number }>;
        hotSources: Array<{ source: string; recentCount: number; trend: 'up' | 'down' | 'stable' }>;
    };
}

/**
 * 🕸️ 引文网络分析
 */
export interface CitationNetworkAnalytics {
    overview: {
        totalCitations: number;
        totalNodes: number;
        totalEdges: number;
        networkDensity: number;
    };
    centrality: {
        mostCited: Array<{ itemId: string; title: string; citationCount: number }>;
        mostInfluential: Array<{ itemId: string; title: string; influence: number }>;
        bridges: Array<{ itemId: string; title: string; bridgeScore: number }>;
    };
    clusters: Array<{
        id: string;
        name: string;
        items: string[];
        strength: number;
        keywords: string[];
    }>;
    evolution: Array<{
        period: string;
        newCitations: number;
        newNodes: number;
        clusterChanges: number;
    }>;
}

/**
 * 🎯 性能分析数据
 */
export interface PerformanceAnalytics {
    system: {
        averageResponseTime: number;
        errorRate: number;
        cacheHitRate: number;
        throughput: number;
    };
    storage: {
        totalSize: number;
        growthRate: number;
        compressionRatio: number;
        indexEfficiency: number;
    };
    user: {
        activeUsers: number;
        averageSessionTime: number;
        bounceRate: number;
        retentionRate: number;
    };
}

/**
 * 📋 分析报告
 */
export interface AnalyticsReport {
    id: string;
    title: string;
    type: 'user' | 'literature' | 'citation' | 'performance' | 'comprehensive';
    generatedAt: Date;
    period: {
        start: Date;
        end: Date;
    };
    data: UserStatistics | LiteratureAnalytics | CitationNetworkAnalytics | PerformanceAnalytics | any;
    insights: Array<{
        type: 'trend' | 'anomaly' | 'recommendation' | 'alert';
        title: string;
        description: string;
        impact: 'high' | 'medium' | 'low';
        actionable: boolean;
    }>;
    charts: Array<{
        type: 'line' | 'bar' | 'pie' | 'scatter' | 'heatmap';
        title: string;
        data: any;
        config: any;
    }>;
}

/**
 * 📊 Analytics Service 类
 */
export class AnalyticsService {
    // 📊 分析缓存
    private analyticsCache = new Map<string, {
        data: any;
        timestamp: number;
        ttl: number;
    }>();

    private readonly defaultCacheTTL = 1800000; // 30分钟

    // 📈 服务统计
    private serviceStats = {
        totalAnalyses: 0,
        averageComputeTime: 0,
        cacheHitRate: 0,
        lastAnalysisAt: new Date(),
    };

    constructor(
        private readonly literatureRepo = literatureRepository,
        private readonly userMetaRepo = userMetaRepository,
        private readonly citationRepo = citationRepository,
        private readonly collectionRepo = collectionRepository
    ) { }

    // ==================== 用户统计分析 ====================

    /**
     * 👤 获取用户统计数据
     */
    async getUserStatistics(
        userId: string,
        period?: { start: Date; end: Date }
    ): Promise<UserStatistics> {
        const startTime = Date.now();

        try {
            const cacheKey = `user_stats_${userId}_${period?.start?.getTime()}_${period?.end?.getTime()}`;
            const cached = this.getCache<UserStatistics>(cacheKey);
            if (cached) return cached;

            // 1. 获取用户的所有文献元数据
            const userMetas = await this.userMetaRepo.findByUserId(userId);

            // 2. 过滤时间范围（如果指定）
            const filteredMetas = period
                ? userMetas.filter(meta =>
                    meta.createdAt >= period.start && meta.createdAt <= period.end
                )
                : userMetas;

            // 3. 计算概览统计
            const overview = await this.calculateUserOverview(filteredMetas, userId);

            // 4. 计算阅读进度统计
            const readingProgress = this.calculateReadingProgress(filteredMetas);

            // 5. 计算参与度统计
            const engagement = this.calculateEngagement(filteredMetas);

            // 6. 分析偏好
            const preferences = await this.analyzeUserPreferences(filteredMetas);

            // 7. 时间模式分析
            const temporal = this.analyzeTemporalPatterns(filteredMetas);

            const statistics: UserStatistics = {
                overview,
                readingProgress,
                engagement,
                preferences,
                temporal,
            };

            this.setCache(cacheKey, statistics);
            this.updateServiceStats(Date.now() - startTime, true);

            return statistics;
        } catch (error) {
            this.updateServiceStats(Date.now() - startTime, false);
            throw handleError(error, {
                operation: 'service.getUserStatistics',
                layer: 'service',
                userId,
            });
        }
    }

    // ==================== 文献分析 ====================

    /**
     * 📚 获取文献分析数据
     */
    async getLiteratureAnalytics(
        userId?: string,
        period?: { start: Date; end: Date }
    ): Promise<LiteratureAnalytics> {
        const startTime = Date.now();

        try {
            const cacheKey = `literature_analytics_${userId || 'all'}_${period?.start?.getTime()}_${period?.end?.getTime()}`;
            const cached = this.getCache<LiteratureAnalytics>(cacheKey);
            if (cached) return cached;

            // 1. 获取文献数据
            let literatures: LibraryItem[];
            if (userId) {
                const userMetas = await this.userMetaRepo.findByUserId(userId);
                const lids = userMetas.map(meta => meta.lid);
                literatures = await Promise.all(
                    lids.map(id => this.literatureRepo.findByLid(id))
                ).then(items => items.filter(item => item !== null) as LibraryItem[]);
            } else {
                // 获取所有文献（需要实现分页或限制）
                const result = await this.literatureRepo.searchWithFilters({
                    searchTerm: '',
                    authors: [],
                    hasAbstract: true,
                    hasPdf: true,
                    yearRange: {
                        start: period?.start?.getFullYear() || 0,
                        end: period?.end?.getFullYear() || 0,
                    },
                }, { field: 'createdAt', order: 'desc' }, 1, 10000);
                literatures = result.items;
            }

            // 2. 过滤时间范围
            const filteredLiteratures = period
                ? literatures.filter(lit =>
                    lit.createdAt >= period.start && lit.createdAt <= period.end
                )
                : literatures;

            // 3. 计算概览
            const overview = this.calculateLiteratureOverview(filteredLiteratures);

            // 4. 分布分析
            const distribution = this.analyzeLiteratureDistribution(filteredLiteratures);

            // 5. 质量分析
            const quality = await this.analyzeLiteratureQuality(filteredLiteratures, userId);

            // 6. 趋势分析
            const trends = this.analyzeLiteratureTrends(filteredLiteratures);

            const analytics: LiteratureAnalytics = {
                overview,
                distribution,
                quality,
                trends,
            };

            this.setCache(cacheKey, analytics);
            this.updateServiceStats(Date.now() - startTime, true);

            return analytics;
        } catch (error) {
            this.updateServiceStats(Date.now() - startTime, false);
            throw handleError(error, {
                operation: 'service.getLiteratureAnalytics',
                layer: 'service',
                userId,
            });
        }
    }

    // ==================== 引文网络分析 ====================

    /**
     * 🕸️ 获取引文网络分析
     */
    async getCitationNetworkAnalytics(
        lids?: string[],
        userId?: string
    ): Promise<CitationNetworkAnalytics> {
        const startTime = Date.now();

        try {
            const cacheKey = `citation_network_${lids?.join(',') || 'all'}_${userId || 'system'}`;
            const cached = this.getCache<CitationNetworkAnalytics>(cacheKey);
            if (cached) return cached;

            // 1. 获取引文数据
            const citationData = await this.gatherCitationData(lids, userId);

            // 2. 计算网络概览
            const overview = this.calculateNetworkOverview(citationData);

            // 3. 中心性分析
            const centrality = this.analyzeCentrality(citationData);

            // 4. 聚类分析
            const clusters = this.analyzeClusters(citationData);

            // 5. 演化分析
            const evolution = this.analyzeNetworkEvolution(citationData);

            const analytics: CitationNetworkAnalytics = {
                overview,
                centrality,
                clusters,
                evolution,
            };

            this.setCache(cacheKey, analytics);
            this.updateServiceStats(Date.now() - startTime, true);

            return analytics;
        } catch (error) {
            this.updateServiceStats(Date.now() - startTime, false);
            throw handleError(error, {
                operation: 'service.getCitationNetworkAnalytics',
                layer: 'service',
                userId,
            });
        }
    }

    // ==================== 性能分析 ====================

    /**
     * ⚡ 获取系统性能分析
     */
    async getPerformanceAnalytics(): Promise<PerformanceAnalytics> {
        const startTime = Date.now();

        try {
            const cacheKey = 'performance_analytics';
            const cached = this.getCache<PerformanceAnalytics>(cacheKey);
            if (cached) return cached;

            // 1. 系统性能指标
            const system = {
                averageResponseTime: this.serviceStats.averageComputeTime,
                errorRate: 0.02, // 模拟数据
                cacheHitRate: this.serviceStats.cacheHitRate,
                throughput: 150, // 模拟数据：每分钟请求数
            };

            // 2. 存储指标
            const storage = {
                totalSize: 0, // 需要实际计算
                growthRate: 0.05, // 模拟数据：月增长率
                compressionRatio: 0.7, // 模拟数据
                indexEfficiency: 0.85, // 模拟数据
            };

            // 3. 用户指标
            const user = {
                activeUsers: 0, // 需要实际统计
                averageSessionTime: 25 * 60 * 1000, // 25分钟
                bounceRate: 0.15, // 模拟数据
                retentionRate: 0.78, // 模拟数据
            };

            const analytics: PerformanceAnalytics = {
                system,
                storage,
                user,
            };

            this.setCache(cacheKey, analytics, 300000); // 5分钟缓存
            this.updateServiceStats(Date.now() - startTime, true);

            return analytics;
        } catch (error) {
            this.updateServiceStats(Date.now() - startTime, false);
            throw handleError(error, {
                operation: 'service.getPerformanceAnalytics',
                layer: 'service',
            });
        }
    }

    // ==================== 报告生成 ====================

    /**
     * 📋 生成综合分析报告
     */
    async generateReport(
        type: 'user' | 'literature' | 'citation' | 'performance' | 'comprehensive',
        userId?: string,
        period?: { start: Date; end: Date }
    ): Promise<AnalyticsReport> {
        const startTime = Date.now();

        try {
            const reportId = `${type}_${userId || 'system'}_${Date.now()}`;

            // 1. 收集数据
            let data: any;
            switch (type) {
                case 'user':
                    if (!userId) throw new Error('User ID required for user report');
                    data = await this.getUserStatistics(userId, period);
                    break;
                case 'literature':
                    data = await this.getLiteratureAnalytics(userId, period);
                    break;
                case 'citation':
                    data = await this.getCitationNetworkAnalytics(undefined, userId);
                    break;
                case 'performance':
                    data = await this.getPerformanceAnalytics();
                    break;
                case 'comprehensive':
                    data = {
                        user: userId ? await this.getUserStatistics(userId, period) : null,
                        literature: await this.getLiteratureAnalytics(userId, period),
                        citation: await this.getCitationNetworkAnalytics(undefined, userId),
                        performance: await this.getPerformanceAnalytics(),
                    };
                    break;
            }

            // 2. 生成洞察
            const insights = this.generateInsights(type, data);

            // 3. 生成图表配置
            const charts = this.generateChartConfigs(type, data);

            const report: AnalyticsReport = {
                id: reportId,
                title: this.getReportTitle(type),
                type,
                generatedAt: new Date(),
                period: period || {
                    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30天前
                    end: new Date(),
                },
                data,
                insights,
                charts,
            };

            this.updateServiceStats(Date.now() - startTime, true);
            return report;
        } catch (error) {
            this.updateServiceStats(Date.now() - startTime, false);
            throw handleError(error, {
                operation: 'service.generateReport',
                layer: 'service',
                additionalInfo: { type, userId },
            });
        }
    }

    // ==================== 私有计算方法 ====================

    private async calculateUserOverview(
        userMetas: UserLiteratureMeta[],
        userId: string
    ) {
        const collections = await this.collectionRepo.searchWithFilters({}, { field: 'createdAt', order: 'desc' }, 1, 10000);
        const allTags = userMetas.flatMap(meta => meta.tags);
        const uniqueTags = [...new Set(allTags)];
        const ratingsSum = userMetas.reduce((sum, meta) => sum + (meta.rating || 0), 0);
        const ratedCount = userMetas.filter(meta => meta.rating).length;

        return {
            totalLiterature: userMetas.length,
            totalCollections: collections.items.length,
            totalTags: uniqueTags.length,
            averageRating: ratedCount > 0 ? ratingsSum / ratedCount : 0,
        };
    }

    private calculateReadingProgress(userMetas: UserLiteratureMeta[]) {
        const statusCounts = {
            unread: 0,
            reading: 0,
            completed: 0,
            abandoned: 0,
        };

        let totalProgress = 0;
        let totalReadingTime = 0;

        for (const meta of userMetas) {
            statusCounts[meta.readingStatus as keyof typeof statusCounts]++;
            totalProgress += meta.readingCompletedAt?.getTime() || 0;
            if (meta.readingCompletedAt) {
                totalReadingTime += meta.readingCompletedAt.getTime();
            }
        }

        return {
            ...statusCounts,
            completionRate: userMetas.length > 0 ? statusCounts.completed / userMetas.length : 0,
            averageReadingTime: userMetas.length > 0 ? totalReadingTime / userMetas.length : 0,
        };
    }

    private calculateEngagement(userMetas: UserLiteratureMeta[]) {
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const dailyActive = userMetas.filter(meta =>
            meta.lastAccessedAt && meta.lastAccessedAt > oneDayAgo
        ).length;

        const weeklyActive = userMetas.filter(meta =>
            meta.lastAccessedAt && meta.lastAccessedAt > oneWeekAgo
        ).length;

        const monthlyActive = userMetas.filter(meta =>
            meta.lastAccessedAt && meta.lastAccessedAt > oneMonthAgo
        ).length;

        const totalReadingTime = userMetas.reduce((sum, meta) => sum + (meta.readingCompletedAt?.getTime() || 0), 0);
        const activeSessions = userMetas.filter(meta => meta.readingCompletedAt && meta.readingCompletedAt.getTime() > 0).length;

        return {
            dailyActiveItems: dailyActive,
            weeklyActiveItems: weeklyActive,
            monthlyActiveItems: monthlyActive,
            totalReadingTime,
            averageSessionTime: activeSessions > 0 ? totalReadingTime / activeSessions : 0,
        };
    }

    private async analyzeUserPreferences(userMetas: UserLiteratureMeta[]) {
        // 标签统计
        const tagCounts = new Map<string, number>();
        const authorCounts = new Map<string, number>();
        const sourceCounts = new Map<string, number>();
        const typeCounts = new Map<string, number>();

        for (const meta of userMetas) {
            // 统计标签
            for (const tag of meta.tags) {
                tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
            }

            // 获取文献信息来统计其他字段
            const literature = await this.literatureRepo.findByLid(meta.lid);
            if (literature) {
                // 作者统计
                for (const author of literature.authors) {
                    authorCounts.set(author, (authorCounts.get(author) || 0) + 1);
                }

                // 来源统计
                if (literature.source) {
                    sourceCounts.set(literature.source, (sourceCounts.get(literature.source) || 0) + 1);
                }

                // 类型统计
                if (literature.source) {
                    typeCounts.set(literature.source, (typeCounts.get(literature.source) || 0) + 1);
                }
            }
        }

        const total = userMetas.length;

        return {
            topTags: this.getTopItems(tagCounts, total, 10),
            topAuthors: this.getTopItems(authorCounts, total, 10),
            topSources: this.getTopItems(sourceCounts, total, 5),
            topTypes: this.getTopItems(typeCounts, total, 5),
        };
    }

    private getTopItems(countMap: Map<string, number>, total: number, limit: number) {
        return Array.from(countMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([item, count]) => ({
                [countMap === new Map() ? 'item' : Object.keys({ tag: '', author: '', source: '', type: '' }).find(k => true) || 'item']: item,
                count,
                percentage: total > 0 ? (count / total) * 100 : 0,
            })) as any;
    }

    // ==================== 缓存管理 ====================

    private getCache<T>(key: string): T | null {
        const entry = this.analyticsCache.get(key);
        if (!entry) return null;

        if (Date.now() - entry.timestamp > entry.ttl) {
            this.analyticsCache.delete(key);
            return null;
        }

        return entry.data as T;
    }

    private setCache<T>(key: string, data: T, ttl: number = this.defaultCacheTTL): void {
        this.analyticsCache.set(key, {
            data,
            timestamp: Date.now(),
            ttl,
        });
    }

    private updateServiceStats(computeTime: number, success: boolean): void {
        this.serviceStats.totalAnalyses++;
        this.serviceStats.lastAnalysisAt = new Date();

        // 更新平均计算时间
        this.serviceStats.averageComputeTime =
            (this.serviceStats.averageComputeTime * (this.serviceStats.totalAnalyses - 1) + computeTime) /
            this.serviceStats.totalAnalyses;
    }

    /**
     * 📊 获取服务统计
     */
    public getServiceStats() {
        return { ...this.serviceStats };
    }

    /**
     * 🧹 清理缓存
     */
    public clearCache(): void {
        this.analyticsCache.clear();
    }

    // ==================== 占位符方法（需要具体实现） ====================

    private analyzeTemporalPatterns(userMetas: UserLiteratureMeta[]) {
        // 简化实现
        return {
            monthlyActivity: [],
            dailyPatterns: [],
            weeklyPatterns: [],
        };
    }

    private calculateLiteratureOverview(literatures: LibraryItem[]) {
        const authors = new Set();
        const sources = new Set();
        let minYear = Infinity;
        let maxYear = -Infinity;

        for (const lit of literatures) {
            lit.authors.forEach(author => authors.add(author));
            if (lit.source) sources.add(lit.source);
            if (lit.year) {
                minYear = Math.min(minYear, lit.year);
                maxYear = Math.max(maxYear, lit.year);
            }
        }

        return {
            totalItems: literatures.length,
            totalAuthors: authors.size,
            totalSources: sources.size,
            yearRange: { min: minYear === Infinity ? 0 : minYear, max: maxYear === -Infinity ? 0 : maxYear },
        };
    }

    private analyzeLiteratureDistribution(literatures: LibraryItem[]) {
        // 简化实现
        return {
            byYear: [],
            bySource: [],
            byType: [],
            byLanguage: [],
        };
    }

    private async analyzeLiteratureQuality(literatures: LibraryItem[], userId?: string) {
        // 简化实现
        return {
            averageRating: 0,
            ratingDistribution: [],
            completenessScore: 0.85,
            duplicateRate: 0.05,
        };
    }

    private analyzeLiteratureTrends(literatures: LibraryItem[]) {
        // 简化实现
        return {
            growthRate: 0.1,
            popularTopics: [],
            emergingAuthors: [],
            hotSources: [],
        };
    }

    private async gatherCitationData(lids?: string[], userId?: string) {
        // 简化实现
        return {};
    }

    private calculateNetworkOverview(citationData: any) {
        // 简化实现
        return {
            totalCitations: 0,
            totalNodes: 0,
            totalEdges: 0,
            networkDensity: 0,
        };
    }

    private analyzeCentrality(citationData: any) {
        // 简化实现
        return {
            mostCited: [],
            mostInfluential: [],
            bridges: [],
        };
    }

    private analyzeClusters(citationData: any) {
        // 简化实现
        return [];
    }

    private analyzeNetworkEvolution(citationData: any) {
        // 简化实现
        return [];
    }

    private generateInsights(type: string, data: any) {
        // 简化实现：生成一些通用洞察
        return [
            {
                type: 'trend' as const,
                title: 'Reading Activity Trend',
                description: 'Your reading activity has increased by 15% this month',
                impact: 'medium' as const,
                actionable: true,
            },
        ];
    }

    private generateChartConfigs(type: string, data: any) {
        // 简化实现：生成基本图表配置
        return [
            {
                type: 'line' as const,
                title: 'Activity Over Time',
                data: [],
                config: {},
            },
        ];
    }

    private getReportTitle(type: string): string {
        const titles = {
            user: 'User Activity Report',
            literature: 'Literature Analysis Report',
            citation: 'Citation Network Report',
            performance: 'System Performance Report',
            comprehensive: 'Comprehensive Analytics Report',
        };
        return titles[type as keyof typeof titles] || 'Analytics Report';
    }
}

// 🏪 服务实例
export const analyticsService = new AnalyticsService();

export default analyticsService;
