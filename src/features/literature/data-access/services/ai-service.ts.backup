/**
 * 🤖 Literature AI Service - 文献AI智能服务
 * 
 * 迁移自: old/src/libs/ai/ 相关功能
 * 功能: 智能推荐、内容分析、自动标签、相似文献发现
 * 设计: AI-driven + 机器学习算法
 */

import { LiteratureRepository, UserMetaRepository, CitationRepository } from '../repositories';
import {
    LibraryItem,
    UserLiteratureMeta,
    AIRecommendation,
    ContentAnalysisResult,
    TopicExtractionResult,
    SimilarityScore,
    AutoTaggingResult,
    AIInsight,
    ResearchTrend,
    LiteratureCluster
} from '../types';

/**
 * 🎯 AI推荐配置
 */
interface AIServiceConfig {
    // 推荐算法配置
    recommendation: {
        maxSuggestions: number;
        minConfidence: number;
        enableCitationBased: boolean;
        enableContentBased: boolean;
        enableCollaborativeFiltering: boolean;
    };

    // 内容分析配置
    analysis: {
        enableTopicExtraction: boolean;
        enableSentimentAnalysis: boolean;
        enableKeywordExtraction: boolean;
        minTopicConfidence: number;
    };

    // 自动标签配置
    tagging: {
        maxTagsPerDocument: number;
        minTagConfidence: number;
        enableCustomTags: boolean;
    };
}

/**
 * 🤖 Literature AI Service
 * 
 * 核心功能：
 * 1. 智能文献推荐
 * 2. 内容自动分析和标签
 * 3. 研究趋势发现
 * 4. 相似文献聚类
 */
export class LiteratureAIService {
    private readonly defaultConfig: AIServiceConfig = {
        recommendation: {
            maxSuggestions: 10,
            minConfidence: 0.6,
            enableCitationBased: true,
            enableContentBased: true,
            enableCollaborativeFiltering: false // 需要多用户数据
        },
        analysis: {
            enableTopicExtraction: true,
            enableSentimentAnalysis: false, // 对学术文献意义不大
            enableKeywordExtraction: true,
            minTopicConfidence: 0.7
        },
        tagging: {
            maxTagsPerDocument: 8,
            minTagConfidence: 0.5,
            enableCustomTags: true
        }
    };

    constructor(
        private readonly literatureRepo: LiteratureRepository,
        private readonly userMetaRepo: UserMetaRepository,
        private readonly citationRepo: CitationRepository,
        private readonly config: AIServiceConfig = {} as AIServiceConfig
    ) {
        this.config = { ...this.defaultConfig, ...config };
    }

    // ==================== 智能推荐 ====================

    /**
     * 🎯 为用户生成文献推荐
     */
    async getRecommendationsForUser(
        userId: string,
        context?: {
            recentlyViewed?: string[];
            currentResearchFocus?: string[];
            excludeRead?: boolean;
        }
    ): Promise<AIRecommendation[]> {
        try {
            console.log(`[AIService] Generating recommendations for user: ${userId}`);

            // 获取用户历史数据
            const userMetas = await this.userMetaRepo.findByUserId(userId);
            const userLiteratureIds = userMetas.map(meta => meta.literatureId);

            // 分析用户兴趣模式
            const userProfile = await this.buildUserProfile(userId, userMetas);

            // 获取候选文献
            const allLiterature = await this.literatureRepo.findAll();
            const candidateLiterature = allLiterature.filter(lit => {
                if (userLiteratureIds.includes(lit.id)) return false;
                if (context?.recentlyViewed?.includes(lit.id)) return false;
                return true;
            });

            // 多策略推荐
            const recommendations: AIRecommendation[] = [];

            // 策略1: 基于引文的推荐
            if (this.config.recommendation.enableCitationBased) {
                const citationBased = await this.getCitationBasedRecommendations(
                    userLiteratureIds, candidateLiterature
                );
                recommendations.push(...citationBased);
            }

            // 策略2: 基于内容的推荐
            if (this.config.recommendation.enableContentBased) {
                const contentBased = await this.getContentBasedRecommendations(
                    userProfile, candidateLiterature
                );
                recommendations.push(...contentBased);
            }

            // 策略3: 基于标签相似性的推荐
            const tagBased = await this.getTagBasedRecommendations(
                userProfile.favoriteTopics, candidateLiterature
            );
            recommendations.push(...tagBased);

            // 去重、排序、筛选
            const uniqueRecommendations = this.deduplicateRecommendations(recommendations);
            const sortedRecommendations = uniqueRecommendations
                .filter(rec => rec.confidence >= this.config.recommendation.minConfidence)
                .sort((a, b) => b.confidence - a.confidence)
                .slice(0, this.config.recommendation.maxSuggestions);

            console.log(`[AIService] Generated ${sortedRecommendations.length} recommendations`);
            return sortedRecommendations;
        } catch (error) {
            console.error('[AIService] getRecommendationsForUser failed:', error);
            throw new Error('Failed to generate recommendations');
        }
    }

