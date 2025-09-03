/**
 * 📚 Literature Service - 文献业务服务层
 * 
 * 迁移自: old/src/libs/db/LibraryService.ts (1000+行核心功能)
 * 架构: Repository Pattern + Domain Service
 * 职责: 文献的高级业务逻辑和智能操作
 */

import {
    literatureDomainRepositories,
    LiteratureRepository,
    UserMetaRepository,
    CitationRepository,
    CollectionRepository
} from '../repositories';
import {
    LibraryItem,
    UserLiteratureMeta,
    CreateLibraryItemInput,
    UpdateLibraryItemInput,
    LiteratureFilter,
    LiteratureSort,
    EnhancedLiteratureItem,
    LiteratureOperationResult,
    BulkOperationResult,
    LiteratureSearchResult,
    LiteratureStatistics
} from '../types';

/**
 * 📚 Literature Service - 核心文献服务
 * 
 * 设计原则:
 * 1. 聚合多个Repository的操作
 * 2. 实现复杂的业务逻辑
 * 3. 保持与旧版API的兼容性
 * 4. 提供统一的错误处理
 */
export class LiteratureService {
    constructor(
        private readonly literatureRepo: LiteratureRepository = literatureDomainRepositories.literature,
        private readonly userMetaRepo: UserMetaRepository = literatureDomainRepositories.userMeta,
        private readonly citationRepo: CitationRepository = literatureDomainRepositories.citation,
        private readonly collectionRepo: CollectionRepository = literatureDomainRepositories.collection
    ) { }

    // ==================== 核心文献操作 ====================

    /**
     * 🔍 根据ID获取增强版文献信息
     */
    async getLiteratureById(
        literatureId: string,
        userId?: string
    ): Promise<EnhancedLiteratureItem | null> {
        try {
            const literature = await this.literatureRepo.findById(literatureId);
            if (!literature) return null;

            // 获取用户元数据
            let userMeta: UserLiteratureMeta | null = null;
            if (userId) {
                userMeta = await this.userMetaRepo.findByUserAndLiterature(userId, literatureId);
            }

            // 获取引文信息
            const citationInfo = await this.citationRepo.getBidirectionalCitations(literatureId);

            // 组合增强信息
            const enhanced: EnhancedLiteratureItem = {
                ...literature,
                userMeta,
                citationStats: {
                    totalCitations: citationInfo.total,
                    incomingCitations: citationInfo.incoming.length,
                    outgoingCitations: citationInfo.outgoing.length
                },
                relatedItems: [], // 可以后续实现相关文献推荐
                lastAccessedAt: userMeta?.updatedAt || literature.updatedAt
            };

            return enhanced;
        } catch (error) {
            console.error('[LiteratureService] getLiteratureById failed:', error);
            throw new Error('Failed to get literature by ID');
        }
    }

    /**
     * ➕ 智能创建或更新文献 - 核心业务逻辑
     */
    async createOrUpdateLiterature(
        input: CreateLibraryItemInput,
        userId?: string
    ): Promise<LiteratureOperationResult> {
        try {
            // 调用Repository的智能去重逻辑
            const result = await this.literatureRepo.createOrUpdate(input);

            // 如果是新创建且有用户ID，创建默认用户元数据
            if (result.isNew && userId) {
                await this.userMetaRepo.createOrUpdate(userId, result.id, {
                    tags: [],
                    readingStatus: 'unread'
                });
            }

            // 返回操作结果
            const operationResult: LiteratureOperationResult = {
                id: result.id,
                operation: result.isNew ? 'created' : 'updated',
                isNew: result.isNew,
                mergedFields: result.mergedFields || [],
                message: result.isNew ?
                    'Literature created successfully' :
                    `Literature updated (merged ${result.mergedFields?.length || 0} fields)`
            };

            console.log(`[LiteratureService] ${operationResult.operation}: ${result.id}`);
            return operationResult;
        } catch (error) {
            console.error('[LiteratureService] createOrUpdateLiterature failed:', error);
            throw new Error('Failed to create or update literature');
        }
    }

    /**
     * 📦 批量导入文献
     */
    async bulkImportLiterature(
        inputs: CreateLibraryItemInput[],
        userId?: string
    ): Promise<BulkOperationResult> {
        const startTime = Date.now();
        const results: LiteratureOperationResult[] = [];
        let successCount = 0;
        let updateCount = 0;
        let errorCount = 0;

        console.log(`[LiteratureService] Starting bulk import of ${inputs.length} items`);

        try {
            for (const input of inputs) {
                try {
                    const result = await this.createOrUpdateLiterature(input, userId);
                    results.push(result);

                    if (result.isNew) {
                        successCount++;
                    } else {
                        updateCount++;
                    }
                } catch (error) {
                    console.error(`[LiteratureService] Bulk import item failed:`, error);
                    errorCount++;
                    results.push({
                        id: '',
                        operation: 'failed',
                        isNew: false,
                        mergedFields: [],
                        message: `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`
                    });
                }
            }

            const bulkResult: BulkOperationResult = {
                total: inputs.length,
                successful: successCount,
                updated: updateCount,
                failed: errorCount,
                results,
                executionTime: Date.now() - startTime
            };

            console.log(`[LiteratureService] Bulk import completed:`, bulkResult);
            return bulkResult;
        } catch (error) {
            console.error('[LiteratureService] bulkImportLiterature failed:', error);
            throw new Error('Failed to bulk import literature');
        }
    }

