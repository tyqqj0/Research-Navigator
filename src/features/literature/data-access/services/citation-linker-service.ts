/**
 * 🔗 Citation Linker Service - 引文自动链接服务
 * 
 * 迁移自: old/src/libs/db/matching/CitationLinker.ts
 * 功能: 智能发现文献间的引用关系，自动构建引文网络
 * 算法: 多策略匹配（DOI、标题、作者、年份组合）
 */

import { CitationRepository, LiteratureRepository, literatureDomainRepositories } from '../repositories';
import {
    LibraryItem,
    Citation,
    CreateCitationInput,
    CitationNetwork
} from '../types';

// 📊 额外类型定义（服务层特有）
export interface CitationLinkResult {
    targetLiteratureId: string;
    strategy: CitationMatchStrategy;
    totalCandidates: number;
    potentialMatches: number;
    createdLinks: number;
    skippedLinks: number;
    executionTime: number;
    confidence: number;
}

export interface BidirectionalLinkResult {
    forwardLinks: number;
    backwardLinks: number;
}

export type CitationMatchStrategy = 'all' | 'doi_only' | 'title_only' | 'author_year' | 'combined';

export type CitationConfidenceLevel = 'low' | 'medium' | 'high' | 'very_high';

/**
 * 🎯 引文匹配配置
 */
interface CitationLinkingConfig {
    // 🔍 匹配策略配置
    strategies: {
        doi: { enabled: boolean; weight: number; confidence: number };
        title: { enabled: boolean; threshold: number; weight: number };
        authorYear: { enabled: boolean; minCommonAuthors: number; weight: number };
        combined: { enabled: boolean; minConfidence: number };
    };

    // 📊 批处理配置
    batch: {
        size: number;
        delayMs: number;
        maxConcurrent: number;
    };

    // 🛡️ 安全配置
    safety: {
        maxLinksPerItem: number;
        preventSelfLinks: boolean;
        requireMinimumEvidence: boolean;
    };
}

/**
 * 🔗 Citation Linker Service
 * 
 * 核心功能：
 * 1. 智能引文发现和链接
 * 2. 多策略匹配算法
 * 3. 批量处理和性能优化
 * 4. 引文网络构建
 */
export class CitationLinkerService {
    private readonly defaultConfig: CitationLinkingConfig = {
        strategies: {
            doi: { enabled: true, weight: 1.0, confidence: 0.95 },
            title: { enabled: true, threshold: 0.85, weight: 0.8 },
            authorYear: { enabled: true, minCommonAuthors: 1, weight: 0.7 },
            combined: { enabled: true, minConfidence: 0.6 }
        },
        batch: {
            size: 50,
            delayMs: 100,
            maxConcurrent: 3
        },
        safety: {
            maxLinksPerItem: 100,
            preventSelfLinks: true,
            requireMinimumEvidence: true
        }
    };

    constructor(
        private readonly citationRepo: CitationRepository,
        private readonly literatureRepo: LiteratureRepository,
        private readonly config: CitationLinkingConfig = {} as CitationLinkingConfig
    ) {
        // 合并配置
        this.config = { ...this.defaultConfig, ...config };
    }

    // ==================== 核心链接功能 ====================

    /**
     * 🔗 为单个文献创建引文链接
     */
    async linkCitationsForLiterature(
        literatureId: string,
        strategy: CitationMatchStrategy = 'all'
    ): Promise<CitationLinkResult> {
        try {
            const startTime = Date.now();
            console.log(`[CitationLinker] Starting citation linking for literature: ${literatureId}`);

            const targetLiterature = await this.literatureRepo.findById(literatureId);
            if (!targetLiterature) {
                throw new Error(`Literature ${literatureId} not found`);
            }

            // 获取所有可能的候选文献
            const candidateLiteratures = await this.literatureRepo.findAll();
            const filteredCandidates = candidateLiteratures.filter(item =>
                item.id !== literatureId // 防止自引用
            );

            console.log(`[CitationLinker] Found ${filteredCandidates.length} candidate literatures`);

            // 执行匹配
            const matches = await this.findMatches(targetLiterature, filteredCandidates, strategy);

            // 创建引文链接
            const createdCitations = await this.createCitationLinks(matches);

            const result: CitationLinkResult = {
                targetLiteratureId: literatureId,
                strategy,
                totalCandidates: filteredCandidates.length,
                potentialMatches: matches.length,
                createdLinks: createdCitations.created,
                skippedLinks: createdCitations.skipped,
                executionTime: Date.now() - startTime,
                confidence: this.calculateAverageConfidence(matches)
            };

            console.log(`[CitationLinker] Citation linking completed:`, result);
            return result;
        } catch (error) {
            console.error('[CitationLinker] linkCitationsForLiterature failed:', error);
            throw new Error('Failed to link citations for literature');
        }
    }