    /**
     * 🔗 基于引文的推荐
     */
    private async getCitationBasedRecommendations(
        userLiteratureIds: string[],
        candidates: LibraryItem[]
    ): Promise<AIRecommendation[]> {
        const recommendations: AIRecommendation[] = [];

        try {
            for (const litId of userLiteratureIds.slice(0, 20)) { // 限制计算量
                // 获取用户文献的引用和被引用文献
                const citationInfo = await this.citationRepo.getBidirectionalCitations(litId);

                // 分析这些引文所指向的文献的相关文献
                const relatedIds = new Set([
                    ...citationInfo.outgoing.map(c => c.targetItemId),
                    ...citationInfo.incoming.map(c => c.sourceItemId)
                ]);

                for (const candidate of candidates) {
                    if (relatedIds.has(candidate.id)) {
                        recommendations.push({
                            literatureId: candidate.id,
                            confidence: 0.8,
                            reason: 'citation_network',
                            explanation: 'Found in citation network of your literature',
                            sourceLiteratureIds: [litId],
                            tags: ['citation-based'],
                            generatedAt: new Date()
                        });
                    }
                }
            }

            return recommendations;
        } catch (error) {
            console.error('[AIService] getCitationBasedRecommendations failed:', error);
            return [];
        }
    }

    /**
     * 📝 基于内容的推荐
     */
    private async getContentBasedRecommendations(
        userProfile: any,
        candidates: LibraryItem[]
    ): Promise<AIRecommendation[]> {
        const recommendations: AIRecommendation[] = [];

        try {
            for (const candidate of candidates) {
                let confidence = 0;
                const reasons: string[] = [];

                // 作者相似性
                const authorSimilarity = this.calculateAuthorSimilarity(
                    userProfile.favoriteAuthors, candidate.authors
                );
                if (authorSimilarity > 0) {
                    confidence += authorSimilarity * 0.3;
                    reasons.push(`Similar authors: ${authorSimilarity.toFixed(2)}`);
                }

                // 主题相似性（基于标题和摘要）
                const topicSimilarity = this.calculateTopicSimilarity(
                    userProfile.favoriteTopics, candidate
                );
                if (topicSimilarity > 0) {
                    confidence += topicSimilarity * 0.4;
                    reasons.push(`Topic similarity: ${topicSimilarity.toFixed(2)}`);
                }

                // 年份相关性（更关注近期文献）
                const yearRelevance = this.calculateYearRelevance(candidate.year);
                confidence += yearRelevance * 0.1;

                // 期刊相关性
                if (candidate.publication && userProfile.favoriteJournals.includes(candidate.publication)) {
                    confidence += 0.2;
                    reasons.push('Published in favorite journal');
                }

                if (confidence >= this.config.recommendation.minConfidence) {
                    recommendations.push({
                        literatureId: candidate.id,
                        confidence: Math.min(confidence, 1.0),
                        reason: 'content_based',
                        explanation: reasons.join('; '),
                        sourceLiteratureIds: [],
                        tags: ['content-based'],
                        generatedAt: new Date()
                    });
                }
            }

            return recommendations;
        } catch (error) {
            console.error('[AIService] getContentBasedRecommendations failed:', error);
            return [];
        }
    }

