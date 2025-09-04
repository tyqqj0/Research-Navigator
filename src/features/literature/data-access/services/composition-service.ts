/**
 * 🔄 Data Composition Service - 统一数据组合服务
 * 
 * 设计原则:
 * 1. 单一职责 - 专门负责数据组合逻辑
 * 2. 性能优化 - 批量操作，减少数据库查询
 * 3. 类型安全 - 完整的TypeScript支持
 * 4. 空文献支持 - 处理临时/空状态文献
 */

import {
    LibraryItemCore,
    UserLiteratureMetaCore,
    CitationCore,
    CollectionCore,
    EnhancedLiteratureItem,
    ErrorHandler,
} from '../models';
import { LiteratureRepository } from '../repositories/literature-repository';
import { UserMetaRepository } from '../repositories/user-meta-repository';
import { CitationRepository } from '../repositories/citation-repository';

/**
 * 🎯 组合选项接口
 */
export interface CompositionOptions {
    includeUserMeta?: boolean;
    includeCitationStats?: boolean;
    includeRelatedItems?: boolean;
    userId?: string;
    batchSize?: number;
}

/**
 * 📊 引文统计接口
 */
export interface CitationStats {
    totalCitations: number;
    incomingCitations: number;
    outgoingCitations: number;
    recentCitations: number; // 最近30天的引文数
}

/**
 * 🔄 数据组合服务
 */
export class CompositionService {
    constructor(
        private literatureRepo: LiteratureRepository,
        private userMetaRepo: UserMetaRepository,
        private citationRepo: CitationRepository
    ) { }

    // ==================== 核心组合方法 ====================

    /**
     * 🎯 组合单个文献数据
     */
    async composeSingle(
        literatureId: string,
        options: CompositionOptions = {}
    ): Promise<EnhancedLiteratureItem | null> {
        try {
            // 1. 获取核心文献数据
            const literature = await this.literatureRepo.findById(literatureId);
            if (!literature) {
                return null;
            }

            return await this.enhanceLiterature(literature, options);
        } catch (error) {
            ErrorHandler.handle(error, 'CompositionService.composeSingle');
            return null;
        }
    }

    /**
     * 🎯 批量组合文献数据
     */
    async composeBatch(
        literatureIds: string[],
        options: CompositionOptions = {}
    ): Promise<EnhancedLiteratureItem[]> {
        try {
            // 1. 批量获取核心文献数据
            const literatures = await this.literatureRepo.findByIds(literatureIds);

            // 2. 批量增强
            return await this.enhanceLiteratureBatch(literatures, options);
        } catch (error) {
            ErrorHandler.handle(error, 'CompositionService.composeBatch');
            return [];
        }
    }

    /**
     * 🎯 组合用户的所有文献
     */
    async composeForUser(
        userId: string,
        options: Omit<CompositionOptions, 'userId'> = {}
    ): Promise<EnhancedLiteratureItem[]> {
        try {
            // 1. 获取用户的所有文献元数据
            const userMetas = await this.userMetaRepo.findByUserId(userId);
            const literatureIds = userMetas.map(meta => meta.lid);

            // 2. 批量获取文献数据
            const literatures = await this.literatureRepo.findByIds(literatureIds);

            // 3. 增强数据
            return await this.enhanceLiteratureBatch(literatures, {
                ...options,
                userId,
                includeUserMeta: true,
            });
        } catch (error) {
            ErrorHandler.handle(error, 'CompositionService.composeForUser');
            return [];
        }
    }

    // ==================== 空文献支持 ====================

