/**
 * 🏗️ Enhanced Literature Repository - 优化版文献仓储
 * 
 * 设计原则:
 * 1. 智能查重 - 基于多字段的相似性检测
 * 2. 高性能查询 - 利用索引和缓存优化
 * 3. 批量操作 - 支持大量数据的高效处理
 * 4. 事务支持 - 复杂操作的原子性保证
 * 5. 统一错误处理 - 集成领域错误系统
 */

import { BaseRepository } from './base-repository';
import { enhancedLiteratureDB, type DatabaseStatistics } from '../database';
import {
    LibraryItemCore,
    CreateLiteratureInput,
    UpdateLiteratureInput,
    LiteratureFilter,
    LiteratureSort,
    PaginatedResult,
    ModelFactory,
    ModelValidators,
    ErrorHandler,
    NotFoundError,
    BusinessLogicError,
    withErrorBoundary,
    LITERATURE_CONSTANTS,
} from '../models';

/**
 * 🎯 文献操作结果接口
 */
export interface LiteratureOperationResult {
    id: string;
    isNew: boolean;
    operation: 'created' | 'updated' | 'merged';
    mergedFields?: string[];
    duplicateScore?: number;
    message: string;
}

/**
 * 🎯 批量操作结果接口
 */
export interface BulkLiteratureResult {
    total: number;
    successful: number;
    failed: number;
    duplicates: number;
    results: LiteratureOperationResult[];
    executionTime: number;
    errors: Array<{ index: number; error: string; data?: any }>;
}

/**
 * 🎯 相似性检测结果接口
 */
export interface SimilarityResult {
    item: LibraryItemCore;
    score: number;
    matchedFields: string[];
    confidence: 'high' | 'medium' | 'low';
}

/**
 * 🎯 文献统计接口
 */
export interface LiteratureStatistics {
    total: number;
    bySource: Record<string, number>;
    byYear: Record<number, number>;
    byLanguage: Record<string, number>;
    byStatus: Record<string, number>;
    recentlyAdded: {
        lastDay: number;
        lastWeek: number;
        lastMonth: number;
    };
    topAuthors: Array<{ name: string; count: number }>;
    topKeywords: Array<{ keyword: string; count: number }>;
}

/**
 * 🏗️ 增强版文献仓储类
 */
export class EnhancedLiteratureRepository extends BaseRepository<LibraryItemCore, string> {
    protected table = enhancedLiteratureDB.libraries;
    protected generateId = () => crypto.randomUUID();

    // 📊 相似性检测阈值
    private readonly SIMILARITY_THRESHOLDS = {
        HIGH: 0.9,      // 高度相似，几乎确定是重复
        MEDIUM: 0.7,    // 中度相似，需要用户确认
        LOW: 0.5,       // 低度相似，仅作为参考
    };

    // ==================== 核心CRUD操作增强 ====================

    /**
     * 🔍 根据文献ID查找（支持缓存）
     */
    @withErrorBoundary('findByLid', 'repository')
    async findByLid(lid: string): Promise<LibraryItemCore | null> {
        if (!lid) {
            throw new NotFoundError('LibraryItem', lid, {
                operation: 'findByLid',
                layer: 'repository',
            });
        }

        try {
            const item = await this.table.get(lid);
            return item || null;
        } catch (error) {
            throw ErrorHandler.handle(error, {
                operation: 'repository.findByLid',
                layer: 'repository',
                entityType: 'LibraryItem',
                entityId: lid,
            });
        }
    }