    /**
     * 🔄 双向引文链接 - 发现相互引用
     */
    async createBidirectionalLinks(
        literatureId1: string,
        literatureId2: string
    ): Promise<BidirectionalLinkResult> {
        try {
            const [lit1, lit2] = await Promise.all([
                this.literatureRepo.findById(literatureId1),
                this.literatureRepo.findById(literatureId2)
            ]);

            if (!lit1 || !lit2) {
                throw new Error('One or both literatures not found');
            }

            // 分析两个方向的引用可能性
            const matches1to2 = await this.findMatches(lit1, [lit2], 'all');
            const matches2to1 = await this.findMatches(lit2, [lit1], 'all');

            let forwardLinks = 0;
            let backwardLinks = 0;

            // 创建1->2的链接
            if (matches1to2.length > 0) {
                const result1 = await this.createCitationLinks(matches1to2);
                forwardLinks = result1.created;
            }

            // 创建2->1的链接
            if (matches2to1.length > 0) {
                const result2 = await this.createCitationLinks(matches2to1);
                backwardLinks = result2.created;
            }

            return { forwardLinks, backwardLinks };
        } catch (error) {
            console.error('[CitationLinker] createBidirectionalLinks failed:', error);
            throw new Error('Failed to create bidirectional links');
        }
    }

    /**
     * 📦 批量处理所有文献的引文链接
     */
    async linkAllCitations(
        strategy: CitationMatchStrategy = 'all',
        progressCallback?: (progress: number, current: number, total: number) => void
    ): Promise<{
        totalProcessed: number;
        totalLinksCreated: number;
        totalLinksSkipped: number;
        executionTime: number;
        errors: string[];
    }> {
        const startTime = Date.now();
        const allLiteratures = await this.literatureRepo.findAll();
        const errors: string[] = [];
        let totalLinksCreated = 0;
        let totalLinksSkipped = 0;

        console.log(`[CitationLinker] Starting batch citation linking for ${allLiteratures.length} literatures`);

        try {
            for (let i = 0; i < allLiteratures.length; i++) {
                const literature = allLiteratures[i];

                try {
                    const result = await this.linkCitationsForLiterature(literature.id, strategy);
                    totalLinksCreated += result.createdLinks;
                    totalLinksSkipped += result.skippedLinks;

                    // 报告进度
                    if (progressCallback) {
                        const progress = ((i + 1) / allLiteratures.length) * 100;
                        progressCallback(progress, i + 1, allLiteratures.length);
                    }

                    // 批量处理延迟
                    if (i % this.config.batch.size === 0 && i > 0) {
                        await new Promise(resolve => setTimeout(resolve, this.config.batch.delayMs));
                    }

                } catch (error) {
                    const errorMsg = `Failed to process literature ${literature.id}: ${error}`;
                    console.error('[CitationLinker]', errorMsg);
                    errors.push(errorMsg);
                }
            }

            const result = {
                totalProcessed: allLiteratures.length,
                totalLinksCreated,
                totalLinksSkipped,
                executionTime: Date.now() - startTime,
                errors
            };

            console.log(`[CitationLinker] Batch citation linking completed:`, result);
            return result;
        } catch (error) {
            console.error('[CitationLinker] linkAllCitations failed:', error);
            throw new Error('Failed to link all citations');
        }
    }

    // ==================== 匹配算法 ====================