    /**
     * 🏷️ 基于标签的推荐
     */
    private async getTagBasedRecommendations(
        userFavoriteTopics: string[],
        candidates: LibraryItem[]
    ): Promise<AIRecommendation[]> {
        const recommendations: AIRecommendation[] = [];

        try {
            for (const candidate of candidates) {
                const candidateTopics = candidate.topics || [];
                const commonTopics = candidateTopics.filter(topic =>
                    userFavoriteTopics.some(userTopic =>
                        topic.toLowerCase().includes(userTopic.toLowerCase()) ||
                        userTopic.toLowerCase().includes(topic.toLowerCase())
                    )
                );

                if (commonTopics.length > 0) {
                    const confidence = Math.min(commonTopics.length / userFavoriteTopics.length, 1.0) * 0.8;

                    recommendations.push({
                        literatureId: candidate.id,
                        confidence,
                        reason: 'tag_based',
                        explanation: `Matches topics: ${commonTopics.join(', ')}`,
                        sourceLiteratureIds: [],
                        tags: ['tag-based', ...commonTopics],
                        generatedAt: new Date()
                    });
                }
            }

            return recommendations;
        } catch (error) {
            console.error('[AIService] getTagBasedRecommendations failed:', error);
            return [];
        }
    }

    // ==================== 内容分析 ====================

    /**
     * 📊 分析文献内容
     */
    async analyzeLiteratureContent(literatureId: string): Promise<ContentAnalysisResult> {
        try {
            const literature = await this.literatureRepo.findById(literatureId);
            if (!literature) {
                throw new Error(`Literature ${literatureId} not found`);
            }

            console.log(`[AIService] Analyzing content for literature: ${literatureId}`);

            const analysis: ContentAnalysisResult = {
                literatureId,
                topics: [],
                keywords: [],
                sentiment: null,
                readabilityScore: 0,
                complexity: 'medium',
                estimatedReadingTime: 0,
                mainFindings: [],
                methodology: null,
                limitations: [],
                confidence: 0,
                generatedAt: new Date()
            };

            // 主题提取
            if (this.config.analysis.enableTopicExtraction) {
                analysis.topics = await this.extractTopics(literature);
            }

            // 关键词提取
            if (this.config.analysis.enableKeywordExtraction) {
                analysis.keywords = await this.extractKeywords(literature);
            }

            // 可读性分析
            analysis.readabilityScore = this.calculateReadabilityScore(literature);
            analysis.complexity = this.determineComplexity(analysis.readabilityScore);

            // 估算阅读时间
            analysis.estimatedReadingTime = this.estimateReadingTime(literature);

            // 置信度评估
            analysis.confidence = this.calculateAnalysisConfidence(analysis);

            console.log(`[AIService] Content analysis completed with confidence: ${analysis.confidence}`);
            return analysis;
        } catch (error) {
            console.error('[AIService] analyzeLiteratureContent failed:', error);
            throw new Error('Failed to analyze literature content');
        }
    }

