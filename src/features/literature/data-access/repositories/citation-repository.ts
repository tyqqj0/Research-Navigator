/**
 * 🔗 Citation Repository - 引文关系仓储
 * 
 * 简化版本：专注于基础CRUD操作和度数统计
 * 设计原则：轻量、高效、职责单一
 */

import { literatureDB, DatabaseUtils } from '../database';
import {
    Citation,
    CitationDegree,
    CitationOverview,
    CreateCitationInput,
    UpdateCitationInput,
    CitationQuery,
    CitationSearchResult,
    CitationSchema
} from '../models';
import type { Table } from 'dexie';

/**
 * 🔗 简化的引文关系仓储实现
 */
export class CitationRepository {
    protected table: Table<Citation, any>; // 复合主键，使用any以兼容Dexie复合键

    constructor() {
        this.table = literatureDB.citations as any; // 临时类型断言，等待数据库更新
    }

    // ==================== 基础CRUD操作 ====================

    /**
     * ➕ 创建引文关系（避免重复）
     * 返回复合主键的字符串形式：`${sourceItemId}-${targetItemId}`，如果已存在返回 null
     */
    async createCitation(input: CreateCitationInput): Promise<string | null> {
        try {
            // 检查是否已存在
            const exists = await this.citationExists(input.sourceItemId, input.targetItemId);
            if (exists) {
                console.log('[CitationRepository] Citation already exists, skipping');
                return null;
            }

            // 验证数据并创建
            const citation = CitationSchema.parse({
                ...input,
                createdAt: DatabaseUtils.now()
            });

            await this.table.add(citation);
            return `${input.sourceItemId}-${input.targetItemId}`;
        } catch (error) {
            console.error('[CitationRepository] createCitation failed:', error);
            throw new Error('Failed to create citation');
        }
    }

    /**
     * 🔍 检查两个文献之间是否存在引文关系
     */
    async citationExists(sourceItemId: string, targetItemId: string): Promise<boolean> {
        try {
            const citation = await this.table
                .where(['sourceItemId', 'targetItemId'])
                .equals([sourceItemId, targetItemId])
                .first();
            return !!citation;
        } catch (error) {
            console.error('[CitationRepository] citationExists failed:', error);
            return false;
        }
    }

    /**
     * 🗑️ 删除特定引文关系
     */
    async deleteCitation(sourceItemId: string, targetItemId: string): Promise<boolean> {
        try {
            const deleted = await this.table
                .where(['sourceItemId', 'targetItemId'])
                .equals([sourceItemId, targetItemId])
                .delete();
            return deleted > 0;
        } catch (error) {
            console.error('[CitationRepository] deleteCitation failed:', error);
            throw new Error('Failed to delete citation');
        }
    }

    /**
     * 📝 更新引文上下文
     */
    async updateCitationContext(
        sourceItemId: string,
        targetItemId: string,
        context?: string
    ): Promise<boolean> {
        try {
            const updated = await this.table
                .where(['sourceItemId', 'targetItemId'])
                .equals([sourceItemId, targetItemId])
                .modify({ context });
            return updated > 0;
        } catch (error) {
            console.error('[CitationRepository] updateCitationContext failed:', error);
            throw new Error('Failed to update citation context');
        }
    }

    // ==================== 通用辅助方法（兼容Service调用） ====================

    /**
     * 🔎 根据复合主键查找
     * 支持传入 `${source}-${target}` 字符串或 [source, target] 元组
     */
    async findById(key: any): Promise<Citation | null> {
        try {
            const [sourceItemId, targetItemId] = Array.isArray(key)
                ? key
                : (key.includes('-') ? (key.split('-') as [string, string]) : [undefined as any, undefined as any]);

            if (!sourceItemId || !targetItemId) return null;

            const citation = await this.table
                .where(['sourceItemId', 'targetItemId'])
                .equals([sourceItemId, targetItemId])
                .first();
            return citation || null;
        } catch (error) {
            console.error('[CitationRepository] findById failed:', error);
            return null;
        }
    }

    /**
     * ✏️ 更新引文（仅允许更新 context 字段）
     */
    async update(key: any, updates: Partial<Citation> & Record<string, unknown>): Promise<boolean> {
        try {
            const [sourceItemId, targetItemId] = Array.isArray(key)
                ? key
                : (key.includes('-') ? (key.split('-') as [string, string]) : [undefined as any, undefined as any]);

            if (!sourceItemId || !targetItemId) return false;

            const allowedUpdates: Partial<Citation> = {};
            if (Object.prototype.hasOwnProperty.call(updates, 'context')) {
                allowedUpdates.context = updates.context as any;
            }

            const modified = await this.table
                .where(['sourceItemId', 'targetItemId'])
                .equals([sourceItemId, targetItemId])
                .modify(allowedUpdates as any);
            return modified > 0;
        } catch (error) {
            console.error('[CitationRepository] update failed:', error);
            throw new Error('Failed to update citation');
        }
    }

    /**
     * 📋 获取全部引文
     */
    async findAll(): Promise<Citation[]> {
        try {
            return await this.table.toArray();
        } catch (error) {
            console.error('[CitationRepository] findAll failed:', error);
            return [];
        }
    }

