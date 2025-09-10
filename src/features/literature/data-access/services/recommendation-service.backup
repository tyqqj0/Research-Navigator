/**
 * 🤖 Recommendation Service - 智能推荐服务
 * 
 * 职责:
 * 1. 基于内容的推荐
 * 2. 基于用户行为的推荐
 * 3. 基于引文网络的推荐
 * 4. 标签和集合推荐
 * 5. 趋势话题发现
 * 
 * 设计原则:
 * - 多策略融合：结合多种推荐算法
 * - 个性化：基于用户历史行为和偏好
 * - 实时性：支持实时推荐和增量更新
 * - 可解释性：提供推荐理由
 */

import {
    LiteratureRepository,
    userMetaRepository,
    citationRepository,
    collectionRepository,
} from '../repositories';
import {
    LibraryItemCore,
    UserLiteratureMetaCore,
    ErrorHandler,
    withErrorBoundary,
} from '../models';

/**
 * 🎯 推荐结果
 */
export interface RecommendationResult {
    recommendedLiterature: RecommendedLiterature[];
    suggestedTags: SuggestedTag[];
    relatedCollections: RelatedCollection[];
    trendingTopics: TrendingTopic[];
    explanations: RecommendationExplanation[];
}

/**
 * 📚 推荐文献项
 */
export interface RecommendedLiterature {
    item: LibraryItemCore;
    score: number;
    reasons: string[];
    category: 'similar_content' | 'author_based' | 'citation_network' | 'user_behavior' | 'trending';
    confidence: 'high' | 'medium' | 'low';
}

/**
 * 🏷️ 建议标签
 */
export interface SuggestedTag {
    tag: string;
    relevance: number;
    reason: string;
    usage_count: number;
}

/**
 * 📂 相关集合
 */
export interface RelatedCollection {
    collectionId: string;
    name: string;
    description?: string;
    relevance: number;
    reason: string;
    itemCount: number;
}

/**
 * 🔥 趋势话题
 */
export interface TrendingTopic {
    topic: string;
    momentum: number;
    growth_rate: number;
    related_keywords: string[];
    timeframe: string;
}

/**
 * 💡 推荐解释
 */
export interface RecommendationExplanation {
    category: string;
    reason: string;
    confidence: number;
    evidence: string[];
}

/**
 * ⚙️ 推荐选项
 */
export interface RecommendationOptions {
    /** 推荐数量限制 */
    limit?: number;
    /** 包含的推荐类型 */
    includeTypes?: Array<'literature' | 'tags' | 'collections' | 'topics'>;
    /** 多样性因子 (0-1, 越高越多样化) */
    diversityFactor?: number;
    /** 新颖性因子 (0-1, 越高越偏向新内容) */
    noveltyFactor?: number;
    /** 是否包含解释 */
    includeExplanations?: boolean;
}

/**
 * 📊 用户偏好模型
 */
interface UserPreferenceModel {
    userId: string;
    preferredTopics: Array<{ topic: string; weight: number }>;
    preferredAuthors: Array<{ author: string; weight: number }>;
    preferredSources: Array<{ source: string; weight: number }>;
    readingPatterns: {
        averageReadingTime: number;
        preferredComplexity: 'low' | 'medium' | 'high';
        activeTimeRanges: string[];
    };
    interactionHistory: {
        totalInteractions: number;
        recentInteractions: Array<{
            itemId: string;
            action: 'view' | 'read' | 'bookmark' | 'share';
            timestamp: Date;
            duration?: number;
        }>;
    };
}

/**
 * 🤖 Recommendation Service 类
 */
export class RecommendationService {
    // 📊 用户偏好缓存
    private userPreferences = new Map<string, {
        model: UserPreferenceModel;
        timestamp: number;
        ttl: number;
    }>();

    private readonly preferenceCacheTTL = 3600000; // 1小时

    // 📈 推荐统计
    private stats = {
        totalRecommendations: 0,
        averageResponseTime: 0,
        userSatisfactionRate: 0,
        popularCategories: new Map<string, number>(),
    };

    constructor(
        private readonly literatureRepo = LiteratureRepository,
        private readonly userMetaRepo = userMetaRepository,
        private readonly citationRepo = citationRepository,
        private readonly collectionRepo = collectionRepository
    ) { }

    // ==================== 主要推荐接口 ====================

