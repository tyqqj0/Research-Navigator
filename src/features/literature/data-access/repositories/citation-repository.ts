/**
 * 🔗 Citation Repository - 引文关系仓储
 * 
 * 迁移自: old/src/libs/db/matching/CitationLinker.ts
 * 优化: Repository Pattern + 图谱分析 + 网络计算
 */

import { BaseRepository } from './base-repository';
import { literatureDB, DatabaseUtils } from '../database';
import {
    Citation,
    CitationNode,
    CitationEdge,
    CitationNetwork,
    CreateCitationInput,
    UpdateCitationInput,
    CitationQuery,
    CitationStats,
    CitationSchema
} from '../models';
import type { Table } from 'dexie';

/**
 * 🔗 引文关系仓储实现
 */
export class CitationRepository {
    protected table: Table<Citation, number>;

    constructor() {
        this.table = literatureDB.citations;
    }

    /**
     * 🔍 根据ID查找引文
     */
    async findById(id: number): Promise<Citation | null> {
        try {
            const citation = await this.table.get(id);
            return citation || null;
        } catch (error) {
            console.error('[CitationRepository] findById failed:', error);
            return null;
        }
    }

    /**
     * 📋 获取所有引文
     */
    async findAll(): Promise<Citation[]> {
        try {
            return await this.table.toArray();
        } catch (error) {
            console.error('[CitationRepository] findAll failed:', error);
            return [];
        }
    }

    /**
     * 📊 统计引文数量
     */
    async count(): Promise<number> {
        try {
            return await this.table.count();
        } catch (error) {
            console.error('[CitationRepository] count failed:', error);
            return 0;
        }
    }

    /**
     * 🗑️ 删除引文
     */
    async delete(id: number): Promise<void> {
        try {
            await this.table.delete(id);
        } catch (error) {
            console.error('[CitationRepository] delete failed:', error);
            throw new Error('Failed to delete citation');
        }
    }

    /**
     * 🗑️ 批量删除引文
     */
    async bulkDelete(ids: number[]): Promise<void> {
        try {
            await this.table.bulkDelete(ids);
        } catch (error) {
            console.error('[CitationRepository] bulkDelete failed:', error);
            throw new Error('Failed to bulk delete citations');
        }
    }

    /**
     * 📝 更新引文
     */
    async update(id: number, updates: UpdateCitationInput): Promise<void> {
        try {
            await this.table.update(id, updates);
        } catch (error) {
            console.error('[CitationRepository] update failed:', error);
            throw new Error('Failed to update citation');
        }
    }

