/**
 * 🔗 Citation Service - 引文管理服务
 * 
 * 职责:
 * 1. 引文关系的CRUD操作
 * 2. 引文网络分析
 * 3. 自动引文发现
 * 4. 引文验证和质量控制
 * 
 * 设计原则:
 * - 专注引文：只处理引文相关的业务逻辑
 * - 网络分析：提供图论相关的分析功能
 * - 自动化：支持智能引文发现和链接
 * - 质量控制：确保引文关系的准确性
 */

import {
    citationRepository,
    LiteratureRepositoryClass,
} from '../repositories';
import {
    Citation,
    LibraryItem,
} from '../models';
import { handleError } from '../../../../lib/errors';
import { literatureRepository } from '../repositories/literature-repository';

/**
 * 🕸️ 引文网络结果
 */
export interface CitationNetworkResult {
    nodes: Array<{
        id: string;
        title: string;
        authors: string[];
        year: number;
        type: 'source' | 'target' | 'intermediate';
        metrics: {
            inDegree: number;
            outDegree: number;
            betweenness: number;
            pageRank: number;
        };
    }>;
    edges: Array<{
        source: string;
        target: string;
        type: string;
        weight: number;
        verified: boolean;
    }>;
    statistics: {
        totalNodes: number;
        totalEdges: number;
        density: number;
        averageDegree: number;
        clusters: number;
    };
}

/**
 * 🎯 引文发现结果
 */
export interface CitationDiscoveryResult {
    potentialCitations: Array<{
        sourceId: string;
        targetId: string;
        confidence: number;
        evidence: string[];
        type: 'direct' | 'indirect' | 'inferred';
    }>;
    recommendations: Array<{
        paperId: string;
        reason: string;
        priority: 'high' | 'medium' | 'low';
    }>;
}

/**
 * 📊 引文统计
 */
export interface CitationStatistics {
    overview: {
        totalCitations: number;
        verifiedCitations: number;
        pendingCitations: number;
        rejectedCitations: number;
    };
    network: {
        totalNodes: number;
        isolatedNodes: number;
        largestComponent: number;
        averagePathLength: number;
    };
    quality: {
        verificationRate: number;
        accuracyScore: number;
        completenessScore: number;
    };
}

/**
 * 🔗 Citation Service 类
 */
export class CitationService {
    // 📊 引文缓存
    private citationCache = new Map<string, {
        data: any;
        timestamp: number;
        ttl: number;
    }>();

    private readonly defaultCacheTTL = 600000; // 10分钟

    // 📈 服务统计
    private stats = {
        totalOperations: 0,
        averageResponseTime: 0,
        cacheHitRate: 0,
        discoveredCitations: 0,
    };

    constructor(
        private readonly citationRepo = citationRepository,
        private readonly literatureRepo = literatureRepository
    ) { }

    // ==================== 基础引文操作 ====================

    /**
     * ➕ 创建引文关系
     */
    async createCitation(
        sourceItemId: string,
        targetItemId: string,
        citationType: string = 'direct',
        metadata?: {
            page?: number;
            context?: string;
            verified?: boolean;
        }
    ): Promise<Citation> {
        const startTime = Date.now();

        try {
            // 1. 验证源文献和目标文献存在
            const [sourceItem, targetItem] = await Promise.all([
                this.literatureRepo.findByLid(sourceItemId),
                this.literatureRepo.findByLid(targetItemId),
            ]);

            if (!sourceItem || !targetItem) {
                throw new Error('Source or target literature not found');
            }

            // 2. 检查是否已存在相同的引文关系
            // TODO: 实现 findBySourceAndTarget 方法
            // const existingCitation = await this.citationRepo.findBySourceAndTarget(
            //     sourceItemId,
            //     targetItemId
            // );
            // if (existingCitation) {
            //     throw new Error('Citation relationship already exists');
            // }

            // 3. 创建引文记录
            const citation = await this.citationRepo.createCitation({
                sourceItemId,
                targetItemId,
                citationType: 'direct' as any,
                discoveryMethod: 'manual',
                isVerified: metadata?.verified ?? false,
                confidence: 1.0,
            });

            // 4. 清理相关缓存
            this.clearNetworkCache(sourceItemId, targetItemId);

            this.updateStats(Date.now() - startTime, true);

            if (citation === null) {
                throw new Error('Failed to create citation - already exists');
            }

            // 获取创建的引文对象
            const createdCitation = await this.citationRepo.findById(citation);
            return createdCitation as any;
        } catch (error) {
            this.updateStats(Date.now() - startTime, false);
            throw handleError(error, {
                operation: 'service.createCitation',
                layer: 'service',
                additionalInfo: { sourceItemId, targetItemId, citationType },
            });
        }
    }