    /**
     * ➕ 智能创建或更新文献
     */
    @withErrorBoundary('createOrUpdate', 'repository')
    async createOrUpdate(input: CreateLiteratureInput): Promise<LiteratureOperationResult> {
        try {
            // 1. 数据验证
            ModelValidators.createInput(input);

            // 2. 智能查重检测
            const duplicateResults = await this.findSimilar(input);
            const highSimilarity = duplicateResults.find(r => r.score >= this.SIMILARITY_THRESHOLDS.HIGH);

            if (highSimilarity) {
                // 高度相似，执行智能合并
                return await this.intelligentMerge(highSimilarity.item, input);
            }

            const mediumSimilarity = duplicateResults.find(r =>
                r.score >= this.SIMILARITY_THRESHOLDS.MEDIUM && r.score < this.SIMILARITY_THRESHOLDS.HIGH
            );

            if (mediumSimilarity) {
                // 中度相似，提示用户但仍创建新记录
                const newItem = ModelFactory.createLiteratureItem(input);
                await this.table.add(newItem);

                return {
                    id: newItem.lid,
                    isNew: true,
                    operation: 'created',
                    duplicateScore: mediumSimilarity.score,
                    message: `Created new literature item (potential duplicate detected with score ${mediumSimilarity.score.toFixed(2)})`,
                };
            }

            // 3. 创建新文献
            const newItem = ModelFactory.createLiteratureItem(input);
            await this.table.add(newItem);

            return {
                id: newItem.lid,
                isNew: true,
                operation: 'created',
                message: 'Literature item created successfully',
            };
        } catch (error) {
            throw ErrorHandler.handle(error, {
                operation: 'repository.createOrUpdate',
                layer: 'repository',
                inputData: input,
            });
        }
    }

    /**
     * 📦 批量导入文献
     */
    @withErrorBoundary('bulkImport', 'repository')
    async bulkImport(inputs: CreateLiteratureInput[]): Promise<BulkLiteratureResult> {
        const startTime = Date.now();
        const results: LiteratureOperationResult[] = [];
        const errors: Array<{ index: number; error: string; data?: any }> = [];

        let successful = 0;
        let failed = 0;
        let duplicates = 0;

        try {
            // 分批处理，避免内存压力
            const batchSize = Math.min(LITERATURE_CONSTANTS.MAX_BULK_SIZE, 100);

            for (let i = 0; i < inputs.length; i += batchSize) {
                const batch = inputs.slice(i, i + batchSize);

                // 使用事务处理每个批次
                await enhancedLiteratureDB.transaction('rw', this.table, async (tx) => {
                    for (let j = 0; j < batch.length; j++) {
                        const input = batch[j];
                        const globalIndex = i + j;

                        try {
                            const result = await this.createOrUpdate(input);
                            results.push(result);

                            if (result.isNew) {
                                successful++;
                            } else {
                                duplicates++;
                            }
                        } catch (error) {
                            failed++;
                            errors.push({
                                index: globalIndex,
                                error: error instanceof Error ? error.message : String(error),
                                data: input,
                            });
                        }
                    }
                });
            }

            return {
                total: inputs.length,
                successful,
                failed,
                duplicates,
                results,
                executionTime: Date.now() - startTime,
                errors,
            };
        } catch (error) {
            throw ErrorHandler.handle(error, {
                operation: 'repository.bulkImport',
                layer: 'repository',
                additionalInfo: { totalInputs: inputs.length },
            });
        }
    }

    // ==================== 高级查询功能 ====================

    /**
     * 🔍 高级搜索文献
     */
    @withErrorBoundary('searchWithFilters', 'repository')
    async searchWithFilters(
        filter: LiteratureFilter = {},
        sort: LiteratureSort = { field: 'createdAt', order: 'desc' },
        page: number = 1,
        pageSize: number = LITERATURE_CONSTANTS.DEFAULT_PAGE_SIZE
    ): Promise<PaginatedResult<LibraryItemCore>> {
        try {
            // 使用增强版数据库的高性能搜索
            return await enhancedLiteratureDB.searchLiteratures(filter, sort, page, pageSize);
        } catch (error) {
            throw ErrorHandler.handle(error, {
                operation: 'repository.searchWithFilters',
                layer: 'repository',
                additionalInfo: { filter, sort, page, pageSize },
            });
        }
    }