    /**
     * 🔍 根据源文献ID查找引用的文献
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
     * 🔍 根据目标文献ID查找引用它的文献
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
     * 🔍 获取文献的双向引文关系
     */
    async getBidirectionalCitations(itemId: string): Promise<{
        outgoing: Citation[];
        incoming: Citation[];
        total: number;
    }> {
        try {
            const [outgoing, incoming] = await Promise.all([
                this.findOutgoingCitations(itemId),
                this.findIncomingCitations(itemId)
            ]);

            return {
                outgoing,
                incoming,
                total: outgoing.length + incoming.length
            };
        } catch (error) {
            console.error('[CitationRepository] getBidirectionalCitations failed:', error);
            return { outgoing: [], incoming: [], total: 0 };
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
     * ➕ 创建引文关系（避免重复）
     */
    async createCitation(input: CreateCitationInput): Promise<number | null> {
        try {
            // 检查是否已存在
            const exists = await this.citationExists(input.sourceItemId, input.targetItemId);
            if (exists) {
                console.log('[CitationRepository] Citation already exists, skipping');
                return null;
            }

            const now = DatabaseUtils.now();
            const citation: Omit<Citation, 'id'> = {
                ...input,
                createdAt: now,
                updatedAt: now
            };

            // 验证数据
            const validatedCitation = CitationSchema.omit({ id: true }).parse(citation);
            const id = await this.table.add(validatedCitation as Citation);

            return typeof id === 'number' ? id : parseInt(id as string);
        } catch (error) {
            console.error('[CitationRepository] createCitation failed:', error);
            throw new Error('Failed to create citation');
        }
    }

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
                    const id = await this.createCitation(input);
                    if (id !== null) {
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

    /**
     * 🔍 高级查询引文
     */
    async searchCitations(query: CitationQuery = {}): Promise<Citation[]> {
        try {
            let collection = this.table.toCollection();

            if (query.sourceItemId) {
                collection = this.table.where('sourceItemId').equals(query.sourceItemId);
            } else if (query.targetItemId) {
                collection = this.table.where('targetItemId').equals(query.targetItemId);
            }

            // 应用其他筛选条件
            if (query.citationType) {
                collection = collection.filter(citation =>
                    citation.citationType === query.citationType
                );
            }

            if (query.discoveryMethod) {
                collection = collection.filter(citation =>
                    citation.discoveryMethod === query.discoveryMethod
                );
            }

            if (query.isVerified !== undefined) {
                collection = collection.filter(citation =>
                    citation.isVerified === query.isVerified
                );
            }

            if (query.confidenceThreshold !== undefined) {
                collection = collection.filter(citation =>
                    (citation.confidence || 0) >= query.confidenceThreshold!
                );
            }

            return await collection.toArray();
        } catch (error) {
            console.error('[CitationRepository] searchCitations failed:', error);
            return [];
        }
    }

    /**
     * 📊 获取引文统计信息
     */
    async getStatistics(): Promise<CitationStats> {
        try {
            const allCitations = await this.table.toArray();

            const stats: CitationStats = {
                totalCitations: allCitations.length,
                citationsByType: {
                    direct: 0,
                    indirect: 0,
                    supportive: 0,
                    contradictory: 0,
                    methodological: 0,
                    background: 0
                },
                citationsByMethod: {
                    manual: 0,
                    automatic: 0,
                    ai_extracted: 0,
                    imported: 0
                },
                averageConfidence: 0,
                verificationRate: 0,
                citationsOverTime: [],
                mostCitedItems: [],
                networkStats: {
                    nodeCount: 0,
                    edgeCount: allCitations.length,
                    averageDegree: 0,
                    density: 0
                }
            };

            // 统计各种分类
            let totalConfidence = 0;
            let confidenceCount = 0;
            let verifiedCount = 0;

            allCitations.forEach(citation => {
                // 按类型统计
                stats.citationsByType[citation.citationType]++;

                // 按发现方式统计
                stats.citationsByMethod[citation.discoveryMethod]++;

                // 置信度统计
                if (citation.confidence !== undefined) {
                    totalConfidence += citation.confidence;
                    confidenceCount++;
                }

                // 验证统计
                if (citation.isVerified) {
                    verifiedCount++;
                }
            });

            // 计算平均值
            stats.averageConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;
            stats.verificationRate = allCitations.length > 0 ? verifiedCount / allCitations.length : 0;

            // 计算引用排行
            const citationCounts = new Map<string, number>();
            allCitations.forEach(citation => {
                citationCounts.set(
                    citation.targetItemId,
                    (citationCounts.get(citation.targetItemId) || 0) + 1
                );
            });

            stats.mostCitedItems = Array.from(citationCounts.entries())
                .map(([itemId, count]) => ({ itemId, citationCount: count }))
                .sort((a, b) => b.citationCount - a.citationCount)
                .slice(0, 10);

            // 计算网络统计
            const uniqueNodes = new Set<string>();
            allCitations.forEach(citation => {
                uniqueNodes.add(citation.sourceItemId);
                uniqueNodes.add(citation.targetItemId);
            });

            stats.networkStats.nodeCount = uniqueNodes.size;
            stats.networkStats.averageDegree = uniqueNodes.size > 0 ?
                (allCitations.length * 2) / uniqueNodes.size : 0;
            stats.networkStats.density = uniqueNodes.size > 1 ?
                allCitations.length / (uniqueNodes.size * (uniqueNodes.size - 1)) : 0;

            return stats;
        } catch (error) {
            console.error('[CitationRepository] getStatistics failed:', error);
            throw new Error('Failed to get citation statistics');
        }
    }

    /**
     * 🕸️ 构建引文网络图谱
     */
    async buildCitationNetwork(
        itemIds?: string[],
        maxDepth: number = 2
    ): Promise<CitationNetwork> {
        try {
            let citations: Citation[];

            if (itemIds && itemIds.length > 0) {
                // 构建指定文献的子网络
                citations = await this.buildSubNetwork(itemIds, maxDepth);
            } else {
                // 构建全网络
                citations = await this.table.toArray();
            }

            const nodes = new Map<string, CitationNode>();
            const edges: CitationEdge[] = [];

            // 统计每个节点的度数
            const inDegree = new Map<string, number>();
            const outDegree = new Map<string, number>();

            citations.forEach(citation => {
                // 统计度数
                inDegree.set(citation.targetItemId, (inDegree.get(citation.targetItemId) || 0) + 1);
                outDegree.set(citation.sourceItemId, (outDegree.get(citation.sourceItemId) || 0) + 1);

                // 创建边
                edges.push({
                    id: `edge_${citation.sourceItemId}_${citation.targetItemId}`,
                    source: citation.sourceItemId,
                    target: citation.targetItemId,
                    weight: 1,
                    citationCount: 1,
                    type: 'citation',
                    width: 1,
                    createdAt: citation.createdAt
                });
            });

            // 获取所有唯一节点
            const allNodeIds = new Set<string>();
            citations.forEach(citation => {
                allNodeIds.add(citation.sourceItemId);
                allNodeIds.add(citation.targetItemId);
            });

            // 这里需要从文献库获取节点信息
            // 为了避免循环依赖，我们暂时创建基础节点
            allNodeIds.forEach(nodeId => {
                const nodeInDegree = inDegree.get(nodeId) || 0;
                const nodeOutDegree = outDegree.get(nodeId) || 0;
                const totalDegree = nodeInDegree + nodeOutDegree;

                nodes.set(nodeId, {
                    id: nodeId,
                    title: 'Literature Item', // 需要从文献库获取
                    authors: [],
                    year: new Date().getFullYear(),
                    type: 'literature',
                    degree: totalDegree,
                    inDegree: nodeInDegree,
                    outDegree: nodeOutDegree,
                    betweenness: 0, // 需要复杂算法计算
                    closeness: 0,   // 需要复杂算法计算
                    size: Math.max(10, Math.min(50, totalDegree * 5)),
                    topics: []
                });
            });

            // 计算网络元数据
            const nodeCount = nodes.size;
            const edgeCount = edges.length;
            const density = nodeCount > 1 ? edgeCount / (nodeCount * (nodeCount - 1)) : 0;
            const averageDegree = nodeCount > 0 ? (edgeCount * 2) / nodeCount : 0;

            return {
                nodes: Array.from(nodes.values()),
                edges,
                metadata: {
                    nodeCount,
                    edgeCount,
                    density,
                    averageDegree,
                    components: 1, // 需要连通性分析
                    diameter: undefined,
                    averagePathLength: undefined,
                    clusteringCoefficient: undefined
                },
                generatedAt: DatabaseUtils.now()
            };
        } catch (error) {
            console.error('[CitationRepository] buildCitationNetwork failed:', error);
            throw new Error('Failed to build citation network');
        }
    }

    /**
     * 🔍 构建子网络（指定文献的引文网络）
     */
    private async buildSubNetwork(startItemIds: string[], maxDepth: number): Promise<Citation[]> {
        const visitedItems = new Set<string>(startItemIds);
        const allCitations: Citation[] = [];

        let currentLevel = new Set(startItemIds);

        for (let depth = 0; depth < maxDepth; depth++) {
            const nextLevel = new Set<string>();

            for (const itemId of currentLevel) {
                // 获取出度引文
                const outgoing = await this.findOutgoingCitations(itemId);
                // 获取入度引文
                const incoming = await this.findIncomingCitations(itemId);

                [...outgoing, ...incoming].forEach(citation => {
                    allCitations.push(citation);

                    // 添加新发现的节点到下一层
                    const newNodeId = citation.sourceItemId === itemId ?
                        citation.targetItemId : citation.sourceItemId;

                    if (!visitedItems.has(newNodeId)) {
                        visitedItems.add(newNodeId);
                        nextLevel.add(newNodeId);
                    }
                });
            }

            currentLevel = nextLevel;
            if (nextLevel.size === 0) break;
        }

        return allCitations;
    }

    /**
     * 🧹 清理孤儿引文
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
                await this.bulkDelete(orphanedCitations.map(citation => citation.id!));
                console.log(`[CitationRepository] Cleaned up ${orphanedCitations.length} orphaned citations`);
            }

            return orphanedCitations.length;
        } catch (error) {
            console.error('[CitationRepository] cleanupOrphanedCitations failed:', error);
            throw new Error('Failed to cleanup orphaned citations');
        }
    }

    /**
     * 🔄 更新引文验证状态
     */
    async updateVerificationStatus(
        citationId: number,
        isVerified: boolean,
        verifiedBy?: string
    ): Promise<void> {
        try {
            const updates: UpdateCitationInput = {
                isVerified,
                verifiedBy,
                verifiedAt: isVerified ? DatabaseUtils.now() : undefined,
                updatedAt: DatabaseUtils.now()
            };

            await this.update(citationId, updates);
        } catch (error) {
            console.error('[CitationRepository] updateVerificationStatus failed:', error);
            throw new Error('Failed to update verification status');
        }
    }
}

// 🏪 单例导出
export const citationRepository = new CitationRepository();