    /**
     * 🏷️ 自动标签生成
     */
    async generateAutoTags(literatureId: string): Promise<AutoTaggingResult> {
        try {
            const literature = await this.literatureRepo.findById(literatureId);
            if (!literature) {
                throw new Error(`Literature ${literatureId} not found`);
            }

            console.log(`[AIService] Generating auto tags for literature: ${literatureId}`);

            const suggestedTags: Array<{ tag: string; confidence: number; source: string }> = [];

            // 从标题提取标签
            const titleTags = this.extractTagsFromText(literature.title, 'title');
            suggestedTags.push(...titleTags);

            // 从摘要提取标签
            if (literature.abstract) {
                const abstractTags = this.extractTagsFromText(literature.abstract, 'abstract');
                suggestedTags.push(...abstractTags);
            }

            // 从作者信息推断标签
            const authorTags = this.extractTagsFromAuthors(literature.authors);
            suggestedTags.push(...authorTags);

            // 从期刊信息推断标签
            if (literature.publication) {
                const journalTags = this.extractTagsFromJournal(literature.publication);
                suggestedTags.push(...journalTags);
            }

            // 去重和排序
            const uniqueTags = this.deduplicateTags(suggestedTags);
            const filteredTags = uniqueTags
                .filter(tag => tag.confidence >= this.config.tagging.minTagConfidence)
                .sort((a, b) => b.confidence - a.confidence)
                .slice(0, this.config.tagging.maxTagsPerDocument);

            const result: AutoTaggingResult = {
                literatureId,
                suggestedTags: filteredTags,
                totalCandidates: suggestedTags.length,
                averageConfidence: filteredTags.length > 0 ?
                    filteredTags.reduce((sum, tag) => sum + tag.confidence, 0) / filteredTags.length : 0,
                generatedAt: new Date()
            };

            console.log(`[AIService] Generated ${filteredTags.length} auto tags`);
            return result;
        } catch (error) {
            console.error('[AIService] generateAutoTags failed:', error);
            throw new Error('Failed to generate auto tags');
        }
    }

    // ==================== 相似性分析 ====================

    /**
     * 🔍 查找相似文献
     */
    async findSimilarLiterature(
        literatureId: string,
        maxResults: number = 10
    ): Promise<SimilarityScore[]> {
        try {
            const targetLiterature = await this.literatureRepo.findById(literatureId);
            if (!targetLiterature) {
                throw new Error(`Literature ${literatureId} not found`);
            }

            const allLiterature = await this.literatureRepo.findAll();
            const candidates = allLiterature.filter(lit => lit.id !== literatureId);

            const similarities: SimilarityScore[] = [];

            for (const candidate of candidates) {
                const similarity = this.calculateOverallSimilarity(targetLiterature, candidate);

                if (similarity.score > 0.3) { // 最低相似度阈值
                    similarities.push(similarity);
                }
            }

            return similarities
                .sort((a, b) => b.score - a.score)
                .slice(0, maxResults);
        } catch (error) {
            console.error('[AIService] findSimilarLiterature failed:', error);
            throw new Error('Failed to find similar literature');
        }
    }

    /**
     * 📊 计算文献间的整体相似度
     */
    private calculateOverallSimilarity(lit1: LibraryItem, lit2: LibraryItem): SimilarityScore {
        const factors: Array<{ factor: string; score: number; weight: number }> = [];

        // 标题相似度
        const titleSim = this.calculateTextSimilarity(lit1.title, lit2.title);
        factors.push({ factor: 'title', score: titleSim, weight: 0.3 });

        // 作者重叠度
        const authorSim = this.calculateAuthorSimilarity([...lit1.authors], lit2.authors);
        factors.push({ factor: 'authors', score: authorSim, weight: 0.2 });

        // 摘要相似度
        if (lit1.abstract && lit2.abstract) {
            const abstractSim = this.calculateTextSimilarity(lit1.abstract, lit2.abstract);
            factors.push({ factor: 'abstract', score: abstractSim, weight: 0.25 });
        }

        // 主题标签重叠
        const topicSim = this.calculateTopicOverlap(lit1.topics || [], lit2.topics || []);
        factors.push({ factor: 'topics', score: topicSim, weight: 0.15 });

        // 年份相近度
        const yearSim = Math.max(0, 1 - Math.abs(lit1.year - lit2.year) / 20); // 20年为完全不相似
        factors.push({ factor: 'year', score: yearSim, weight: 0.1 });

        // 加权平均
        const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
        const weightedScore = factors.reduce((sum, f) => sum + f.score * f.weight, 0) / totalWeight;

        return {
            literatureId: lit2.id,
            score: weightedScore,
            factors: factors.map(f => ({
                name: f.factor,
                value: f.score,
                contribution: (f.score * f.weight) / totalWeight
            })),
            explanation: `Overall similarity based on ${factors.length} factors`,
            calculatedAt: new Date()
        };
    }