    /**
     * 🔍 根据标题相似性查找文献
     */
    @withErrorBoundary('findByTitleSimilar', 'repository')
    async findByTitleSimilar(
        title: string,
        threshold: number = 0.6,
        limit: number = 10
    ): Promise<LibraryItemCore[]> {
        try {
            const allItems = await this.table.toArray();
            const similarItems: Array<{ item: LibraryItemCore; score: number }> = [];

            for (const item of allItems) {
                const score = this.calculateTitleSimilarity(title, item.title);
                if (score >= threshold) {
                    similarItems.push({ item, score });
                }
            }

            // 按相似度排序并限制数量
            return similarItems
                .sort((a, b) => b.score - a.score)
                .slice(0, limit)
                .map(result => result.item);
        } catch (error) {
            throw ErrorHandler.handle(error, {
                operation: 'repository.findByTitleSimilar',
                layer: 'repository',
                additionalInfo: { title, threshold, limit },
            });
        }
    }

    /**
     * 🔍 查找相似文献（综合相似性）
     */
    @withErrorBoundary('findSimilar', 'repository')
    async findSimilar(
        input: CreateLiteratureInput | LibraryItemCore,
        limit: number = 10
    ): Promise<SimilarityResult[]> {
        try {
            const allItems = await this.table.toArray();
            const similarities: SimilarityResult[] = [];

            for (const item of allItems) {
                const similarity = this.calculateComprehensiveSimilarity(input, item);

                if (similarity.score >= this.SIMILARITY_THRESHOLDS.LOW) {
                    similarities.push(similarity);
                }
            }

            // 按相似度排序并限制数量
            return similarities
                .sort((a, b) => b.score - a.score)
                .slice(0, limit);
        } catch (error) {
            throw ErrorHandler.handle(error, {
                operation: 'repository.findSimilar',
                layer: 'repository',
                additionalInfo: { limit },
            });
        }
    }

    /**
     * 📊 获取文献统计信息
     */
    @withErrorBoundary('getStatistics', 'repository')
    async getStatistics(): Promise<LiteratureStatistics> {
        try {
            const allItems = await this.table.toArray();
            const now = new Date();
            const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

            // 基本统计
            const bySource: Record<string, number> = {};
            const byYear: Record<number, number> = {};
            const byLanguage: Record<string, number> = {};
            const byStatus: Record<string, number> = {};

            // 作者统计
            const authorCounts: Record<string, number> = {};
            const keywordCounts: Record<string, number> = {};

            let recentDay = 0;
            let recentWeek = 0;
            let recentMonth = 0;

            for (const item of allItems) {
                // 来源统计
                bySource[item.source] = (bySource[item.source] || 0) + 1;

                // 年份统计
                if (item.year) {
                    byYear[item.year] = (byYear[item.year] || 0) + 1;
                }

                // 语言统计
                byLanguage[item.language] = (byLanguage[item.language] || 0) + 1;

                // 状态统计
                byStatus[item.status] = (byStatus[item.status] || 0) + 1;

                // 作者统计
                for (const author of item.authors) {
                    authorCounts[author] = (authorCounts[author] || 0) + 1;
                }

                // 关键词统计
                for (const keyword of item.keywords) {
                    keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
                }

                // 时间统计
                if (item.createdAt > oneDayAgo) recentDay++;
                if (item.createdAt > oneWeekAgo) recentWeek++;
                if (item.createdAt > oneMonthAgo) recentMonth++;
            }

            // 排序获取Top项
            const topAuthors = Object.entries(authorCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 20)
                .map(([name, count]) => ({ name, count }));

            const topKeywords = Object.entries(keywordCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 30)
                .map(([keyword, count]) => ({ keyword, count }));

            return {
                total: allItems.length,
                bySource,
                byYear,
                byLanguage,
                byStatus,
                recentlyAdded: {
                    lastDay: recentDay,
                    lastWeek: recentWeek,
                    lastMonth: recentMonth,
                },
                topAuthors,
                topKeywords,
            };
        } catch (error) {
            throw ErrorHandler.handle(error, {
                operation: 'repository.getStatistics',
                layer: 'repository',
            });
        }
    }

    // ==================== 维护操作 ====================