    /**
     * ✨ 创建空文献 - 支持临时状态
     */
    async createEmptyLiterature(
        input: {
            title?: string;
            url?: string;
            authors?: string[];
            userId?: string;
        }
    ): Promise<EnhancedLiteratureItem> {
        try {
            // 1. 创建空文献记录
            const emptyLiterature: Partial<LibraryItemCore> = {
                lid: crypto.randomUUID(),
                title: input.title || 'Untitled Literature',
                authors: input.authors || [],
                year: undefined,
                url: input.url || undefined,
                status: 'empty', // 新增状态：空文献
                source: 'manual',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            // 2. 保存到数据库
            const savedLiterature = await this.literatureRepo.create(emptyLiterature as LibraryItemCore);

            // 3. 如果有用户ID，创建默认用户元数据
            let userMeta: UserLiteratureMetaCore | undefined;
            if (input.userId) {
                userMeta = await this.userMetaRepo.create({
                    userId: input.userId,
                    lid: savedLiterature.lid,
                    tags: [],
                    readingStatus: 'unread',
                    associatedSessions: [],
                    associatedProjects: [],
                    customCategories: [],
                    customFields: {},
                    createdAt: new Date(),
                });
            }

            // 4. 返回增强的空文献
            return {
                ...savedLiterature,
                userMeta: userMeta || undefined,
                citationStats: {
                    totalCitations: 0,
                    incomingCitations: 0,
                    outgoingCitations: 0,
                },
                relatedItems: [],
                lastAccessedAt: undefined,
            };
        } catch (error) {
            ErrorHandler.handle(error, 'CompositionService.createEmptyLiterature');
            throw error;
        }
    }

    /**
     * ✨ 填充空文献数据
     */
    async fillEmptyLiterature(
        literatureId: string,
        data: Partial<LibraryItemCore>
    ): Promise<EnhancedLiteratureItem | null> {
        try {
            // 1. 更新文献数据
            const updatedData = {
                ...data,
                status: 'active', // 从空状态变为活跃状态
                updatedAt: new Date(),
            };

            await this.literatureRepo.update(literatureId, updatedData);

            // 2. 重新组合数据
            return await this.composeSingle(literatureId, {
                includeUserMeta: true,
                includeCitationStats: true,
            });
        } catch (error) {
            ErrorHandler.handle(error, 'CompositionService.fillEmptyLiterature');
            return null;
        }
    }

    // ==================== 私有辅助方法 ====================

    /**
     * 🔧 增强单个文献
     */
    private async enhanceLiterature(
        literature: LibraryItemCore,
        options: CompositionOptions
    ): Promise<EnhancedLiteratureItem> {
        const enhanced: EnhancedLiteratureItem = {
            ...literature,
            userMeta: undefined,
            citationStats: {
                totalCitations: 0,
                incomingCitations: 0,
                outgoingCitations: 0,
            },
            relatedItems: [],
            lastAccessedAt: undefined,
        };

        // 添加用户元数据
        if (options.includeUserMeta && options.userId) {
            try {
                enhanced.userMeta = await this.userMetaRepo.findByUserAndLiterature(
                    options.userId,
                    literature.lid
                );
                enhanced.lastAccessedAt = enhanced.userMeta?.lastAccessedAt || literature.updatedAt;
            } catch (error) {
                // 用户元数据获取失败，继续处理
            }
        }

        // 添加引文统计
        if (options.includeCitationStats) {
            try {
                enhanced.citationStats = await this.getCitationStats(literature.lid);
            } catch (error) {
                // 引文统计获取失败，使用默认值
            }
        }

        // 添加相关文献
        if (options.includeRelatedItems) {
            try {
                enhanced.relatedItems = await this.getRelatedItems(literature.lid);
            } catch (error) {
                // 相关文献获取失败，使用默认值
            }
        }

        return enhanced;
    }

    /**
     * 🔧 批量增强文献
     */
    private async enhanceLiteratureBatch(
        literatures: LibraryItemCore[],
        options: CompositionOptions
    ): Promise<EnhancedLiteratureItem[]> {
        const literatureIds = literatures.map(lit => lit.lid);

        // 批量获取用户元数据
        let userMetasMap = new Map<string, UserLiteratureMetaCore>();
        if (options.includeUserMeta && options.userId) {
            try {
                const userMetas = await this.userMetaRepo.findByUserId(options.userId);
                userMetasMap = new Map(userMetas.map(meta => [meta.lid, meta]));
            } catch (error) {
                // 用户元数据获取失败，继续处理
            }
        }

        // 批量获取引文统计
        let citationStatsMap = new Map<string, CitationStats>();
        if (options.includeCitationStats) {
            try {
                citationStatsMap = await this.getCitationStatsBatch(literatureIds);
            } catch (error) {
                // 引文统计获取失败，继续处理
            }
        }

        // 组合数据
        return literatures.map(literature => {
            const userMeta = userMetasMap.get(literature.lid);
            const citationStats = citationStatsMap.get(literature.lid) || {
                totalCitations: 0,
                incomingCitations: 0,
                outgoingCitations: 0,
            };

            return {
                ...literature,
                userMeta,
                citationStats,
                relatedItems: [], // 可以在需要时添加批量获取逻辑
                lastAccessedAt: userMeta?.lastAccessedAt || literature.updatedAt,
            };
        });
    }

    /**
     * 📊 获取引文统计
     */
    private async getCitationStats(literatureId: string): Promise<CitationStats> {
        const [incomingCitations, outgoingCitations] = await Promise.all([
            this.citationRepo.findByTargetId(literatureId),
            this.citationRepo.findBySourceId(literatureId),
        ]);

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentCitations = [...incomingCitations, ...outgoingCitations]
            .filter(citation => citation.createdAt && citation.createdAt > thirtyDaysAgo)
            .length;

        return {
            totalCitations: incomingCitations.length + outgoingCitations.length,
            incomingCitations: incomingCitations.length,
            outgoingCitations: outgoingCitations.length,
            recentCitations,
        };
    }

    /**
     * 📊 批量获取引文统计
     */
    private async getCitationStatsBatch(literatureIds: string[]): Promise<Map<string, CitationStats>> {
        const statsMap = new Map<string, CitationStats>();

        // 这里可以优化为批量查询，目前简化实现
        for (const id of literatureIds) {
            try {
                const stats = await this.getCitationStats(id);
                statsMap.set(id, stats);
            } catch (error) {
                // 单个统计获取失败，设置默认值
                statsMap.set(id, {
                    totalCitations: 0,
                    incomingCitations: 0,
                    outgoingCitations: 0,
                    recentCitations: 0,
                });
            }
        }

        return statsMap;
    }

    /**
     * 🔗 获取相关文献
     */
    private async getRelatedItems(literatureId: string): Promise<string[]> {
        try {
            // 获取引用和被引用的文献
            const [incomingCitations, outgoingCitations] = await Promise.all([
                this.citationRepo.findByTargetId(literatureId),
                this.citationRepo.findBySourceId(literatureId),
            ]);

            const relatedIds = new Set<string>();

            incomingCitations.forEach(citation => relatedIds.add(citation.sourceItemId));
            outgoingCitations.forEach(citation => relatedIds.add(citation.targetItemId));

            return Array.from(relatedIds).slice(0, 10); // 限制数量
        } catch (error) {
            return [];
        }
    }
}

// 导出单例实例
export const compositionService = new CompositionService(
    new LiteratureRepository(),
    new UserMetaRepository(),
    new CitationRepository()
);
