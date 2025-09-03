/**
 * 📚 Literature Domain Repositories - 仓储层统一导出
 * 
 * 设计模式: Repository Pattern
 * 架构原则: 数据访问层抽象，业务逻辑与数据存储分离
 */

// 🏗️ 基础仓储抽象
export { BaseRepository, type IBaseRepository, QueryBuilder } from './base-repository';

// 📚 文献仓储 (原版 + 增强版)
export { LiteratureRepository, literatureRepository } from './literature-repository';
export {
    EnhancedLiteratureRepository,
    enhancedLiteratureRepository,
    type LiteratureOperationResult,
    type BulkLiteratureResult,
    type SimilarityResult,
    type LiteratureStatistics
} from './enhanced-literature-repository';

// 👤 用户元数据仓储
export { UserMetaRepository, userMetaRepository } from './user-meta-repository';

// 🔗 引文关系仓储
export { CitationRepository, citationRepository } from './citation-repository';

// 📂 文献集合仓储
export { CollectionRepository, collectionRepository } from './collection-repository';

// 🎯 仓储聚合类 - 提供统一的数据访问接口
export class LiteratureDomainRepositories {
    constructor(
        public readonly literature = literatureRepository,
        public readonly enhancedLiterature = enhancedLiteratureRepository,
        public readonly userMeta = userMetaRepository,
        public readonly citation = citationRepository,
        public readonly collection = collectionRepository
    ) { }

    /**
     * 🔧 获取所有仓储的健康状态
     */
    async getHealthStatus(): Promise<{
        isHealthy: boolean;
        repositories: {
            literature: boolean;
            userMeta: boolean;
            citation: boolean;
            collection: boolean;
        };
        totalRecords: {
            literature: number;
            userMeta: number;
            citation: number;
            collection: number;
        };
    }> {
        try {
            const [literatureCount, userMetaCount, citationCount, collectionCount] = await Promise.all([
                this.literature.count(),
                this.userMeta.count(),
                this.citation.count(),
                this.collection.count()
            ]);

            const status = {
                isHealthy: true,
                repositories: {
                    literature: true,
                    userMeta: true,
                    citation: true,
                    collection: true
                },
                totalRecords: {
                    literature: literatureCount,
                    userMeta: userMetaCount,
                    citation: citationCount,
                    collection: collectionCount
                }
            };

            return status;
        } catch (error) {
            console.error('[LiteratureDomainRepositories] Health check failed:', error);
            return {
                isHealthy: false,
                repositories: {
                    literature: false,
                    userMeta: false,
                    citation: false,
                    collection: false
                },
                totalRecords: {
                    literature: 0,
                    userMeta: 0,
                    citation: 0,
                    collection: 0
                }
            };
        }
    }

    /**
     * 🧹 执行域级维护操作
     */
    async performMaintenance(): Promise<{
        orphanedUserMetas: number;
        orphanedCitations: number;
        expiredCollections: number;
        duplicateLiterature: number;
    }> {
        try {
            console.log('[LiteratureDomainRepositories] Starting domain maintenance...');

            // 获取有效的文献ID列表
            const validLiteratureIds = (await this.literature.findAll()).map(item => item.id);

            // 并行执行清理操作
            const [
                orphanedUserMetas,
                orphanedCitations,
                expiredCollections,
                duplicateResult
            ] = await Promise.all([
                this.userMeta.cleanupOrphanedMetas(validLiteratureIds),
                this.citation.cleanupOrphanedCitations(validLiteratureIds),
                this.collection.cleanupExpiredCollections(),
                this.literature.cleanupDuplicates()
            ]);

            const result = {
                orphanedUserMetas,
                orphanedCitations,
                expiredCollections,
                duplicateLiterature: duplicateResult.duplicatesRemoved
            };

            console.log('[LiteratureDomainRepositories] Maintenance completed:', result);
            return result;
        } catch (error) {
            console.error('[LiteratureDomainRepositories] Maintenance failed:', error);
            throw new Error('Failed to perform domain maintenance');
        }
    }

    /**
     * 📊 获取域级统计信息
     */
    async getDomainStatistics(): Promise<{
        literature: any;
        citations: any;
        userCollections: (userId: string) => Promise<any>;
        lastUpdated: Date;
    }> {
        try {
            const [literatureStats, citationStats] = await Promise.all([
                this.literature.getStatistics(),
                this.citation.getStatistics()
            ]);

            return {
                literature: literatureStats,
                citations: citationStats,
                userCollections: (userId: string) => this.collection.getUserCollectionStats(userId),
                lastUpdated: new Date()
            };
        } catch (error) {
            console.error('[LiteratureDomainRepositories] Get domain statistics failed:', error);
            throw new Error('Failed to get domain statistics');
        }
    }
}

// 🏪 域仓储单例实例
export const literatureDomainRepositories = new LiteratureDomainRepositories();
