/**
 * 📚 Literature Service - 简化版文献服务
 * 
 * 新架构: 后端为主，前端为辅
 * 核心理念: 前端作为智能缓存层和用户体验层
 * 职责: API调用 + 本地缓存 + 用户交互优化
 */

import { backendApiService, LiteratureInput, BatchProcessResult } from './backend-api-service';
import { literatureDomainRepositories } from '../repositories';
import {
    LibraryItem,
    UserLiteratureMeta,
    EnhancedLiteratureItem,
    LiteratureSearchResult,
    LiteratureOperationResult
} from '../types';

/**
 * 📚 简化版 Literature Service
 * 
 * 设计原则：
 * 1. 复杂逻辑委托给后端
 * 2. 本地数据库作为缓存层
 * 3. 用户操作响应快速
 * 4. 离线支持基本功能
 */
export class SimplifiedLiteratureService {
    constructor(
        private readonly backendApi = backendApiService,
        private readonly localRepo = literatureDomainRepositories.literature,
        private readonly userMetaRepo = literatureDomainRepositories.userMeta
    ) { }

    // ==================== 核心文献操作 ====================

    /**
     * ➕ 添加单个文献 - 简化版
     */
    async addLiterature(
        input: LiteratureInput,
        userId?: string
    ): Promise<LiteratureOperationResult> {
        try {
            console.log('[LiteratureService] Adding literature:', input);

            // 🌐 调用后端API处理
            const result = await this.backendApi.resolveLiterature(input);

            // 💾 同步到本地缓存
            await this.syncToLocalCache([result.literature]);

            // 👤 如果有用户ID，创建用户元数据
            if (userId) {
                await this.userMetaRepo.createOrUpdate(userId, result.lid, {
                    tags: [],
                    readingStatus: 'unread'
                });
            }

            return {
                id: result.lid,
                operation: result.isNew ? 'created' : 'updated',
                isNew: result.isNew,
                mergedFields: [],
                message: result.isNew ? 'Literature added successfully' : 'Literature already exists'
            };
        } catch (error) {
            console.error('[LiteratureService] Add literature failed:', error);
            throw new Error('Failed to add literature');
        }
    }

    /**
     * 📦 批量添加文献 - 后端处理
     */
    async batchAddLiterature(
        inputs: LiteratureInput[],
        userId?: string,
        progressCallback?: (progress: number, current: number, total: number) => void
    ): Promise<{
        totalProcessed: number;
        successfulLids: string[];
        errors: string[];
        executionTime: number;
    }> {
        const startTime = Date.now();

        try {
            console.log(`[LiteratureService] Batch adding ${inputs.length} literature items`);

            // 🌐 启动后端批量处理
            const batchResult = await this.backendApi.batchProcessLiterature(
                inputs,
                (progress) => {
                    if (progressCallback) {
                        progressCallback(progress.progress, progress.processedItems, progress.totalItems);
                    }
                }
            );

            // 📚 获取处理完成的文献详情
            const literature = await this.backendApi.getBatchLiterature(batchResult.lids);

            // 💾 同步到本地缓存
            await this.syncToLocalCache(literature);

            // 👤 为用户创建元数据
            if (userId && batchResult.lids.length > 0) {
                for (const lid of batchResult.lids) {
                    try {
                        await this.userMetaRepo.createOrUpdate(userId, lid, {
                            tags: [],
                            readingStatus: 'unread'
                        });
                    } catch (error) {
                        console.warn(`[LiteratureService] Failed to create user meta for ${lid}:`, error);
                    }
                }
            }

            return {
                totalProcessed: batchResult.totalItems,
                successfulLids: batchResult.lids,
                errors: [], // 后端处理的错误
                executionTime: Date.now() - startTime
            };
        } catch (error) {
            console.error('[LiteratureService] Batch add failed:', error);
            throw new Error('Failed to batch add literature');
        }
    }

    /**
     * 🔍 获取文献详情 - 智能缓存
     */
    async getLiteratureById(
        literatureId: string,
        userId?: string,
        forceRefresh: boolean = false
    ): Promise<EnhancedLiteratureItem | null> {
        try {
            let literature: LibraryItem | null = null;

            if (!forceRefresh) {
                // 📦 先尝试本地缓存
                literature = await this.localRepo.findById(literatureId);
            }

            if (!literature || forceRefresh) {
                // 🌐 从后端获取
                literature = await this.backendApi.getLiterature(literatureId);

                // 💾 更新本地缓存
                await this.syncToLocalCache([literature]);
            }

            // 👤 获取用户元数据
            let userMeta: UserLiteratureMeta | null = null;
            if (userId) {
                userMeta = await this.userMetaRepo.findByUserAndLiterature(userId, literatureId);
            }

            // 🔗 获取引用统计（从后端）
            let citationStats = {
                totalCitations: 0,
                incomingCitations: 0,
                outgoingCitations: 0
            };

            try {
                const citations = await this.backendApi.getLiteratureCitations(literatureId);
                citationStats = {
                    totalCitations: citations.total,
                    incomingCitations: citations.incoming.length,
                    outgoingCitations: citations.outgoing.length
                };
            } catch (error) {
                console.warn('[LiteratureService] Failed to get citation stats:', error);
            }

            // 📊 组合增强信息
            const enhanced: EnhancedLiteratureItem = {
                ...literature,
                userMeta,
                citationStats,
                relatedItems: [], // 可以通过推荐API获取
                lastAccessedAt: userMeta?.updatedAt || literature.updatedAt
            };

            return enhanced;
        } catch (error) {
            console.error('[LiteratureService] Get literature by ID failed:', error);
            return null;
        }
    }