    /**
     * 🔍 获取文献的引文网络
     */
    async getCitationNetwork(
        lids: string[],
        depth: number = 2,
        includeMetrics: boolean = true
    ): Promise<CitationNetworkResult> {
        const startTime = Date.now();

        try {
            const cacheKey = `network_${lids.sort().join(',')}_${depth}`;
            const cached = this.getCache<CitationNetworkResult>(cacheKey);
            if (cached) return cached;

            // 1. 获取网络数据
            const networkData = await this.buildCitationNetwork(lids, depth);

            // 2. 计算网络指标（如果需要）
            if (includeMetrics) {
                await this.calculateNetworkMetrics(networkData);
            }

            // 3. 计算网络统计
            const statistics = this.calculateNetworkStatistics(networkData);

            const result: CitationNetworkResult = {
                ...networkData,
                statistics,
            };

            this.setCache(cacheKey, result);
            this.updateStats(Date.now() - startTime, true);

            return result;
        } catch (error) {
            this.updateStats(Date.now() - startTime, false);
            throw handleError(error, {
                operation: 'service.getCitationNetwork',
                layer: 'service',
                additionalInfo: { lids, depth },
            });
        }
    }

    // ==================== 自动引文发现 ====================

    /**
     * 🤖 自动发现引文关系
     */
    async discoverCitations(
        paperId: string,
        options: {
            method?: 'similarity' | 'text_analysis' | 'metadata' | 'all';
            confidenceThreshold?: number;
            maxResults?: number;
        } = {}
    ): Promise<CitationDiscoveryResult> {
        const startTime = Date.now();

        try {
            const {
                method = 'all',
                confidenceThreshold = 0.5,
                maxResults = 50,
            } = options;

            // 1. 获取目标文献
            const targetLiterature = await this.literatureRepo.findByLid(paperId);
            if (!targetLiterature) {
                throw new Error('Target literature not found');
            }

            const potentialCitations: CitationDiscoveryResult['potentialCitations'] = [];

            // 2. 基于相似性的发现
            if (method === 'similarity' || method === 'all') {
                const similarityResults = await this.discoverBySimilarity(
                    targetLiterature,
                    confidenceThreshold,
                    Math.ceil(maxResults / 3)
                );
                potentialCitations.push(...similarityResults);
            }

            // 3. 基于文本分析的发现
            if (method === 'text_analysis' || method === 'all') {
                const textAnalysisResults = await this.discoverByTextAnalysis(
                    targetLiterature,
                    confidenceThreshold,
                    Math.ceil(maxResults / 3)
                );
                potentialCitations.push(...textAnalysisResults);
            }

            // 4. 基于元数据的发现
            if (method === 'metadata' || method === 'all') {
                const metadataResults = await this.discoverByMetadata(
                    targetLiterature,
                    confidenceThreshold,
                    Math.ceil(maxResults / 3)
                );
                potentialCitations.push(...metadataResults);
            }

            // 5. 去重并排序
            const uniqueCitations = this.deduplicateCitations(potentialCitations);
            const sortedCitations = uniqueCitations
                .sort((a, b) => b.confidence - a.confidence)
                .slice(0, maxResults);

            // 6. 生成推荐
            const recommendations = this.generateCitationRecommendations(sortedCitations);

            const result: CitationDiscoveryResult = {
                potentialCitations: sortedCitations,
                recommendations,
            };

            this.stats.discoveredCitations += sortedCitations.length;
            this.updateStats(Date.now() - startTime, true);

            return result;
        } catch (error) {
            this.updateStats(Date.now() - startTime, false);
            throw handleError(error, {
                operation: 'service.discoverCitations',
                layer: 'service',
                additionalInfo: { paperId },
            });
        }
    }

    // ==================== 引文验证 ====================

    /**
     * ✅ 验证引文关系
     */
    async verifyCitation(
        citationId: number,
        isValid: boolean,
        reason?: string
    ): Promise<Citation> {
        try {
            const citation = await this.citationRepo.findById(citationId);
            if (!citation) {
                throw new Error('Citation not found');
            }

            await this.citationRepo.update(citationId, {
                isVerified: isValid,
                verifiedBy: reason,
                verifiedAt: new Date(),
            });

            // 清理相关缓存
            this.clearNetworkCache(citation.sourceItemId, citation.targetItemId);

            return citation as any;
        } catch (error) {
            throw handleError(error, {
                operation: 'service.verifyCitation',
                layer: 'service',
                additionalInfo: { citationId, isValid, reason },
            });
        }
    }

    // ==================== 引文统计 ====================