    /**
     * 🔍 查找引文匹配
     */
    private async findMatches(
        targetLiterature: LibraryItem,
        candidateLiteratures: LibraryItem[],
        strategy: CitationMatchStrategy
    ): Promise<Array<{
        sourceLiterature: LibraryItem;
        targetLiterature: LibraryItem;
        confidence: number;
        method: string;
        evidence: string[];
    }>> {
        const matches: Array<{
            sourceLiterature: LibraryItem;
            targetLiterature: LibraryItem;
            confidence: number;
            method: string;
            evidence: string[];
        }> = [];

        for (const candidate of candidateLiteratures) {
            const matchResult = this.calculateMatchConfidence(targetLiterature, candidate, strategy);

            if (matchResult.confidence >= this.config.strategies.combined.minConfidence) {
                matches.push({
                    sourceLiterature: candidate,
                    targetLiterature: targetLiterature,
                    confidence: matchResult.confidence,
                    method: matchResult.method,
                    evidence: matchResult.evidence
                });
            }
        }

        // 按置信度排序
        return matches.sort((a, b) => b.confidence - a.confidence);
    }

    /**
     * 📊 计算匹配置信度
     */
    private calculateMatchConfidence(
        lit1: LibraryItem,
        lit2: LibraryItem,
        strategy: CitationMatchStrategy
    ): {
        confidence: number;
        method: string;
        evidence: string[];
    } {
        const evidence: string[] = [];
        let totalConfidence = 0;
        let totalWeight = 0;
        let method = 'combined';

        // 策略1: DOI精确匹配
        if (this.config.strategies.doi.enabled && lit1.doi && lit2.doi) {
            if (lit1.doi === lit2.doi) {
                evidence.push('DOI exact match');
                totalConfidence += this.config.strategies.doi.confidence * this.config.strategies.doi.weight;
                totalWeight += this.config.strategies.doi.weight;
                method = 'doi';
            }
        }

        // 策略2: 标题相似性
        if (this.config.strategies.title.enabled && strategy !== 'doi_only') {
            const titleSimilarity = this.calculateStringSimilarity(
                lit1.title.toLowerCase(),
                lit2.title.toLowerCase()
            );

            if (titleSimilarity >= this.config.strategies.title.threshold) {
                evidence.push(`Title similarity: ${(titleSimilarity * 100).toFixed(1)}%`);
                totalConfidence += titleSimilarity * this.config.strategies.title.weight;
                totalWeight += this.config.strategies.title.weight;

                if (method === 'combined' && titleSimilarity > 0.9) {
                    method = 'title';
                }
            }
        }

        // 策略3: 作者+年份组合
        if (this.config.strategies.authorYear.enabled && strategy !== 'doi_only') {
            const commonAuthors = this.findCommonAuthors(lit1.authors, lit2.authors);
            const yearDiff = Math.abs(lit1.year - lit2.year);

            if (commonAuthors >= this.config.strategies.authorYear.minCommonAuthors && yearDiff <= 1) {
                evidence.push(`Common authors: ${commonAuthors}, Year diff: ${yearDiff}`);
                const authorYearConfidence = Math.min(
                    (commonAuthors / Math.max(lit1.authors.length, lit2.authors.length)) * 0.8 +
                    (yearDiff === 0 ? 0.2 : 0.1),
                    1.0
                );

                totalConfidence += authorYearConfidence * this.config.strategies.authorYear.weight;
                totalWeight += this.config.strategies.authorYear.weight;

                if (method === 'combined' && commonAuthors >= 2 && yearDiff === 0) {
                    method = 'author_year';
                }
            }
        }

        // 最终置信度计算
        const finalConfidence = totalWeight > 0 ? totalConfidence / totalWeight : 0;

        return {
            confidence: Math.min(finalConfidence, 1.0),
            method,
            evidence
        };
    }

    /**
     * 🔗 创建引文链接
     */
    private async createCitationLinks(
        matches: Array<{
            sourceLiterature: LibraryItem;
            targetLiterature: LibraryItem;
            confidence: number;
            method: string;
            evidence: string[];
        }>
    ): Promise<{ created: number; skipped: number; errors: number }> {
        const citationInputs: CreateCitationInput[] = matches.map(match => ({
            sourceItemId: match.sourceLiterature.id,
            targetItemId: match.targetLiterature.id,
            citationType: this.inferCitationType(match.confidence, match.method),
            discoveryMethod: 'automatic',
            confidence: match.confidence,
            context: match.evidence.join('; '),
            isVerified: match.confidence >= 0.9
        }));

        return await this.citationRepo.bulkCreateCitations(citationInputs);
    }