    /**
     * 🔍 搜索文献 - 后端搜索 + 本地缓存
     */
    async searchLiterature(
        query: {
            text?: string;
            authors?: string[];
            yearRange?: { start: number; end: number };
            topics?: string[];
        },
        page: number = 1,
        pageSize: number = 20,
        userId?: string
    ): Promise<LiteratureSearchResult> {
        try {
            console.log('[LiteratureService] Searching literature:', query);

            // 🌐 调用后端搜索
            const searchResult = await this.backendApi.searchLiterature({
                ...query,
                limit: pageSize,
                offset: (page - 1) * pageSize
            });

            // 💾 同步搜索结果到本地缓存
            await this.syncToLocalCache(searchResult.results);

            // 👤 如果有用户ID，增强结果
            let enhancedItems: EnhancedLiteratureItem[] = [];

            if (userId) {
                const userMetas = await this.userMetaRepo.findByUserId(userId);
                const userMetaMap = new Map(
                    userMetas.map(meta => [meta.literatureId, meta])
                );

                enhancedItems = searchResult.results.map(item => ({
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
                enhancedItems = searchResult.results.map(item => ({
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
                    page,
                    pageSize,
                    totalPages: Math.ceil(searchResult.total / pageSize)
                },
                appliedFilters: query,
                executionTime: searchResult.searchTime
            };
        } catch (error) {
            console.error('[LiteratureService] Search literature failed:', error);
            throw new Error('Failed to search literature');
        }
    }

    /**
     * 🎯 获取推荐文献 - 后端AI推荐
     */
    async getRecommendations(
        userId: string,
        context?: {
            currentLiteratureId?: string;
            limit?: number;
        }
    ): Promise<{
        recommendations: EnhancedLiteratureItem[];
        explanations: string[];
        generatedAt: Date;
    }> {
        try {
            console.log('[LiteratureService] Getting recommendations for user:', userId);

            // 🤖 调用后端推荐API
            const recResult = await this.backendApi.getRecommendations(
                userId,
                context?.currentLiteratureId ? [context.currentLiteratureId] : undefined,
                context?.limit || 10
            );

            // 💾 同步推荐文献到本地缓存
            const literature = recResult.recommendations.map(rec => rec.literature);
            await this.syncToLocalCache(literature);

            // 👤 获取用户元数据
            const userMetas = await this.userMetaRepo.findByUserId(userId);
            const userMetaMap = new Map(
                userMetas.map(meta => [meta.literatureId, meta])
            );

            // 📊 增强推荐结果
            const recommendations: EnhancedLiteratureItem[] = recResult.recommendations.map(rec => ({
                ...rec.literature,
                userMeta: userMetaMap.get(rec.literature.id) || null,
                citationStats: {
                    totalCitations: 0,
                    incomingCitations: 0,
                    outgoingCitations: 0
                },
                relatedItems: [],
                lastAccessedAt: userMetaMap.get(rec.literature.id)?.updatedAt || rec.literature.updatedAt
            }));

            const explanations = recResult.recommendations.map(rec =>
                `${rec.literature.title} - ${rec.reason} (Score: ${rec.score.toFixed(2)})`
            );

            return {
                recommendations,
                explanations,
                generatedAt: recResult.generatedAt
            };
        } catch (error) {
            console.error('[LiteratureService] Get recommendations failed:', error);
            throw new Error('Failed to get recommendations');
        }
    }

    // ==================== 用户元数据操作 ====================

    /**
     * 🏷️ 添加标签 - 本地操作
     */
    async addTag(userId: string, literatureId: string, tag: string): Promise<void> {
        try {
            await this.userMetaRepo.addTag(userId, literatureId, tag);
            console.log(`[LiteratureService] Added tag "${tag}" to literature ${literatureId}`);
        } catch (error) {
            console.error('[LiteratureService] Add tag failed:', error);
            throw new Error('Failed to add tag');
        }
    }

    /**
     * 📖 更新阅读状态 - 本地操作
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
            console.log(`[LiteratureService] Updated reading status to "${status}"`);
        } catch (error) {
            console.error('[LiteratureService] Update reading status failed:', error);
            throw new Error('Failed to update reading status');
        }
    }

    // ==================== 缓存管理 ====================

    /**
     * 💾 同步数据到本地缓存
     */
    private async syncToLocalCache(literature: LibraryItem[]): Promise<void> {
        try {
            for (const item of literature) {
                // 检查是否已存在
                const existing = await this.localRepo.findById(item.id);

                if (existing) {
                    // 更新现有记录
                    await this.localRepo.update(item.id, {
                        ...item,
                        updatedAt: new Date()
                    });
                } else {
                    // 创建新记录
                    await this.localRepo.create(item);
                }
            }

            console.log(`[LiteratureService] Synced ${literature.length} items to local cache`);
        } catch (error) {
            console.error('[LiteratureService] Sync to local cache failed:', error);
            // 不抛出错误，因为这只是缓存操作
        }
    }

    /**
     * 🧹 清理本地缓存
     */
    async clearLocalCache(): Promise<void> {
        try {
            console.log('[LiteratureService] Clearing local cache...');

            // 清理本地数据
            const allItems = await this.localRepo.findAll();
            await this.localRepo.bulkDelete(allItems.map(item => item.id));

            // 清理API缓存
            this.backendApi.clearCache();

            console.log('[LiteratureService] Local cache cleared');
        } catch (error) {
            console.error('[LiteratureService] Clear local cache failed:', error);
            throw new Error('Failed to clear local cache');
        }
    }

    /**
     * 🔄 强制从后端刷新数据
     */
    async refreshFromBackend(literatureIds?: string[]): Promise<void> {
        try {
            console.log('[LiteratureService] Refreshing from backend...');

            if (literatureIds && literatureIds.length > 0) {
                // 刷新指定文献
                const literature = await this.backendApi.getBatchLiterature(literatureIds);
                await this.syncToLocalCache(literature);
            } else {
                // 清理缓存，强制下次从后端获取
                this.backendApi.clearCache();
            }

            console.log('[LiteratureService] Refresh completed');
        } catch (error) {
            console.error('[LiteratureService] Refresh from backend failed:', error);
            throw new Error('Failed to refresh from backend');
        }
    }

    // ==================== 统计和监控 ====================

    /**
     * 📊 获取服务统计
     */
    async getServiceStatistics(): Promise<{
        local: {
            totalLiterature: number;
            totalUserMetas: number;
        };
        backend: {
            cacheStats: any;
        };
        lastSync: Date;
    }> {
        try {
            const [localLiterature, localUserMetas] = await Promise.all([
                this.localRepo.findAll(),
                this.userMetaRepo.findAll()
            ]);

            return {
                local: {
                    totalLiterature: localLiterature.length,
                    totalUserMetas: localUserMetas.length
                },
                backend: {
                    cacheStats: this.backendApi.getCacheStats()
                },
                lastSync: new Date() // 可以记录实际的最后同步时间
            };
        } catch (error) {
            console.error('[LiteratureService] Get statistics failed:', error);
            throw new Error('Failed to get service statistics');
        }
    }

    /**
     * 🔍 健康检查
     */
    async healthCheck(): Promise<{
        isHealthy: boolean;
        backend: boolean;
        localCache: boolean;
        cacheSync: boolean;
        recommendations: string[];
    }> {
        const recommendations: string[] = [];

        try {
            // 检查后端连接
            let backendHealthy = false;
            try {
                await this.backendApi.searchLiterature({ text: 'test', limit: 1 });
                backendHealthy = true;
            } catch (error) {
                recommendations.push('Backend API connection failed');
            }

            // 检查本地缓存
            let localCacheHealthy = false;
            try {
                await this.localRepo.count();
                localCacheHealthy = true;
            } catch (error) {
                recommendations.push('Local cache database error');
            }

            // 检查缓存同步状态
            const stats = await this.getServiceStatistics();
            const cacheSync = stats.local.totalLiterature > 0 || stats.backend.cacheStats.totalEntries > 0;

            if (!cacheSync) {
                recommendations.push('No cached data - consider importing initial dataset');
            }

            const isHealthy = backendHealthy && localCacheHealthy;

            return {
                isHealthy,
                backend: backendHealthy,
                localCache: localCacheHealthy,
                cacheSync,
                recommendations
            };
        } catch (error) {
            console.error('[LiteratureService] Health check failed:', error);
            return {
                isHealthy: false,
                backend: false,
                localCache: false,
                cacheSync: false,
                recommendations: ['Health check system failure', ...recommendations]
            };
        }
    }
}

// 🏪 单例服务实例
export const simplifiedLiteratureService = new SimplifiedLiteratureService();