    /**
     * 🧹 清理重复文献
     */
    @withErrorBoundary('cleanupDuplicates', 'repository')
    async cleanupDuplicates(): Promise<{
        duplicatesFound: number;
        duplicatesRemoved: number;
        mergedItems: number;
    }> {
        try {
            const allItems = await this.table.toArray();
            const duplicateGroups: LibraryItemCore[][] = [];
            const processedIds = new Set<string>();

            // 查找重复组
            for (const item of allItems) {
                if (processedIds.has(item.lid)) continue;

                const duplicates = [item];
                processedIds.add(item.lid);

                // 查找与当前项目相似的其他项目
                for (const otherItem of allItems) {
                    if (processedIds.has(otherItem.lid)) continue;

                    const similarity = this.calculateComprehensiveSimilarity(item, otherItem);
                    if (similarity.score >= this.SIMILARITY_THRESHOLDS.HIGH) {
                        duplicates.push(otherItem);
                        processedIds.add(otherItem.lid);
                    }
                }

                if (duplicates.length > 1) {
                    duplicateGroups.push(duplicates);
                }
            }

            // 处理重复组
            let duplicatesRemoved = 0;
            let mergedItems = 0;

            for (const group of duplicateGroups) {
                // 选择最完整的记录作为主记录
                const primaryItem = this.selectPrimaryItem(group);
                const duplicateIds = group
                    .filter(item => item.lid !== primaryItem.lid)
                    .map(item => item.lid);

                // 删除重复项
                await this.table.bulkDelete(duplicateIds);
                duplicatesRemoved += duplicateIds.length;
                mergedItems++;
            }

            return {
                duplicatesFound: duplicateGroups.reduce((sum, group) => sum + group.length - 1, 0),
                duplicatesRemoved,
                mergedItems,
            };
        } catch (error) {
            throw ErrorHandler.handle(error, {
                operation: 'repository.cleanupDuplicates',
                layer: 'repository',
            });
        }
    }

    // ==================== 私有辅助方法 ====================

    /**
     * 🔍 计算标题相似度
     */
    private calculateTitleSimilarity(title1: string, title2: string): number {
        const normalize = (str: string) => str.toLowerCase().trim().replace(/[^\w\s]/g, '');
        const t1 = normalize(title1);
        const t2 = normalize(title2);

        if (t1 === t2) return 1.0;

        // 使用Jaccard相似度
        const words1 = new Set(t1.split(/\s+/));
        const words2 = new Set(t2.split(/\s+/));

        const intersection = new Set([...words1].filter(word => words2.has(word)));
        const union = new Set([...words1, ...words2]);

        return intersection.size / union.size;
    }

    /**
     * 🔍 计算综合相似度
     */
    private calculateComprehensiveSimilarity(
        item1: CreateLiteratureInput | LibraryItemCore,
        item2: LibraryItemCore
    ): SimilarityResult {
        const matchedFields: string[] = [];
        let totalScore = 0;
        let weightSum = 0;

        // 标题相似度 (权重: 40%)
        const titleScore = this.calculateTitleSimilarity(item1.title, item2.title);
        if (titleScore > 0.3) {
            matchedFields.push('title');
            totalScore += titleScore * 0.4;
        }
        weightSum += 0.4;

        // 作者相似度 (权重: 25%)
        const authorScore = this.calculateAuthorSimilarity(item1.authors, item2.authors);
        if (authorScore > 0.3) {
            matchedFields.push('authors');
            totalScore += authorScore * 0.25;
        }
        weightSum += 0.25;

        // DOI匹配 (权重: 20%)
        if (item1.doi && item2.doi && item1.doi === item2.doi) {
            matchedFields.push('doi');
            totalScore += 1.0 * 0.2;
        }
        weightSum += 0.2;

        // 年份匹配 (权重: 10%)
        if (item1.year && item2.year && item1.year === item2.year) {
            matchedFields.push('year');
            totalScore += 1.0 * 0.1;
        }
        weightSum += 0.1;

        // URL匹配 (权重: 5%)
        if (item1.url && item2.url && item1.url === item2.url) {
            matchedFields.push('url');
            totalScore += 1.0 * 0.05;
        }
        weightSum += 0.05;

        const finalScore = weightSum > 0 ? totalScore / weightSum : 0;

        let confidence: 'high' | 'medium' | 'low';
        if (finalScore >= this.SIMILARITY_THRESHOLDS.HIGH) {
            confidence = 'high';
        } else if (finalScore >= this.SIMILARITY_THRESHOLDS.MEDIUM) {
            confidence = 'medium';
        } else {
            confidence = 'low';
        }

        return {
            item: item2,
            score: finalScore,
            matchedFields,
            confidence,
        };
    }