    /**
     * 🎯 生成个性化推荐
     */
    @withErrorBoundary('getPersonalizedRecommendations', 'service')
    async getPersonalizedRecommendations(
        userId: string,
        baseLiteratureId?: string,
        options: RecommendationOptions = {}
    ): Promise<RecommendationResult> {
        const startTime = Date.now();

        try {
            const {
                limit = 20,
                includeTypes = ['literature', 'tags', 'collections', 'topics'],
                diversityFactor = 0.3,
                noveltyFactor = 0.2,
                includeExplanations = true,
            } = options;

            // 1. 获取或构建用户偏好模型
            const userPreferences = await this.getUserPreferenceModel(userId);

            // 2. 并行执行不同类型的推荐
            const [
                literatureRecommendations,
                tagSuggestions,
                collectionSuggestions,
                trendingTopics,
            ] = await Promise.all([
                includeTypes.includes('literature')
                    ? this.generateLiteratureRecommendations(userId, baseLiteratureId, userPreferences, {
                        limit: Math.ceil(limit * 0.6),
                        diversityFactor,
                        noveltyFactor,
                    })
                    : Promise.resolve([]),

                includeTypes.includes('tags')
                    ? this.generateTagSuggestions(userId, baseLiteratureId, userPreferences, Math.ceil(limit * 0.2))
                    : Promise.resolve([]),

                includeTypes.includes('collections')
                    ? this.generateCollectionSuggestions(userId, baseLiteratureId, userPreferences, Math.ceil(limit * 0.1))
                    : Promise.resolve([]),

                includeTypes.includes('topics')
                    ? this.generateTrendingTopics(userPreferences, Math.ceil(limit * 0.1))
                    : Promise.resolve([]),
            ]);

            // 3. 生成推荐解释（如果需要）
            const explanations = includeExplanations
                ? this.generateRecommendationExplanations(literatureRecommendations, userPreferences)
                : [];

            const result: RecommendationResult = {
                recommendedLiterature: literatureRecommendations,
                suggestedTags: tagSuggestions,
                relatedCollections: collectionSuggestions,
                trendingTopics,
                explanations,
            };

            this.updateStats(Date.now() - startTime);
            return result;
        } catch (error) {
            throw ErrorHandler.handle(error, {
                operation: 'service.getPersonalizedRecommendations',
                layer: 'service',
                userId,
                entityId: baseLiteratureId,
            });
        }
    }

    /**
     * 🔗 基于引文网络的推荐
     */
    @withErrorBoundary('getCitationNetworkRecommendations', 'service')
    async getCitationNetworkRecommendations(
        lid: string,
        userId?: string,
        limit: number = 10
    ): Promise<RecommendedLiterature[]> {
        try {
            // 1. 获取引文网络
            const citationStats = await this.citationRepo.getBidirectionalCitations(lid);

            // 2. 分析引文模式
            const recommendations: RecommendedLiterature[] = [];

            // 被引用的文献（参考文献）
            for (const outgoing of citationStats.outgoing.slice(0, limit / 2)) {
                const item = await this.literatureRepo.findByLid(outgoing.targetItemId);
                if (item) {
                    recommendations.push({
                        item,
                        score: 0.8,
                        reasons: ['Referenced by this literature'],
                        category: 'citation_network',
                        confidence: 'high',
                    });
                }
            }

            // 引用此文献的其他文献
            for (const incoming of citationStats.incoming.slice(0, limit / 2)) {
                const item = await this.literatureRepo.findByLid(incoming.sourceItemId);
                if (item) {
                    recommendations.push({
                        item,
                        score: 0.7,
                        reasons: ['Cites this literature'],
                        category: 'citation_network',
                        confidence: 'medium',
                    });
                }
            }

            return recommendations.slice(0, limit);
        } catch (error) {
            throw ErrorHandler.handle(error, {
                operation: 'service.getCitationNetworkRecommendations',
                layer: 'service',
                entityId: lid,
                userId,
            });
        }
    }

    /**
     * 👥 基于相似用户的推荐
     */
    @withErrorBoundary('getSimilarUserRecommendations', 'service')
    async getSimilarUserRecommendations(
        userId: string,
        limit: number = 10
    ): Promise<RecommendedLiterature[]> {
        try {
            // 1. 获取用户偏好
            const userPreferences = await this.getUserPreferenceModel(userId);

            // 2. 找到相似用户（简化实现）
            const similarUsers = await this.findSimilarUsers(userId, userPreferences);

            // 3. 获取相似用户的高分文献
            const recommendations: RecommendedLiterature[] = [];

            for (const similarUser of similarUsers.slice(0, 3)) {
                const userMetas = await this.userMetaRepo.findByUserId(similarUser.userId);

                // 获取高分文献
                const highRatedItems = userMetas
                    .filter(meta => meta.rating && meta.rating >= 4)
                    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
                    .slice(0, limit / 3);

                for (const meta of highRatedItems) {
                    const item = await this.literatureRepo.findByLid(meta.lid);
                    if (item) {
                        recommendations.push({
                            item,
                            score: (meta.rating || 0) / 5 * similarUser.similarity,
                            reasons: [`Highly rated by similar users (${Math.round(similarUser.similarity * 100)}% similarity)`],
                            category: 'user_behavior',
                            confidence: 'medium',
                        });
                    }
                }
            }

            return recommendations
                .sort((a, b) => b.score - a.score)
                .slice(0, limit);
        } catch (error) {
            throw ErrorHandler.handle(error, {
                operation: 'service.getSimilarUserRecommendations',
                layer: 'service',
                userId,
            });
        }
    }