    /**
     * 📊 获取引文统计信息
     */
    async getCitationStatistics(
        userId?: string,
        period?: { start: Date; end: Date }
    ): Promise<CitationStatistics> {
        try {
            const cacheKey = `citation_stats_${userId || 'all'}_${period?.start?.getTime()}_${period?.end?.getTime()}`;
            const cached = this.getCache<CitationStatistics>(cacheKey);
            if (cached) return cached;

            // 1. 获取引文数据
            const allCitations = await this.citationRepo.findAll();

            // 2. 过滤数据（如果有用户或时间限制）
            let filteredCitations = allCitations;
            if (period) {
                filteredCitations = allCitations.filter(citation =>
                    citation.createdAt >= period.start && citation.createdAt <= period.end
                );
            }

            // 3. 计算概览统计
            const overview = {
                totalCitations: filteredCitations.length,
                verifiedCitations: filteredCitations.filter(c => c.isVerified).length,
                pendingCitations: filteredCitations.filter(c => !c.isVerified && !c.verifiedBy).length,
                rejectedCitations: filteredCitations.filter(c => !c.isVerified && c.verifiedBy).length,
            };

            // 4. 计算网络统计
            const network = await this.calculateNetworkStatisticsFromCitations(filteredCitations);

            // 5. 计算质量指标
            const quality = {
                verificationRate: overview.totalCitations > 0
                    ? overview.verifiedCitations / overview.totalCitations
                    : 0,
                accuracyScore: 0.85, // 模拟数据
                completenessScore: 0.78, // 模拟数据
            };

            const statistics: CitationStatistics = {
                overview,
                network,
                quality,
            };

            this.setCache(cacheKey, statistics);
            return statistics;
        } catch (error) {
            throw handleError(error, {
                operation: 'service.getCitationStatistics',
                layer: 'service',
                userId,
            });
        }
    }

    // ==================== 私有方法 ====================

    private async buildCitationNetwork(
        lids: string[],
        depth: number
    ): Promise<Omit<CitationNetworkResult, 'statistics'>> {
        const nodes = new Map();
        const edges: CitationNetworkResult['edges'] = [];
        const visited = new Set<string>();
        const queue: Array<{ id: string; currentDepth: number }> =
            lids.map(id => ({ id, currentDepth: 0 }));

        while (queue.length > 0) {
            const { id, currentDepth } = queue.shift()!;

            if (visited.has(id) || currentDepth > depth) continue;
            visited.add(id);

            // 获取文献信息
            const literature = await this.literatureRepo.findByLid(id);
            if (!literature) continue;

            // 添加节点
            nodes.set(id, {
                id,
                title: literature.title,
                authors: literature.authors,
                year: literature.year,
                type: lids.includes(id) ? 'source' : 'intermediate',
                metrics: {
                    inDegree: 0,
                    outDegree: 0,
                    betweenness: 0,
                    pageRank: 0,
                },
            });

            // 获取引文关系
            const citations = await this.citationRepo.getBidirectionalCitations(id);

            // 处理出度（引用的文献）
            for (const outgoing of citations.outgoing) {
                edges.push({
                    source: id,
                    target: outgoing.targetItemId,
                    type: outgoing.citationType,
                    weight: outgoing.confidence ?? 1.0,
                    verified: outgoing.isVerified,
                });

                if (currentDepth < depth) {
                    queue.push({ id: outgoing.targetItemId, currentDepth: currentDepth + 1 });
                }
            }

            // 处理入度（被引用）
            for (const incoming of citations.incoming) {
                edges.push({
                    source: incoming.sourceItemId,
                    target: id,
                    type: incoming.citationType,
                    weight: incoming.confidence ?? 1.0,
                    verified: incoming.isVerified,
                });

                if (currentDepth < depth) {
                    queue.push({ id: incoming.sourceItemId, currentDepth: currentDepth + 1 });
                }
            }
        }

        return {
            nodes: Array.from(nodes.values()),
            edges,
        };
    }

    private async calculateNetworkMetrics(networkData: Omit<CitationNetworkResult, 'statistics'>) {
        // 计算度中心性
        const inDegree = new Map<string, number>();
        const outDegree = new Map<string, number>();

        for (const edge of networkData.edges) {
            outDegree.set(edge.source, (outDegree.get(edge.source) || 0) + 1);
            inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
        }

        // 更新节点指标
        for (const node of networkData.nodes) {
            node.metrics.inDegree = inDegree.get(node.id) || 0;
            node.metrics.outDegree = outDegree.get(node.id) || 0;

            // 简化的PageRank和Betweenness计算
            node.metrics.pageRank = (node.metrics.inDegree + 1) / (networkData.nodes.length + 1);
            node.metrics.betweenness = Math.random(); // 占位符
        }
    }