    // ==================== 研究趋势分析 ====================

    /**
     * 📈 分析研究趋势
     */
    async analyzeResearchTrends(
        timeframe: 'year' | 'quarter' | 'month' = 'year',
        minCount: number = 3
    ): Promise<ResearchTrend[]> {
        try {
            const allLiterature = await this.literatureRepo.findAll();
            const trends = new Map<string, { count: number; years: number[]; topics: string[] }>();

            // 按时间段聚合主题
            for (const lit of allLiterature) {
                const topics = lit.topics || [];
                const year = lit.year;

                topics.forEach(topic => {
                    if (!trends.has(topic)) {
                        trends.set(topic, { count: 0, years: [], topics: [] });
                    }

                    const trend = trends.get(topic)!;
                    trend.count++;
                    trend.years.push(year);
                    trend.topics.push(topic);
                });
            }

            // 计算趋势
            const result: ResearchTrend[] = [];

            for (const [topic, data] of trends.entries()) {
                if (data.count >= minCount) {
                    const sortedYears = data.years.sort((a, b) => a - b);
                    const startYear = sortedYears[0];
                    const endYear = sortedYears[sortedYears.length - 1];

                    // 简单的趋势计算（线性增长）
                    const yearCounts = new Map<number, number>();
                    data.years.forEach(year => {
                        yearCounts.set(year, (yearCounts.get(year) || 0) + 1);
                    });

                    const recentCount = this.countRecentYears(data.years, 3);
                    const earlierCount = data.count - recentCount;
                    const growth = earlierCount > 0 ? (recentCount / earlierCount) - 1 : 0;

                    result.push({
                        topic,
                        totalCount: data.count,
                        timeRange: { start: startYear, end: endYear },
                        growth: growth,
                        momentum: growth > 0.5 ? 'rising' : growth > -0.2 ? 'stable' : 'declining',
                        relatedTopics: this.findRelatedTopics(topic, allLiterature),
                        keyLiterature: this.findKeyLiteratureForTopic(topic, allLiterature),
                        analysisDate: new Date()
                    });
                }
            }

            return result.sort((a, b) => b.growth - a.growth);
        } catch (error) {
            console.error('[AIService] analyzeResearchTrends failed:', error);
            throw new Error('Failed to analyze research trends');
        }
    }

    // ==================== 工具方法 ====================

    /**
     * 👤 构建用户兴趣档案
     */
    private async buildUserProfile(userId: string, userMetas: UserLiteratureMeta[]): Promise<any> {
        const profile = {
            favoriteAuthors: new Map<string, number>(),
            favoriteTopics: [] as string[],
            favoriteJournals: [] as string[],
            readingHistory: userMetas.length,
            preferredYears: [] as number[]
        };

        // 分析用户的文献元数据
        for (const meta of userMetas) {
            const literature = await this.literatureRepo.findById(meta.literatureId);
            if (literature) {
                // 作者偏好
                literature.authors.forEach(author => {
                    profile.favoriteAuthors.set(author, (profile.favoriteAuthors.get(author) || 0) + 1);
                });

                // 主题偏好
                if (literature.topics) {
                    profile.favoriteTopics.push(...literature.topics);
                }

                // 期刊偏好
                if (literature.publication) {
                    profile.favoriteJournals.push(literature.publication);
                }

                // 年份偏好
                profile.preferredYears.push(literature.year);
            }
        }

        // 统计最高频的偏好
        profile.favoriteTopics = [...new Set(profile.favoriteTopics)];
        profile.favoriteJournals = [...new Set(profile.favoriteJournals)];

        return profile;
    }

    /**
     * 🔤 计算文本相似度
     */
    private calculateTextSimilarity(text1: string, text2: string): number {
        // 简化的Jaccard相似度
        const words1 = new Set(text1.toLowerCase().split(/\s+/));
        const words2 = new Set(text2.toLowerCase().split(/\s+/));

        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);