    // ==================== 推荐算法实现 ====================

    /**
     * 📚 生成文献推荐
     */
    private async generateLiteratureRecommendations(
        userId: string,
        baseLiteratureId: string | undefined,
        userPreferences: UserPreferenceModel,
        options: { limit: number; diversityFactor: number; noveltyFactor: number }
    ): Promise<RecommendedLiterature[]> {
        const recommendations: RecommendedLiterature[] = [];

        // 1. 基于内容的推荐
        if (baseLiteratureId) {
            const contentBased = await this.getContentBasedRecommendations(baseLiteratureId, options.limit / 4);
            recommendations.push(...contentBased);
        }

        // 2. 基于用户行为的推荐
        const behaviorBased = await this.getUserBehaviorRecommendations(userPreferences, options.limit / 4);
        recommendations.push(...behaviorBased);

        // 3. 基于作者的推荐
        const authorBased = await this.getAuthorBasedRecommendations(userPreferences, options.limit / 4);
        recommendations.push(...authorBased);

        // 4. 热门推荐
        const trending = await this.getTrendingRecommendations(options.limit / 4);
        recommendations.push(...trending);

        // 5. 去重和排序
        const uniqueRecommendations = this.deduplicateRecommendations(recommendations);

        // 6. 应用多样性和新颖性因子
        const diversifiedRecommendations = this.applyDiversityAndNovelty(
            uniqueRecommendations,
            options.diversityFactor,
            options.noveltyFactor
        );

        return diversifiedRecommendations
            .sort((a, b) => b.score - a.score)
            .slice(0, options.limit);
    }

    /**
     * 🎯 基于内容的推荐
     */
    private async getContentBasedRecommendations(
        baseLiteratureId: string,
        limit: number
    ): Promise<RecommendedLiterature[]> {
        const baseLiterature = await this.literatureRepo.findByLid(baseLiteratureId);
        if (!baseLiterature) return [];

        // 使用仓储层的相似性搜索
        const similarItems = await this.literatureRepo.findSimilar(baseLiterature, limit * 2);

        return similarItems
            .filter(similar => similar.confidence !== 'low')
            .map(similar => ({
                item: similar.item,
                score: similar.score,
                reasons: ['Similar content and topics'],
                category: 'similar_content' as const,
                confidence: similar.confidence as 'high' | 'medium' | 'low',
            }))
            .slice(0, limit);
    }

    /**
     * 👤 基于用户行为的推荐
     */
    private async getUserBehaviorRecommendations(
        userPreferences: UserPreferenceModel,
        limit: number
    ): Promise<RecommendedLiterature[]> {
        const recommendations: RecommendedLiterature[] = [];

        // 基于用户偏好主题
        for (const topicPref of userPreferences.preferredTopics.slice(0, 3)) {
            const filter = {
                keywords: [topicPref.topic],
            };

            const searchResult = await this.literatureRepo.searchWithFilters(
                filter,
                { field: 'relevance', order: 'desc' },
                1,
                Math.ceil(limit / 3)
            );

            for (const item of searchResult.items) {
                recommendations.push({
                    item,
                    score: topicPref.weight * 0.8,
                    reasons: [`Matches your interest in ${topicPref.topic}`],
                    category: 'user_behavior',
                    confidence: 'medium',
                });
            }
        }

        return recommendations.slice(0, limit);
    }

    /**
     * 👨‍🎓 基于作者的推荐
     */
    private async getAuthorBasedRecommendations(
        userPreferences: UserPreferenceModel,
        limit: number
    ): Promise<RecommendedLiterature[]> {
        const recommendations: RecommendedLiterature[] = [];

        // 基于用户偏好作者
        for (const authorPref of userPreferences.preferredAuthors.slice(0, 2)) {
            const filter = {
                authors: [authorPref.author],
            };

            const searchResult = await this.literatureRepo.searchWithFilters(
                filter,
                { field: 'year', order: 'desc' },
                1,
                Math.ceil(limit / 2)
            );

            for (const item of searchResult.items) {
                recommendations.push({
                    item,
                    score: authorPref.weight * 0.7,
                    reasons: [`New work by ${authorPref.author}`],
                    category: 'author_based',
                    confidence: 'high',
                });
            }
        }

        return recommendations.slice(0, limit);
    }