    // ==================== 引文查询操作 ====================

    /**
     * 🔍 获取某个文献的出度引文（它引用的文献）
     */
    async findOutgoingCitations(sourceItemId: string): Promise<Citation[]> {
        try {
            return await this.table.where('sourceItemId').equals(sourceItemId).toArray();
        } catch (error) {
            console.error('[CitationRepository] findOutgoingCitations failed:', error);
            return [];
        }
    }

    /**
     * 🔍 获取某个文献的入度引文（引用它的文献）
     */
    async findIncomingCitations(targetItemId: string): Promise<Citation[]> {
        try {
            return await this.table.where('targetItemId').equals(targetItemId).toArray();
        } catch (error) {
            console.error('[CitationRepository] findIncomingCitations failed:', error);
            return [];
        }
    }

    /**
     * 🔍 获取文献的所有引文关系
     */
    async findAllCitationsByPaperId(paperId: string): Promise<{
        outgoing: Citation[]; // 它引用的文献
        incoming: Citation[]; // 引用它的文献
    }> {
        try {
            const [outgoing, incoming] = await Promise.all([
                this.findOutgoingCitations(paperId),
                this.findIncomingCitations(paperId)
            ]);

            return { outgoing, incoming };
        } catch (error) {
            console.error('[CitationRepository] findAllCitationsByPaperId failed:', error);
            return { outgoing: [], incoming: [] };
        }
    }

    /**
     * 🔁 获取双向引文（兼容旧调用）
     */
    async getBidirectionalCitations(paperId: string): Promise<{
        outgoing: Citation[];
        incoming: Citation[];
    }> {
        return this.findAllCitationsByPaperId(paperId);
    }

    /**
     * 🔎 获取一组文献ID内部的引文边（仅返回两端都在集合内的边）
     */
    async getEdgesWithinPaperIds(
        paperIds: string[],
        direction: 'out' | 'in' | 'both' = 'both'
    ): Promise<Citation[]> {
        try {
            if (!paperIds || paperIds.length === 0) return [];
            const idSet = new Set(paperIds);

            // 仅需查询集合内源点的出边，再在内存中过滤目标是否在集合内
            const outgoing = await this.table.where('sourceItemId').anyOf(paperIds).toArray();
            const internal = outgoing.filter(c => idSet.has(c.targetItemId));

            // direction 参数兼容占位：内部边对称，保持同一返回
            return internal;
        } catch (error) {
            console.error('[CitationRepository] getEdgesWithinPaperIds failed:', error);
            return [];
        }
    }

    // ==================== 度数统计操作 ====================

    /**
     * 📊 计算某个文献的度数统计
     */
    async calculateDegreeForPaperId(paperId: string): Promise<CitationDegree> {
        try {
            const [outgoingCount, incomingCount] = await Promise.all([
                this.table.where('sourceItemId').equals(paperId).count(),
                this.table.where('targetItemId').equals(paperId).count()
            ]);

            return {
                paperId,
                inDegree: incomingCount,
                outDegree: outgoingCount,
                totalDegree: incomingCount + outgoingCount,
                lastCalculated: DatabaseUtils.now()
            };
        } catch (error) {
            console.error('[CitationRepository] calculateDegreeForPaperId failed:', error);
            return {
                paperId,
                inDegree: 0,
                outDegree: 0,
                totalDegree: 0,
                lastCalculated: DatabaseUtils.now()
            };
        }
    }

    /**
     * 📊 批量计算多个文献的度数统计
     */
    async calculateDegreesForPaperIds(paperIds: string[]): Promise<CitationDegree[]> {
        try {
            const results = await Promise.all(
                paperIds.map(paperId => this.calculateDegreeForPaperId(paperId))
            );
            return results;
        } catch (error) {
            console.error('[CitationRepository] calculateDegreesForPaperIds failed:', error);
            return paperIds.map(paperId => ({
                paperId,
                inDegree: 0,
                outDegree: 0,
                totalDegree: 0,
                lastCalculated: DatabaseUtils.now()
            }));
        }
    }

    // ==================== 搜索和查询操作 ====================

    /**
     * 🔍 搜索引文关系
     */
    async searchCitations(query: CitationQuery = {}): Promise<CitationSearchResult> {
        try {
            let collection = this.table.toCollection();

            // 按源文献筛选
            if (query.sourceItemId) {
                collection = this.table.where('sourceItemId').equals(query.sourceItemId);
            }
            // 按目标文献筛选
            else if (query.targetItemId) {
                collection = this.table.where('targetItemId').equals(query.targetItemId);
            }

            // 按是否有上下文筛选
            if (query.hasContext !== undefined) {
                collection = collection.filter(citation =>
                    query.hasContext ? !!citation.context : !citation.context
                );
            }

            // 按时间范围筛选
            if (query.dateRange) {
                collection = collection.filter(citation =>
                    citation.createdAt >= query.dateRange!.start &&
                    citation.createdAt <= query.dateRange!.end
                );
            }

            const citations = await collection.toArray();

            return {
                citations,
                total: citations.length,
                hasMore: false // 简化实现，不分页
            };
        } catch (error) {
            console.error('[CitationRepository] searchCitations failed:', error);
            return { citations: [], total: 0, hasMore: false };
        }
    }

