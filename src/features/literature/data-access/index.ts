/**
 * 📚 Literature Domain - Data Access Layer 统一导出
 * 
 * 架构: Feature-First + Domain-Driven Design
 * 分层: Models -> Database -> Repositories -> Services -> Stores
 * 设计原则: 单向依赖、领域隔离、可测试性
 */

// 🎯 模型层 (核心数据模型和验证)
export * from './models';

// 🗄️ 数据库层 (持久化和查询)
export * from './database';

// 🏗️ 仓储层 (数据访问抽象)
export * from './repositories';

// 🔧 服务层 (业务逻辑封装)
export * from './services';

// 🏪 状态管理层 (响应式状态)
export * from './stores';

// 🎯 域聚合器 - 提供统一的数据访问接口
export class LiteratureDataAccess {
    constructor(
        public readonly repositories = require('./repositories').literatureDomainRepositories,
        public readonly services = require('./services').literatureDomainServices,
        public readonly database = require('./database').literatureDB
    ) { }

    /**
     * 🚀 初始化整个数据访问层
     */
    async initialize(): Promise<{
        database: any;
        repositories: any;
        services: any;
        isHealthy: boolean;
        initializationTime: number;
    }> {
        const startTime = Date.now();

        try {
            console.log('[LiteratureDataAccess] Initializing data access layer...');

            // 1. 数据库健康检查
            const dbHealth = await this.database.healthCheck();

            // 2. 仓储层健康检查
            const repoHealth = await this.repositories.getHealthStatus();

            // 3. 服务层初始化
            const serviceInit = await this.services.initialize();

            const result = {
                database: dbHealth,
                repositories: repoHealth,
                services: serviceInit,
                isHealthy: dbHealth.isHealthy && repoHealth.isHealthy && serviceInit.services.core,
                initializationTime: Date.now() - startTime
            };

            console.log('[LiteratureDataAccess] Data access layer initialized:', result);
            return result;
        } catch (error) {
            console.error('[LiteratureDataAccess] Initialization failed:', error);
            throw new Error('Failed to initialize literature data access layer');
        }
    }

    /**
     * 🔍 执行全面健康检查
     */
    async performComprehensiveHealthCheck(): Promise<{
        overall: boolean;
        database: any;
        repositories: any;
        services: any;
        performance: {
            totalResponseTime: number;
            checkTime: Date;
        };
        recommendations: string[];
    }> {
        const startTime = Date.now();
        const recommendations: string[] = [];

        try {
            const [dbHealth, repoHealth, serviceHealth] = await Promise.all([
                this.database.healthCheck(),
                this.repositories.getHealthStatus(),
                this.services.performHealthCheck()
            ]);

            // 分析健康状态并生成建议
            if (!dbHealth.isHealthy) {
                recommendations.push('Database connection issues detected');
            }

            if (dbHealth.stats.libraries === 0) {
                recommendations.push('No literature data found - consider importing initial dataset');
            }

            if (repoHealth.totalRecords.citation === 0 && repoHealth.totalRecords.literature > 10) {
                recommendations.push('No citations found - consider running citation linking');
            }

            if (serviceHealth.services.sync.connectionStatus !== 'connected') {
                recommendations.push('Sync service disconnected - check network connectivity');
            }

            if (serviceHealth.services.sync.offlineQueueSize > 0) {
                recommendations.push(`${serviceHealth.services.sync.offlineQueueSize} operations pending sync`);
            }

            const overall = dbHealth.isHealthy && repoHealth.isHealthy && serviceHealth.overall;

            return {
                overall,
                database: dbHealth,
                repositories: repoHealth,
                services: serviceHealth,
                performance: {
                    totalResponseTime: Date.now() - startTime,
                    checkTime: new Date()
                },
                recommendations
            };
        } catch (error) {
            console.error('[LiteratureDataAccess] Comprehensive health check failed:', error);
            return {
                overall: false,
                database: { isHealthy: false },
                repositories: { isHealthy: false },
                services: { overall: false },
                performance: {
                    totalResponseTime: Date.now() - startTime,
                    checkTime: new Date()
                },
                recommendations: ['Health check system failure', ...recommendations]
            };
        }
    }