    /**
     * 🔥 热门推荐
     */
    private async getTrendingRecommendations(limit: number): Promise<RecommendedLiterature[]> {
        // 简化实现：获取最近的高质量文献
        const filter = {
            year: new Date().getFullYear(),
        };

        const searchResult = await this.literatureRepo.searchWithFilters(
            filter,
            { field: 'createdAt', order: 'desc' },
            1,
            limit
        );

        return searchResult.items.map(item => ({
            item,
            score: 0.6,
            reasons: ['Trending in your field'],
            category: 'trending' as const,
            confidence: 'medium' as const,
        }));
    }

    // ==================== 用户偏好建模 ====================

    /**
     * 👤 获取用户偏好模型
     */
    private async getUserPreferenceModel(userId: string): Promise<UserPreferenceModel> {
        // 检查缓存
        const cached = this.userPreferences.get(userId);
        if (cached && Date.now() - cached.timestamp < cached.ttl) {
            return cached.model;
        }

        // 构建新的偏好模型
        const model = await this.buildUserPreferenceModel(userId);

        // 缓存结果
        this.userPreferences.set(userId, {
            model,
            timestamp: Date.now(),
            ttl: this.preferenceCacheTTL,
        });

        return model;
    }

    /**
     * 🔨 构建用户偏好模型
     */
    private async buildUserPreferenceModel(userId: string): Promise<UserPreferenceModel> {
        // 1. 获取用户的所有文献元数据
        const userMetas = await this.userMetaRepo.findByUserId(userId);

        // 2. 分析主题偏好
        const topicCounts = new Map<string, number>();
        const authorCounts = new Map<string, number>();
        const sourceCounts = new Map<string, number>();

        for (const meta of userMetas) {
            // 统计标签（作为主题）
            for (const tag of meta.tags) {
                topicCounts.set(tag, (topicCounts.get(tag) || 0) + 1);
            }

            // 获取文献信息来统计作者和来源
            const literature = await this.literatureRepo.findByLid(meta.lid);
            if (literature) {
                // 统计作者
                for (const author of literature.authors) {
                    authorCounts.set(author, (authorCounts.get(author) || 0) + 1);
                }

                // 统计来源
                if (literature.source) {
                    sourceCounts.set(literature.source, (sourceCounts.get(literature.source) || 0) + 1);
                }
            }
        }

        // 3. 构建偏好权重
        const totalItems = userMetas.length || 1;

        const preferredTopics = Array.from(topicCounts.entries())
            .map(([topic, count]) => ({ topic, weight: count / totalItems }))
            .sort((a, b) => b.weight - a.weight)
            .slice(0, 10);

        const preferredAuthors = Array.from(authorCounts.entries())
            .map(([author, count]) => ({ author, weight: count / totalItems }))
            .sort((a, b) => b.weight - a.weight)
            .slice(0, 10);

        const preferredSources = Array.from(sourceCounts.entries())
            .map(([source, count]) => ({ source, weight: count / totalItems }))
            .sort((a, b) => b.weight - a.weight)
            .slice(0, 5);

        // 4. 分析阅读模式
        const completedItems = userMetas.filter(meta => meta.readingStatus === 'completed');
        const averageReadingTime = completedItems.length > 0
            ? completedItems.reduce((sum, meta) => sum + (meta.readingProgress || 0), 0) / completedItems.length
            : 0;

        return {
            userId,
            preferredTopics,
            preferredAuthors,
            preferredSources,
            readingPatterns: {
                averageReadingTime,
                preferredComplexity: 'medium', // 简化实现
                activeTimeRanges: ['morning', 'evening'], // 简化实现
            },
            interactionHistory: {
                totalInteractions: userMetas.length,
                recentInteractions: [], // 简化实现
            },
        };
    }

    // ==================== 辅助方法 ====================