    private calculateNetworkStatistics(networkData: Omit<CitationNetworkResult, 'statistics'>) {
        const totalNodes = networkData.nodes.length;
        const totalEdges = networkData.edges.length;

        const density = totalNodes > 1
            ? (2 * totalEdges) / (totalNodes * (totalNodes - 1))
            : 0;

        const averageDegree = totalNodes > 0 ? (2 * totalEdges) / totalNodes : 0;

        return {
            totalNodes,
            totalEdges,
            density,
            averageDegree,
            clusters: 1, // 简化实现
        };
    }

    // ==================== 引文发现算法 ====================

    /**
     * 基于相似度发现潜在引文
     */
    private async discoverBySimilarity(
        targetLiterature: LibraryItem,
        threshold: number,
        limit: number
    ) {
        // 明确 similarItems 的类型
        type SimilarItem = {
            item: LibraryItem;
            score: number;
        };

        const similarItems: SimilarItem[] = await this.literatureRepo.findSimilar(targetLiterature, limit * 2);

        return similarItems
            .filter((similar: SimilarItem) => similar.score >= threshold)
            .slice(0, limit)
            .map((similar: SimilarItem) => ({
                sourceId: targetLiterature.paperId,
                targetId: similar.item.paperId,
                confidence: similar.score,
                evidence: ['Content similarity', 'Keyword overlap'],
                type: 'inferred' as const,
            }));
    }

    private async discoverByTextAnalysis(
        targetLiterature: LibraryItem,
        threshold: number,
        limit: number
    ) {
        // 简化实现：基于标题和摘要的文本分析
        const results: any[] = [];

        // 这里可以实现更复杂的文本分析逻辑
        // 比如NLP处理、实体识别等

        return results.slice(0, limit);
    }

    private async discoverByMetadata(
        targetLiterature: LibraryItem,
        threshold: number,
        limit: number
    ) {
        // 简化实现：基于作者、年份、来源等元数据
        const results: any[] = [];

        // 查找同作者的其他作品
        for (const author of targetLiterature.authors) {
            const authorWorks = await this.literatureRepo.searchWithFilters(
                { authors: [author] },
                { field: 'year', order: 'desc' },
                1,
                10
            );

            for (const work of authorWorks.items) {
                if (work.paperId !== targetLiterature.paperId) {
                    results.push({
                        sourceId: targetLiterature.paperId,
                        targetId: work.paperId,
                        confidence: 0.6,
                        evidence: [`Same author: ${author}`],
                        type: 'inferred' as const,
                    });
                }
            }
        }

        return results.slice(0, limit);
    }

    private deduplicateCitations(citations: any[]) {
        const seen = new Set<string>();
        return citations.filter(citation => {
            const key = `${citation.sourceId}_${citation.targetId}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    private generateCitationRecommendations(citations: any[]) {
        return citations
            .filter(citation => citation.confidence > 0.7)
            .slice(0, 10)
            .map(citation => ({
                paperId: citation.targetId,
                reason: `High confidence citation (${Math.round(citation.confidence * 100)}%)`,
                priority: (citation.confidence > 0.8 ? 'high' : 'medium') as 'high' | 'medium' | 'low',
            }));
    }

    private async calculateNetworkStatisticsFromCitations(citations: any[]) {
        const nodes = new Set<string>();
        citations.forEach(citation => {
            nodes.add(citation.sourceItemId);
            nodes.add(citation.targetItemId);
        });

        return {
            totalNodes: nodes.size,
            isolatedNodes: 0, // 需要实际计算
            largestComponent: Math.floor(nodes.size * 0.8), // 模拟数据
            averagePathLength: 2.5, // 模拟数据
        };
    }

    // ==================== 缓存管理 ====================

    private getCache<T>(key: string): T | null {
        const entry = this.citationCache.get(key);
        if (!entry) return null;

        if (Date.now() - entry.timestamp > entry.ttl) {
            this.citationCache.delete(key);
            return null;
        }

        return entry.data as T;
    }

    private setCache<T>(key: string, data: T, ttl: number = this.defaultCacheTTL): void {
        this.citationCache.set(key, {
            data,
            timestamp: Date.now(),
            ttl,
        });
    }

    private clearNetworkCache(sourceId: string, targetId: string): void {
        for (const [key] of this.citationCache) {
            if (key.includes('network') && (key.includes(sourceId) || key.includes(targetId))) {
                this.citationCache.delete(key);
            }
        }
    }

    private updateStats(responseTime: number, success: boolean): void {
        this.stats.totalOperations++;
        this.stats.averageResponseTime =
            (this.stats.averageResponseTime * (this.stats.totalOperations - 1) + responseTime) /
            this.stats.totalOperations;
    }

    /**
     * 📊 获取服务统计
     */
    public getCitationServiceStats() {
        return { ...this.stats };
    }

    /**
     * 🧹 清理缓存
     */
    public clearCache(): void {
        this.citationCache.clear();
    }
}

// 🏪 服务实例
export const citationService = new CitationService();

export default citationService;