        return union.size > 0 ? intersection.size / union.size : 0;
    }

    /**
     * 👥 计算作者相似度
     */
    private calculateAuthorSimilarity(authors1: string[], authors2: string[]): number {
        const set1 = new Set(authors1.map(a => a.toLowerCase()));
        const set2 = new Set(authors2.map(a => a.toLowerCase()));

        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);

        return union.size > 0 ? intersection.size / union.size : 0;
    }

    /**
     * 🏷️ 计算主题重叠度
     */
    private calculateTopicOverlap(topics1: string[], topics2: string[]): number {
        if (topics1.length === 0 && topics2.length === 0) return 0;

        const set1 = new Set(topics1.map(t => t.toLowerCase()));
        const set2 = new Set(topics2.map(t => t.toLowerCase()));

        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);

        return union.size > 0 ? intersection.size / union.size : 0;
    }

    /**
     * 🎯 去重推荐
     */
    private deduplicateRecommendations(recommendations: AIRecommendation[]): AIRecommendation[] {
        const unique = new Map<string, AIRecommendation>();

        recommendations.forEach(rec => {
            const existing = unique.get(rec.literatureId);
            if (!existing || rec.confidence > existing.confidence) {
                unique.set(rec.literatureId, rec);
            }
        });

        return Array.from(unique.values());
    }

    /**
     * 🏷️ 去重标签
     */
    private deduplicateTags(
        tags: Array<{ tag: string; confidence: number; source: string }>
    ): Array<{ tag: string; confidence: number; source: string }> {
        const unique = new Map<string, { tag: string; confidence: number; source: string }>();

        tags.forEach(tagObj => {
            const key = tagObj.tag.toLowerCase();
            const existing = unique.get(key);
            if (!existing || tagObj.confidence > existing.confidence) {
                unique.set(key, tagObj);
            }
        });

        return Array.from(unique.values());
    }

    // Mock implementations for demonstration
    private async extractTopics(literature: LibraryItem): Promise<TopicExtractionResult[]> {
        // 简化实现：从标题和摘要提取主题
        const text = `${literature.title} ${literature.abstract || ''}`.toLowerCase();
        const commonTopics = [
            'machine learning', 'artificial intelligence', 'deep learning', 'neural networks',
            'data science', 'computer vision', 'natural language processing', 'robotics',
            'algorithm', 'optimization', 'statistics', 'mathematics', 'physics', 'chemistry',
            'biology', 'medicine', 'psychology', 'sociology', 'economics', 'finance'
        ];

        return commonTopics
            .filter(topic => text.includes(topic))
            .map(topic => ({
                topic,
                confidence: 0.7 + Math.random() * 0.3,
                relevance: Math.random(),
                keywords: [topic]
            }));
    }

    private async extractKeywords(literature: LibraryItem): Promise<string[]> {
        // 简化实现：提取常见学术关键词
        const text = `${literature.title} ${literature.abstract || ''}`.toLowerCase();
        const keywords = text.split(/\s+/)
            .filter(word => word.length > 4)
            .filter(word => !['this', 'that', 'with', 'from', 'they', 'have', 'been', 'will', 'were'].includes(word))
            .slice(0, 10);

        return [...new Set(keywords)];
    }

    private calculateReadabilityScore(literature: LibraryItem): number {
        // 简化的可读性评分
        const text = literature.abstract || literature.title;
        const avgWordsPerSentence = text.split('.').reduce((sum, sentence) =>
            sum + sentence.split(/\s+/).length, 0) / text.split('.').length;

        return Math.max(0, Math.min(100, 100 - avgWordsPerSentence));
    }

    private determineComplexity(score: number): 'low' | 'medium' | 'high' {
        if (score > 70) return 'low';
        if (score > 40) return 'medium';
        return 'high';
    }

    private estimateReadingTime(literature: LibraryItem): number {
        // 估算阅读时间（分钟）
        const wordCount = (literature.abstract || '').split(/\s+/).length;
        return Math.ceil(wordCount / 200); // 假设每分钟200词
    }

    private calculateAnalysisConfidence(analysis: ContentAnalysisResult): number {
        // 基于分析结果的完整性计算置信度
        let confidence = 0.5;

        if (analysis.topics.length > 0) confidence += 0.2;
        if (analysis.keywords.length > 0) confidence += 0.1;
        if (analysis.readabilityScore > 0) confidence += 0.1;
        if (analysis.estimatedReadingTime > 0) confidence += 0.1;

        return Math.min(confidence, 1.0);
    }

    private extractTagsFromText(text: string, source: string): Array<{ tag: string; confidence: number; source: string }> {
        // 简化的标签提取
        const words = text.toLowerCase().split(/\s+/)
            .filter(word => word.length > 3)
            .filter(word => !['this', 'that', 'with', 'from', 'they', 'have', 'been'].includes(word));

        return words.slice(0, 5).map(word => ({
            tag: word,
            confidence: 0.6 + Math.random() * 0.3,
            source
        }));
    }

    private extractTagsFromAuthors(authors: string[]): Array<{ tag: string; confidence: number; source: string }> {
        // 从作者姓名推断研究领域（简化）
        return authors.slice(0, 2).map(author => ({
            tag: `author:${author.split(' ').pop()}`, // 姓氏作为标签
            confidence: 0.5,
            source: 'author'
        }));
    }

    private extractTagsFromJournal(publication: string): Array<{ tag: string; confidence: number; source: string }> {
        // 从期刊名推断学科领域
        const journalWords = publication.toLowerCase().split(/\s+/)
            .filter(word => word.length > 4)
            .slice(0, 3);

        return journalWords.map(word => ({
            tag: word,
            confidence: 0.7,
            source: 'journal'
        }));
    }

    private calculateTopicSimilarity(userTopics: string[], literature: LibraryItem): number {
        const litTopics = literature.topics || [];
        const titleWords = literature.title.toLowerCase().split(/\s+/);
        const abstractWords = literature.abstract ? literature.abstract.toLowerCase().split(/\s+/) : [];

        const allLitWords = [...litTopics, ...titleWords, ...abstractWords].map(w => w.toLowerCase());

        const matches = userTopics.filter(topic =>
            allLitWords.some(word => word.includes(topic.toLowerCase()) || topic.toLowerCase().includes(word))
        );

        return userTopics.length > 0 ? matches.length / userTopics.length : 0;
    }

    private calculateYearRelevance(year: number): number {
        const currentYear = new Date().getFullYear();
        const age = currentYear - year;
        return Math.max(0, 1 - age / 20); // 20年后完全不相关
    }

    private countRecentYears(years: number[], recentYearCount: number): number {
        const currentYear = new Date().getFullYear();
        const cutoffYear = currentYear - recentYearCount;
        return years.filter(year => year >= cutoffYear).length;
    }

    private findRelatedTopics(topic: string, literature: LibraryItem[]): string[] {
        // 简化实现：查找经常与该主题一起出现的其他主题
        const relatedTopics = new Map<string, number>();

        literature.forEach(lit => {
            if (lit.topics?.includes(topic)) {
                lit.topics.forEach(otherTopic => {
                    if (otherTopic !== topic) {
                        relatedTopics.set(otherTopic, (relatedTopics.get(otherTopic) || 0) + 1);
                    }
                });
            }
        });

        return Array.from(relatedTopics.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([topic, count]) => topic);
    }

    private findKeyLiteratureForTopic(topic: string, literature: LibraryItem[]): string[] {
        return literature
            .filter(lit => lit.topics?.includes(topic))
            .sort((a, b) => b.year - a.year) // 按年份排序
            .slice(0, 3)
            .map(lit => lit.id);
    }
}

// 🏪 单例服务实例
export const literatureAIService = new LiteratureAIService(
    literatureDomainRepositories.literature,
    literatureDomainRepositories.userMeta,
    literatureDomainRepositories.citation
);