    /**
     * 📊 获取引文关系概览统计
     */
    async getOverviewStatistics(): Promise<CitationOverview> {
        try {
            const allCitations = await this.table.toArray();
            const uniqueSourceItems = new Set(allCitations.map(c => c.sourceItemId));
            const uniqueTargetItems = new Set(allCitations.map(c => c.targetItemId));

            return {
                totalCitations: allCitations.length,
                uniqueSourceItems: uniqueSourceItems.size,
                uniqueTargetItems: uniqueTargetItems.size,
                averageOutDegree: uniqueSourceItems.size > 0 ?
                    allCitations.length / uniqueSourceItems.size : 0,
                averageInDegree: uniqueTargetItems.size > 0 ?
                    allCitations.length / uniqueTargetItems.size : 0,
                lastUpdated: DatabaseUtils.now()
            };
        } catch (error) {
            console.error('[CitationRepository] getOverviewStatistics failed:', error);
            return {
                totalCitations: 0,
                uniqueSourceItems: 0,
                uniqueTargetItems: 0,
                averageOutDegree: 0,
                averageInDegree: 0,
                lastUpdated: DatabaseUtils.now()
            };
        }
    }

    // ==================== 批量操作 ====================

    /**
     * 📦 批量创建引文关系
     */
    async bulkCreateCitations(inputs: CreateCitationInput[]): Promise<{
        created: number;
        skipped: number;
        errors: number;
    }> {
        try {
            const results = { created: 0, skipped: 0, errors: 0 };

            for (const input of inputs) {
                try {
                    const created = await this.createCitation(input);
                    if (created) {
                        results.created++;
                    } else {
                        results.skipped++;
                    }
                } catch (error) {
                    console.error('[CitationRepository] Bulk create item failed:', error);
                    results.errors++;
                }
            }

            return results;
        } catch (error) {
            console.error('[CitationRepository] bulkCreateCitations failed:', error);
            throw new Error('Failed to bulk create citations');
        }
    }

    // ==================== 清理和维护操作 ====================

    /**
     * 🧹 清理孤儿引文（引用了不存在的文献）
     */
    async cleanupOrphanedCitations(validLiteratureIds: string[]): Promise<number> {
        try {
            const validIdsSet = new Set(validLiteratureIds);
            const allCitations = await this.table.toArray();

            const orphanedCitations = allCitations.filter(citation =>
                !validIdsSet.has(citation.sourceItemId) ||
                !validIdsSet.has(citation.targetItemId)
            );

            if (orphanedCitations.length > 0) {
                // 删除孤儿引文（复合主键删除）
                await Promise.all(
                    orphanedCitations.map(citation =>
                        this.table
                            .where(['sourceItemId', 'targetItemId'])
                            .equals([citation.sourceItemId, citation.targetItemId])
                            .delete()
                    )
                );
                console.log(`[CitationRepository] Cleaned up ${orphanedCitations.length} orphaned citations`);
            }

            return orphanedCitations.length;
        } catch (error) {
            console.error('[CitationRepository] cleanupOrphanedCitations failed:', error);
            throw new Error('Failed to cleanup orphaned citations');
        }
    }

    /**
     * 🗑️ 删除某个文献的所有引文关系
     */
    async deleteAllCitationsByPaperId(paperId: string): Promise<number> {
        try {
            const [outgoingDeleted, incomingDeleted] = await Promise.all([
                this.table.where('sourceItemId').equals(paperId).delete(),
                this.table.where('targetItemId').equals(paperId).delete()
            ]);

            const totalDeleted = outgoingDeleted + incomingDeleted;
            console.log(`[CitationRepository] Deleted ${totalDeleted} citations for paperId: ${paperId}`);
            return totalDeleted;
        } catch (error) {
            console.error('[CitationRepository] deleteAllCitationsByPaperId failed:', error);
            throw new Error('Failed to delete citations for paperId');
        }
    }

    /**
     * 🗑️ 仅删除某个文献的出边（保留入边以支持悬挂）
     */
    async deleteOutgoingCitationsByPaperId(paperId: string): Promise<number> {
        try {
            const deleted = await this.table.where('sourceItemId').equals(paperId).delete();
            console.log(`[CitationRepository] Deleted ${deleted} outgoing citations for paperId: ${paperId}`);
            return deleted;
        } catch (error) {
            console.error('[CitationRepository] deleteOutgoingCitationsByPaperId failed:', error);
            throw new Error('Failed to delete outgoing citations for paperId');
        }
    }

    // ======== 兼容旧方法名（将逐步移除） ========
    async findAllCitationsByLid(paperId: string) { return this.findAllCitationsByPaperId(paperId); }
    async calculateDegreeForLid(paperId: string) { return this.calculateDegreeForPaperId(paperId); }
    async deleteAllCitationsByLid(paperId: string) { return this.deleteAllCitationsByPaperId(paperId); }

}

// 🏪 单例导出
export const citationRepository = new CitationRepository();