    /**
     * 🎯 生成标签建议
     */
    private async generateTagSuggestions(
        userId: string,
        baseLiteratureId: string | undefined,
        userPreferences: UserPreferenceModel,
        limit: number
    ): Promise<SuggestedTag[]> {
        const suggestions: SuggestedTag[] = [];

        // 基于用户偏好推荐相关标签
        for (const topicPref of userPreferences.preferredTopics.slice(0, limit)) {
            suggestions.push({
                tag: `related-to-${topicPref.topic}`,
                relevance: topicPref.weight,
                reason: `Based on your interest in ${topicPref.topic}`,
                usage_count: Math.floor(topicPref.weight * 100),
            });
        }

        return suggestions.slice(0, limit);
    }

    /**
     * 📂 生成集合建议
     */
    private async generateCollectionSuggestions(
        userId: string,
        baseLiteratureId: string | undefined,
        userPreferences: UserPreferenceModel,
        limit: number
    ): Promise<RelatedCollection[]> {
        // 简化实现：返回模拟数据
        return [
            {
                collectionId: 'trending-ai',
                name: 'Trending AI Research',
                description: 'Latest developments in artificial intelligence',
                relevance: 0.8,
                reason: 'Matches your research interests',
                itemCount: 45,
            },
            {
                collectionId: 'ml-fundamentals',
                name: 'Machine Learning Fundamentals',
                description: 'Core concepts and methodologies',
                relevance: 0.7,
                reason: 'Recommended for your reading level',
                itemCount: 32,
            },
        ].slice(0, limit);
    }

    /**
     * 🔥 生成趋势话题
     */
    private async generateTrendingTopics(
        userPreferences: UserPreferenceModel,
        limit: number
    ): Promise<TrendingTopic[]> {
        // 简化实现：返回模拟的趋势话题
        return [
            {
                topic: 'Large Language Models',
                momentum: 0.9,
                growth_rate: 0.15,
                related_keywords: ['transformer', 'attention', 'GPT', 'BERT'],
                timeframe: 'last_month',
            },
            {
                topic: 'Quantum Computing',
                momentum: 0.7,
                growth_rate: 0.08,
                related_keywords: ['quantum', 'qubit', 'superposition', 'entanglement'],
                timeframe: 'last_month',
            },
        ].slice(0, limit);
    }

    /**
     * 🔍 找到相似用户
     */
    private async findSimilarUsers(
        userId: string,
        userPreferences: UserPreferenceModel
    ): Promise<Array<{ userId: string; similarity: number }>> {
        // 简化实现：返回模拟的相似用户
        return [
            { userId: 'user2', similarity: 0.85 },
            { userId: 'user3', similarity: 0.72 },
            { userId: 'user4', similarity: 0.68 },
        ];
    }

    /**
     * 🧹 去重推荐结果
     */
    private deduplicateRecommendations(recommendations: RecommendedLiterature[]): RecommendedLiterature[] {
        const seen = new Set<string>();
        return recommendations.filter(rec => {
            if (seen.has(rec.item.lid)) {
                return false;
            }
            seen.add(rec.item.lid);
            return true;
        });
    }

    /**
     * 🎨 应用多样性和新颖性因子
     */
    private applyDiversityAndNovelty(
        recommendations: RecommendedLiterature[],
        diversityFactor: number,
        noveltyFactor: number
    ): RecommendedLiterature[] {
        // 简化实现：调整分数
        return recommendations.map(rec => ({
            ...rec,
            score: rec.score * (1 + diversityFactor * Math.random() + noveltyFactor * Math.random()),
        }));
    }

    /**
     * 💡 生成推荐解释
     */
    private generateRecommendationExplanations(
        recommendations: RecommendedLiterature[],
        userPreferences: UserPreferenceModel
    ): RecommendationExplanation[] {
        return [
            {
                category: 'Content Similarity',
                reason: 'These items share similar topics and keywords with your interests',
                confidence: 0.8,
                evidence: ['Topic overlap', 'Keyword matching', 'Abstract similarity'],
            },
            {
                category: 'User Behavior',
                reason: 'Based on your reading history and preferences',
                confidence: 0.7,
                evidence: ['Reading patterns', 'Tag preferences', 'Author preferences'],
            },
        ];
    }

    /**
     * 📊 更新统计信息
     */
    private updateStats(responseTime: number): void {
        this.stats.totalRecommendations++;
        this.stats.averageResponseTime =
            (this.stats.averageResponseTime * (this.stats.totalRecommendations - 1) + responseTime) /
            this.stats.totalRecommendations;
    }

    /**
     * 📊 获取推荐统计
     */
    public getRecommendationStats() {
        return { ...this.stats };
    }

    /**
     * 🧹 清理缓存
     */
    public clearCache(): void {
        this.userPreferences.clear();
    }
}

// 🏪 服务实例
export const recommendationService = new RecommendationService();

export default recommendationService;