    /**
     * 🔍 高级搜索文献
     */
    async searchLiterature(
        filter: LiteratureFilter = {},
        sort: LiteratureSort = { field: 'createdAt', order: 'desc' },
        page: number = 1,
        pageSize: number = 20,
        userId?: string
    ): Promise<LiteratureSearchResult> {
        try {
            // 使用Repository的高级搜索
            const searchResult = await this.literatureRepo.searchWithFilters(
                filter, sort, page, pageSize
            );

            // 如果有用户ID，增强结果包含用户元数据
            let enhancedItems: EnhancedLiteratureItem[] = [];

            if (userId && searchResult.items.length > 0) {
                // 批量获取用户元数据
                const userMetas = await this.userMetaRepo.findByUserId(userId);
                const userMetaMap = new Map(
                    userMetas.map(meta => [meta.literatureId, meta])
                );

                enhancedItems = searchResult.items.map(item => ({
                    ...item,
                    userMeta: userMetaMap.get(item.id) || null,
                    citationStats: {
                        totalCitations: 0,
                        incomingCitations: 0,
                        outgoingCitations: 0
                    },
                    relatedItems: [],
                    lastAccessedAt: userMetaMap.get(item.id)?.updatedAt || item.updatedAt
                }));
            } else {
                enhancedItems = searchResult.items.map(item => ({
                    ...item,
                    userMeta: null,
                    citationStats: {
                        totalCitations: 0,
                        incomingCitations: 0,
                        outgoingCitations: 0
                    },
                    relatedItems: [],
                    lastAccessedAt: item.updatedAt
                }));
            }

            return {
                items: enhancedItems,
                pagination: {
                    total: searchResult.total,
                    page: searchResult.page,
                    pageSize: searchResult.pageSize,
                    totalPages: searchResult.totalPages
                },
                appliedFilters: filter,
                executionTime: 0 // 可以添加性能监控
            };
        } catch (error) {
            console.error('[LiteratureService] searchLiterature failed:', error);
            throw new Error('Failed to search literature');
        }
    }

    // ==================== 用户元数据操作 ====================

    /**
     * 🏷️ 为文献添加标签
     */
    async addTagToLiterature(
        userId: string,
        literatureId: string,
        tag: string
    ): Promise<void> {
        try {
            await this.userMetaRepo.addTag(userId, literatureId, tag);
            console.log(`[LiteratureService] Added tag "${tag}" to literature ${literatureId} for user ${userId}`);
        } catch (error) {
            console.error('[LiteratureService] addTagToLiterature failed:', error);
            throw new Error('Failed to add tag to literature');
        }
    }

    /**
     * 📖 更新阅读状态
     */
    async updateReadingStatus(
        userId: string,
        literatureId: string,
        status: 'unread' | 'reading' | 'completed' | 'referenced' | 'abandoned'
    ): Promise<void> {
        try {
            await this.userMetaRepo.createOrUpdate(userId, literatureId, {
                readingStatus: status
            });
            console.log(`[LiteratureService] Updated reading status to "${status}" for literature ${literatureId}`);
        } catch (error) {
            console.error('[LiteratureService] updateReadingStatus failed:', error);
            throw new Error('Failed to update reading status');
        }
    }

    /**
     * ⭐ 更新文献优先级
     */
    async updatePriority(
        userId: string,
        literatureId: string,
        priority: 'low' | 'medium' | 'high' | 'urgent'
    ): Promise<void> {
        try {
            await this.userMetaRepo.createOrUpdate(userId, literatureId, {
                priority
            });
            console.log(`[LiteratureService] Updated priority to "${priority}" for literature ${literatureId}`);
        } catch (error) {
            console.error('[LiteratureService] updatePriority failed:', error);
            throw new Error('Failed to update priority');
        }
    }

    /**
     * 🔗 关联文献到研究会话
     */
    async associateWithSession(
        userId: string,
        literatureId: string,
        sessionId: string
    ): Promise<void> {
        try {
            await this.userMetaRepo.updateSessionAssociation(
                userId, literatureId, sessionId, 'add'
            );
            console.log(`[LiteratureService] Associated literature ${literatureId} with session ${sessionId}`);
        } catch (error) {
            console.error('[LiteratureService] associateWithSession failed:', error);
            throw new Error('Failed to associate literature with session');
        }
    }