    /**
     * 🛠️ 执行维护和优化
     */
    async performMaintenance(): Promise<{
        database: any;
        repositories: any;
        services: any;
        optimizations: string[];
        executionTime: number;
    }> {
        const startTime = Date.now();
        const optimizations: string[] = [];

        try {
            console.log('[LiteratureDataAccess] Starting comprehensive maintenance...');

            // 1. 数据库维护
            const dbMaintenance = await this.database.performMaintenance();
            if (dbMaintenance.orphanedUserMetas > 0 || dbMaintenance.orphanedCitations > 0) {
                optimizations.push(`Cleaned ${dbMaintenance.orphanedUserMetas + dbMaintenance.orphanedCitations} orphaned records`);
            }

            // 2. 仓储层维护
            const repoMaintenance = await this.repositories.performMaintenance();
            if (repoMaintenance.duplicateLiterature > 0) {
                optimizations.push(`Removed ${repoMaintenance.duplicateLiterature} duplicate literature items`);
            }

            // 3. 服务层智能维护
            const serviceMaintenance = await this.services.performIntelligentMaintenance();
            optimizations.push(...serviceMaintenance.recommendations);

            const result = {
                database: dbMaintenance,
                repositories: repoMaintenance,
                services: serviceMaintenance,
                optimizations,
                executionTime: Date.now() - startTime
            };

            console.log('[LiteratureDataAccess] Comprehensive maintenance completed:', result);
            return result;
        } catch (error) {
            console.error('[LiteratureDataAccess] Maintenance failed:', error);
            throw new Error('Failed to perform maintenance');
        }
    }

    /**
     * 📊 获取全域统计报告
     */
    async generateStatisticsReport(): Promise<{
        overview: {
            totalLiterature: number;
            totalCitations: number;
            totalCollections: number;
            totalUsers: number;
            lastActivity: Date | null;
        };
        performance: {
            databaseSize: string;
            averageQueryTime: number;
            cacheHitRate: number;
        };
        insights: {
            mostCitedLiterature: any[];
            trendingTopics: any[];
            activeUsers: any[];
            citationNetworkStats: any;
        };
        recommendations: string[];
        generatedAt: Date;
    }> {
        try {
            console.log('[LiteratureDataAccess] Generating comprehensive statistics report...');

            const [dbOverview, domainStats, trends] = await Promise.all([
                this.database.getOverview(),
                this.services.getDomainStatistics(),
                this.services.ai.analyzeResearchTrends('year', 3)
            ]);

            const recommendations: string[] = [];

            // 生成洞察和建议
            if (dbOverview.totalLiterature < 100) {
                recommendations.push('Consider importing more literature for better AI insights');
            }

            if (dbOverview.totalCitations === 0) {
                recommendations.push('No citation network - run citation linking to discover relationships');
            }

            const trendingTopics = trends.filter(t => t.momentum === 'rising').slice(0, 5);
            if (trendingTopics.length > 0) {
                recommendations.push(`${trendingTopics.length} trending research topics identified`);
            }

            return {
                overview: dbOverview,
                performance: {
                    databaseSize: '0 MB', // 可以实现实际计算
                    averageQueryTime: 0,   // 可以添加性能监控
                    cacheHitRate: 0        // 可以添加缓存统计
                },
                insights: {
                    mostCitedLiterature: domainStats.citations.mostCitedItems.slice(0, 10),
                    trendingTopics,
                    activeUsers: [], // 需要用户活动数据
                    citationNetworkStats: domainStats.citations.networkStats
                },
                recommendations,
                generatedAt: new Date()
            };
        } catch (error) {
            console.error('[LiteratureDataAccess] Statistics report generation failed:', error);
            throw new Error('Failed to generate statistics report');
        }
    }

    /**
     * 🧹 清理所有资源
     */
    async shutdown(): Promise<void> {
        try {
            console.log('[LiteratureDataAccess] Shutting down data access layer...');

            // 清理服务层资源
            await this.services.shutdown();

            // 关闭数据库连接
            if (this.database.close) {
                await this.database.close();
            }

            console.log('[LiteratureDataAccess] Data access layer shutdown completed');
        } catch (error) {
            console.error('[LiteratureDataAccess] Shutdown failed:', error);
            throw new Error('Failed to shutdown data access layer');
        }
    }
}

// 🏪 数据访问层单例实例
export const literatureDataAccess = new LiteratureDataAccess();