    /**
     * 🔍 计算作者相似度
     */
    private calculateAuthorSimilarity(authors1: string[], authors2: string[]): number {
        if (authors1.length === 0 && authors2.length === 0) return 1.0;
        if (authors1.length === 0 || authors2.length === 0) return 0.0;

        const normalize = (authors: string[]) =>
            authors.map(author => author.toLowerCase().trim());

        const a1 = new Set(normalize(authors1));
        const a2 = new Set(normalize(authors2));

        const intersection = new Set([...a1].filter(author => a2.has(author)));
        const union = new Set([...a1, ...a2]);

        return intersection.size / union.size;
    }

    /**
     * 🤖 智能合并文献记录
     */
    private async intelligentMerge(
        existingItem: LibraryItemCore,
        newInput: CreateLiteratureInput
    ): Promise<LiteratureOperationResult> {
        const mergedFields: string[] = [];
        const updates: Partial<LibraryItemCore> = {};

        // 智能合并逻辑
        if (!existingItem.abstract && newInput.abstract) {
            updates.abstract = newInput.abstract;
            mergedFields.push('abstract');
        }

        if (!existingItem.doi && newInput.doi) {
            updates.doi = newInput.doi;
            mergedFields.push('doi');
        }

        if (!existingItem.url && newInput.url) {
            updates.url = newInput.url;
            mergedFields.push('url');
        }

        if (!existingItem.pdfPath && newInput.pdfPath) {
            updates.pdfPath = newInput.pdfPath;
            mergedFields.push('pdfPath');
        }

        // 合并关键词
        const newKeywords = newInput.keywords?.filter(
            keyword => !existingItem.keywords.includes(keyword)
        ) || [];

        if (newKeywords.length > 0) {
            updates.keywords = [...existingItem.keywords, ...newKeywords];
            mergedFields.push('keywords');
        }

        // 如果有更新，执行合并
        if (Object.keys(updates).length > 0) {
            await this.update(existingItem.lid, updates);
        }

        return {
            id: existingItem.lid,
            isNew: false,
            operation: 'merged',
            mergedFields,
            message: `Merged ${mergedFields.length} fields into existing literature item`,
        };
    }

    /**
     * 🎯 选择主要记录（用于去重）
     */
    private selectPrimaryItem(items: LibraryItemCore[]): LibraryItemCore {
        // 选择最完整的记录作为主记录
        return items.reduce((primary, current) => {
            const primaryScore = this.calculateCompletenessScore(primary);
            const currentScore = this.calculateCompletenessScore(current);

            return currentScore > primaryScore ? current : primary;
        });
    }

    /**
     * 📊 计算记录完整度评分
     */
    private calculateCompletenessScore(item: LibraryItemCore): number {
        let score = 0;

        if (item.title) score += 2;
        if (item.authors.length > 0) score += 2;
        if (item.abstract) score += 1;
        if (item.doi) score += 1;
        if (item.url) score += 1;
        if (item.year) score += 1;
        if (item.publication) score += 1;
        if (item.keywords.length > 0) score += 1;
        if (item.pdfPath) score += 1;

        return score;
    }
}

// 🏪 仓储实例
export const enhancedLiteratureRepository = new EnhancedLiteratureRepository();

export default enhancedLiteratureRepository;
