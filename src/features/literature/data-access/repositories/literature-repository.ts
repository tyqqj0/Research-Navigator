/**
 * 📚 Literature Repository - 文献数据仓储层
 * 
 * 迁移自: old/src/libs/db/LibraryService.ts (1000+行)
 * 优化: Repository Pattern + 类型安全 + 现代化架构
 */

import { BaseRepository } from './base-repository';
import { literatureDB, DatabaseUtils } from '../database';
import {
    LibraryItem,
    ExtendedLibraryItem,
    CreateLibraryItemInput,
    UpdateLibraryItemInput,
    LiteratureFilter,
    LiteratureSort,
    LibraryItemSchema,
    ExtendedLibraryItemSchema
} from '../types';
import type { Table } from 'dexie';

/**
 * 📚 文献仓储实现
 */
export class LiteratureRepository extends BaseRepository<ExtendedLibraryItem, string> {
    protected table: Table<ExtendedLibraryItem, string>;

    constructor() {
        super();
        this.table = literatureDB.libraries;
    }

    protected generateId(): string {
        return DatabaseUtils.generateId();
    }

    /**
     * 🔍 高级搜索 - 支持多种筛选条件
     */
    async searchWithFilters(
        filter: LiteratureFilter = {},
        sort: LiteratureSort = { field: 'createdAt', order: 'desc' },
        page: number = 1,
        pageSize: number = 20
    ): Promise<{
        items: ExtendedLibraryItem[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    }> {
        try {
            let query = this.table.toCollection();

            // 🔍 文本搜索
            if (filter.searchTerm) {
                const searchTerm = filter.searchTerm.toLowerCase();
                query = query.filter(item =>
                    item.title.toLowerCase().includes(searchTerm) ||
                    item.authors.some(author => author.toLowerCase().includes(searchTerm)) ||
                    (item.abstract && item.abstract.toLowerCase().includes(searchTerm)) ||
                    (item.publication && item.publication.toLowerCase().includes(searchTerm))
                );
            }

            // 🏷️ 来源筛选
            if (filter.source && filter.source !== 'all') {
                query = query.filter(item => item.source === filter.source);
            }

            // 📅 年份范围筛选
            if (filter.yearRange) {
                query = query.filter(item =>
                    item.year >= filter.yearRange!.start &&
                    item.year <= filter.yearRange!.end
                );
            }

            // 👥 作者筛选
            if (filter.authors && filter.authors.length > 0) {
                query = query.filter(item =>
                    filter.authors!.some(filterAuthor =>
                        item.authors.some(itemAuthor =>
                            itemAuthor.toLowerCase().includes(filterAuthor.toLowerCase())
                        )
                    )
                );
            }

            // 📄 内容筛选
            if (filter.hasAbstract !== undefined) {
                query = query.filter(item =>
                    filter.hasAbstract ? !!item.abstract : !item.abstract
                );
            }

            if (filter.hasPdf !== undefined) {
                query = query.filter(item =>
                    filter.hasPdf ? !!item.pdfPath : !item.pdfPath
                );
            }

            // 📈 排序
            if (sort.field === 'title') {
                query = query.sortBy('title');
            } else if (sort.field === 'year') {
                query = query.sortBy('year');
            } else if (sort.field === 'authors') {
                query = query.sortBy(item => item.authors.join(', '));
            } else {
                query = query.sortBy('createdAt');
            }

            if (sort.order === 'desc') {
                query = query.reverse();
            }

            // 📄 分页
            return await this.paginate(query, page, pageSize);

        } catch (error) {
            console.error('[LiteratureRepository] searchWithFilters failed:', error);
            throw new Error('Failed to search literature with filters');
        }
    }

    /**
     * 🔍 根据DOI查找文献
     */
    async findByDoi(doi: string): Promise<ExtendedLibraryItem | null> {
        try {
            const item = await this.table.where('doi').equals(doi).first();
            return item || null;
        } catch (error) {
            console.error('[LiteratureRepository] findByDoi failed:', error);
            return null;
        }
    }

    /**
     * 🔍 根据URL查找文献
     */
    async findByUrl(url: string): Promise<ExtendedLibraryItem | null> {
        try {
            const item = await this.table.where('url').equals(url).first();
            return item || null;
        } catch (error) {
            console.error('[LiteratureRepository] findByUrl failed:', error);
            return null;
        }
    }

    /**
     * 🔍 根据标题模糊查找
     */
    async findByTitleSimilar(title: string, threshold: number = 0.8): Promise<ExtendedLibraryItem[]> {
        try {
            const allItems = await this.table.toArray();
            const titleLower = title.toLowerCase();

            return allItems.filter(item => {
                const similarity = this.calculateStringSimilarity(
                    titleLower,
                    item.title.toLowerCase()
                );
                return similarity >= threshold;
            });
        } catch (error) {
            console.error('[LiteratureRepository] findByTitleSimilar failed:', error);
            return [];
        }
    }

    /**
     * 🔄 智能创建或更新 - 核心业务逻辑
     */
    async createOrUpdate(input: CreateLibraryItemInput): Promise<{
        id: string;
        isNew: boolean;
        mergedFields?: string[];
    }> {
        try {
            // 🔍 Step 1: 智能查重
            let existingItem: ExtendedLibraryItem | null = null;

            // 优先级1: DOI精确匹配
            if (input.doi) {
                existingItem = await this.findByDoi(input.doi);
            }

            // 优先级2: URL精确匹配
            if (!existingItem && input.url) {
                existingItem = await this.findByUrl(input.url);
            }

            // 优先级3: 标题相似性匹配
            if (!existingItem) {
                const similarItems = await this.findByTitleSimilar(input.title, 0.85);
                if (similarItems.length > 0) {
                    // 进一步验证作者和年份
                    existingItem = similarItems.find(item =>
                        Math.abs(item.year - input.year) <= 1 &&
                        this.hasCommonAuthors(item.authors, input.authors)
                    ) || null;
                }
            }

            if (existingItem) {
                // 🔄 Step 2: 智能合并更新
                const mergedData = this.mergeLibraryData(existingItem, input);
                await this.update(existingItem.id, mergedData.updates);

                return {
                    id: existingItem.id,
                    isNew: false,
                    mergedFields: mergedData.mergedFields
                };
            } else {
                // ➕ Step 3: 创建新文献
                const now = DatabaseUtils.now();
                const newItem: ExtendedLibraryItem = {
                    id: this.generateId(),
                    ...input,
                    createdAt: now,
                    updatedAt: now
                };

                // 验证数据
                const validatedItem = ExtendedLibraryItemSchema.parse(newItem);
                await this.table.add(validatedItem);

                return {
                    id: newItem.id,
                    isNew: true
                };
            }
        } catch (error) {
            console.error('[LiteratureRepository] createOrUpdate failed:', error);
            throw new Error('Failed to create or update literature item');
        }
    }

    /**
     * 🤝 智能合并文献数据
     */
    private mergeLibraryData(
        existing: ExtendedLibraryItem,
        newData: CreateLibraryItemInput
    ): {
        updates: UpdateLibraryItemInput;
        mergedFields: string[];
    } {
        const updates: UpdateLibraryItemInput = {};
        const mergedFields: string[] = [];

        // 🔗 DOI和URL：新数据优先
        if (newData.doi && newData.doi !== existing.doi) {
            updates.doi = newData.doi;
            mergedFields.push('doi');
        }
        if (newData.url && newData.url !== existing.url) {
            updates.url = newData.url;
            mergedFields.push('url');
        }

        // 📝 标题：选择更完整的
        if (newData.title.length > existing.title.length &&
            !newData.title.startsWith('Processing:')) {
            updates.title = newData.title;
            mergedFields.push('title');
        }

        // 👥 作者：合并去重
        const combinedAuthors = [
            ...existing.authors,
            ...newData.authors.filter(author =>
                author !== 'Unknown Author' &&
                !existing.authors.includes(author)
            )
        ];
        if (combinedAuthors.length > existing.authors.length) {
            updates.authors = combinedAuthors;
            mergedFields.push('authors');
        }

        // 📚 其他字段：选择更完整的
        if (newData.publication && (!existing.publication ||
            newData.publication.length > existing.publication.length)) {
            updates.publication = newData.publication;
            mergedFields.push('publication');
        }

        if (newData.abstract && (!existing.abstract ||
            newData.abstract.length > existing.abstract.length)) {
            updates.abstract = newData.abstract;
            mergedFields.push('abstract');
        }

        return { updates, mergedFields };
    }

    /**
     * 📊 获取统计信息
     */
    async getStatistics(): Promise<{
        total: number;
        bySource: Record<string, number>;
        byYear: Record<number, number>;
        recentlyAdded: number; // 最近7天
    }> {
        try {
            const allItems = await this.table.toArray();
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const stats = {
                total: allItems.length,
                bySource: {} as Record<string, number>,
                byYear: {} as Record<number, number>,
                recentlyAdded: 0
            };

            allItems.forEach(item => {
                // 按来源统计
                const source = item.source || 'unknown';
                stats.bySource[source] = (stats.bySource[source] || 0) + 1;

                // 按年份统计
                stats.byYear[item.year] = (stats.byYear[item.year] || 0) + 1;

                // 最近添加统计
                if (item.createdAt >= sevenDaysAgo) {
                    stats.recentlyAdded++;
                }
            });

            return stats;
        } catch (error) {
            console.error('[LiteratureRepository] getStatistics failed:', error);
            throw new Error('Failed to get statistics');
        }
    }

    /**
     * 🧹 清理重复文献
     */
    async cleanupDuplicates(): Promise<{
        duplicatesFound: number;
        duplicatesRemoved: number;
    }> {
        try {
            const allItems = await this.table.toArray();
            const duplicatesFound = new Set<string>();
            const toRemove: string[] = [];

            // 检测重复项
            for (let i = 0; i < allItems.length; i++) {
                for (let j = i + 1; j < allItems.length; j++) {
                    const item1 = allItems[i];
                    const item2 = allItems[j];

                    if (this.isDuplicate(item1, item2)) {
                        duplicatesFound.add(item1.id);
                        duplicatesFound.add(item2.id);

                        // 保留更完整的那个，删除另一个
                        const toKeep = this.selectBetterItem(item1, item2);
                        const toDelete = toKeep.id === item1.id ? item2 : item1;

                        if (!toRemove.includes(toDelete.id)) {
                            toRemove.push(toDelete.id);
                        }
                    }
                }
            }

            // 删除重复项
            await this.bulkDelete(toRemove);

            return {
                duplicatesFound: duplicatesFound.size,
                duplicatesRemoved: toRemove.length
            };
        } catch (error) {
            console.error('[LiteratureRepository] cleanupDuplicates failed:', error);
            throw new Error('Failed to cleanup duplicates');
        }
    }

    // ==================== 辅助方法 ====================

    /**
     * 🔤 计算字符串相似度 (简化版编辑距离)
     */
    private calculateStringSimilarity(str1: string, str2: string): number {
        const maxLength = Math.max(str1.length, str2.length);
        if (maxLength === 0) return 1;

        const distance = this.levenshteinDistance(str1, str2);
        return 1 - distance / maxLength;
    }

    /**
     * 📏 计算编辑距离
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
     * 👥 检查是否有共同作者
     */
    private hasCommonAuthors(authors1: string[], authors2: string[]): boolean {
        return authors1.some(author1 =>
            authors2.some(author2 =>
                author1.toLowerCase().includes(author2.toLowerCase()) ||
                author2.toLowerCase().includes(author1.toLowerCase())
            )
        );
    }

    /**
     * 🔍 判断是否为重复文献
     */
    private isDuplicate(item1: ExtendedLibraryItem, item2: ExtendedLibraryItem): boolean {
        // DOI相同
        if (item1.doi && item2.doi && item1.doi === item2.doi) return true;

        // URL相同
        if (item1.url && item2.url && item1.url === item2.url) return true;

        // 标题高度相似 + 年份相近 + 有共同作者
        const titleSimilarity = this.calculateStringSimilarity(
            item1.title.toLowerCase(),
            item2.title.toLowerCase()
        );

        return titleSimilarity > 0.9 &&
            Math.abs(item1.year - item2.year) <= 1 &&
            this.hasCommonAuthors(item1.authors, item2.authors);
    }

    /**
     * 🏆 选择更好的文献项（用于去重时保留）
     */
    private selectBetterItem(item1: ExtendedLibraryItem, item2: ExtendedLibraryItem): ExtendedLibraryItem {
        let score1 = 0;
        let score2 = 0;

        // 标题完整性
        score1 += item1.title.length;
        score2 += item2.title.length;

        // 作者数量
        score1 += item1.authors.length * 10;
        score2 += item2.authors.length * 10;

        // 摘要存在
        if (item1.abstract) score1 += 50;
        if (item2.abstract) score2 += 50;

        // DOI存在
        if (item1.doi) score1 += 30;
        if (item2.doi) score2 += 30;

        // PDF存在
        if (item1.pdfPath) score1 += 20;
        if (item2.pdfPath) score2 += 20;

        return score1 >= score2 ? item1 : item2;
    }
}

// 🏪 单例导出
export const literatureRepository = new LiteratureRepository();