    // ==================== 统计和分析 ====================

    /**
     * 📊 获取文献统计信息
     */
    async getStatistics(): Promise<LiteratureStatistics> {
        try {
            const [literatureStats, citationStats] = await Promise.all([
                this.literatureRepo.getStatistics(),
                this.citationRepo.getStatistics()
            ]);

            return {
                ...literatureStats,
                citations: citationStats,
                generatedAt: new Date()
            };
        } catch (error) {
            console.error('[LiteratureService] getStatistics failed:', error);
            throw new Error('Failed to get statistics');
        }
    }

    /**
     * 👤 获取用户文献统计
     */
    async getUserStatistics(userId: string): Promise<any> {
        try {
            return await this.userMetaRepo.getUserStatistics(userId);
        } catch (error) {
            console.error('[LiteratureService] getUserStatistics failed:', error);
            throw new Error('Failed to get user statistics');
        }
    }

    // ==================== 维护操作 ====================

    /**
     * 🧹 执行智能清理
     */
    async performCleanup(): Promise<{
        duplicatesRemoved: number;
        orphanedDataCleaned: number;
        executionTime: number;
    }> {
        const startTime = Date.now();

        try {
            console.log('[LiteratureService] Starting intelligent cleanup...');

            // 1. 清理重复文献
            const duplicateResult = await this.literatureRepo.cleanupDuplicates();

            // 2. 执行域级维护
            const maintenanceResult = await literatureDomainRepositories.performMaintenance();

            const result = {
                duplicatesRemoved: duplicateResult.duplicatesRemoved,
                orphanedDataCleaned: maintenanceResult.orphanedCitations + maintenanceResult.orphanedUserMetas,
                executionTime: Date.now() - startTime
            };

            console.log('[LiteratureService] Cleanup completed:', result);
            return result;
        } catch (error) {
            console.error('[LiteratureService] performCleanup failed:', error);
            throw new Error('Failed to perform cleanup');
        }
    }

    /**
     * 🔍 查找相似文献
     */
    async findSimilarLiterature(
        literatureId: string,
        limit: number = 10
    ): Promise<EnhancedLiteratureItem[]> {
        try {
            const baseLiterature = await this.literatureRepo.findById(literatureId);
            if (!baseLiterature) {
                throw new Error(`Literature ${literatureId} not found`);
            }

            // 使用标题相似性查找（简化实现）
            const similarItems = await this.literatureRepo.findByTitleSimilar(
                baseLiterature.title, 0.6
            );

            // 过滤掉自身，限制数量
            const filteredItems = similarItems
                .filter(item => item.id !== literatureId)
                .slice(0, limit);

            // 转换为增强版格式
            return filteredItems.map(item => ({
                ...item,
                userMeta: null,
                citationStats: {
                    totalCitations: 0,
                    incomingCitations: 0,
                    outgoingCitations: 0
                },
                relatedItems: [],
                lastAccessedAt: item.updatedAt
            }));
        } catch (error) {
            console.error('[LiteratureService] findSimilarLiterature failed:', error);
            throw new Error('Failed to find similar literature');
        }
    }

    // ==================== 健康检查 ====================

    /**
     * 🔍 服务健康检查
     */
    async healthCheck(): Promise<{
        isHealthy: boolean;
        repositories: any;
        dataConsistency: {
            orphanedUserMetas: number;
            orphanedCitations: number;
        };
        checkTime: Date;
    }> {
        try {
            // 检查所有Repository健康状态
            const repoHealth = await literatureDomainRepositories.getHealthStatus();

            // 检查数据一致性
            const validLiteratureIds = (await this.literatureRepo.findAll()).map(item => item.id);
            const allUserMetas = await this.userMetaRepo.findAll();
            const allCitations = await this.citationRepo.findAll();

            const orphanedUserMetas = allUserMetas.filter(meta =>
                !validLiteratureIds.includes(meta.literatureId)
            ).length;

            const orphanedCitations = allCitations.filter(citation =>
                !validLiteratureIds.includes(citation.sourceItemId) ||
                !validLiteratureIds.includes(citation.targetItemId)
            ).length;

            const isHealthy = repoHealth.isHealthy && orphanedUserMetas === 0 && orphanedCitations === 0;

            return {
                isHealthy,
                repositories: repoHealth,
                dataConsistency: {
                    orphanedUserMetas,
                    orphanedCitations
                },
                checkTime: new Date()
            };
        } catch (error) {
            console.error('[LiteratureService] healthCheck failed:', error);
            return {
                isHealthy: false,
                repositories: null,
                dataConsistency: {
                    orphanedUserMetas: -1,
                    orphanedCitations: -1
                },
                checkTime: new Date()
            };
        }
    }
}

// 🏪 单例服务实例
export const literatureService = new LiteratureService();