    // ==================== 工具方法 ====================

    /**
     * 🔤 计算字符串相似度
     */
    private calculateStringSimilarity(str1: string, str2: string): number {
        const maxLength = Math.max(str1.length, str2.length);
        if (maxLength === 0) return 1;

        const distance = this.levenshteinDistance(str1, str2);
        return 1 - distance / maxLength;
    }

    /**
     * 📏 Levenshtein距离算法
     */
    private levenshteinDistance(str1: string, str2: string): number {
        const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

        for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
        for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                if (str1[i - 1] === str2[j - 1]) {
                    matrix[j][i] = matrix[j - 1][i - 1];
                } else {
                    matrix[j][i] = Math.min(
                        matrix[j - 1][i - 1] + 1,
                        matrix[j][i - 1] + 1,
                        matrix[j - 1][i] + 1
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    }

    /**
     * 👥 查找共同作者数量
     */
    private findCommonAuthors(authors1: string[], authors2: string[]): number {
        const normalizedAuthors1 = authors1.map(author => author.toLowerCase().trim());
        const normalizedAuthors2 = authors2.map(author => author.toLowerCase().trim());

        return normalizedAuthors1.filter(author1 =>
            normalizedAuthors2.some(author2 =>
                author1.includes(author2) || author2.includes(author1) ||
                this.calculateStringSimilarity(author1, author2) > 0.8
            )
        ).length;
    }

    /**
     * 🎯 推断引文类型
     */
    private inferCitationType(
        confidence: number,
        method: string
    ): 'direct' | 'indirect' | 'supportive' | 'contradictory' | 'methodological' | 'background' {
        if (confidence >= 0.9) return 'direct';
        if (confidence >= 0.7) return 'supportive';
        if (method === 'author_year') return 'methodological';
        return 'background';
    }

    /**
     * 📊 计算平均置信度
     */
    private calculateAverageConfidence(
        matches: Array<{ confidence: number }>
    ): number {
        if (matches.length === 0) return 0;
        const totalConfidence = matches.reduce((sum, match) => sum + match.confidence, 0);
        return totalConfidence / matches.length;
    }

    // ==================== 网络分析 ====================

    /**
     * 🕸️ 构建引文网络
     */
    async buildCitationNetwork(
        centerLiteratureIds?: string[],
        maxDepth: number = 2
    ): Promise<CitationNetwork> {
        try {
            return await this.citationRepo.buildCitationNetwork(centerLiteratureIds, maxDepth);
        } catch (error) {
            console.error('[CitationLinker] buildCitationNetwork failed:', error);
            throw new Error('Failed to build citation network');
        }
    }

    /**
     * 🔍 查找引文路径
     */
    async findCitationPath(
        sourceLiteratureId: string,
        targetLiteratureId: string,
        maxDepth: number = 3
    ): Promise<string[][]> {
        try {
            // 简化实现：使用BFS查找路径
            const visited = new Set<string>();
            const queue = [[sourceLiteratureId]];
            const paths: string[][] = [];

            while (queue.length > 0 && paths.length < 10) { // 限制路径数量
                const currentPath = queue.shift()!;
                const currentNode = currentPath[currentPath.length - 1];

                if (currentNode === targetLiteratureId) {
                    paths.push(currentPath);
                    continue;
                }

                if (currentPath.length >= maxDepth || visited.has(currentNode)) {
                    continue;
                }

                visited.add(currentNode);

                // 获取当前节点的出度引文
                const outgoingCitations = await this.citationRepo.findOutgoingCitations(currentNode);

                for (const citation of outgoingCitations) {
                    if (!currentPath.includes(citation.targetItemId)) {
                        queue.push([...currentPath, citation.targetItemId]);
                    }
                }
            }

            return paths;
        } catch (error) {
            console.error('[CitationLinker] findCitationPath failed:', error);
            throw new Error('Failed to find citation path');
        }
    }
}

// 🏪 单例服务实例
export const citationLinkerService = new CitationLinkerService(
    literatureDomainRepositories.citation,
    literatureDomainRepositories.literature
);
