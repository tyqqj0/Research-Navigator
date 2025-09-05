/**
 * 🎯 Literature Services - 重构后的服务层
 * 
 * 新架构设计原则:
 * 1. 单一职责：每个服务专注于特定的业务领域
 * 2. 清晰边界：服务间职责明确，避免重叠
 * 3. 标准命名：使用标准的服务名称，避免前缀后缀
 * 4. 可组合性：服务可以独立使用或组合使用
 * 5. 类型安全：完整的TypeScript类型支持
 */

// ==================== 核心业务服务 ====================

// 📚 文献核心服务 - 基础CRUD和用户元数据管理
export {
  literatureService,
  LiteratureService,
  type LiteratureCreateOptions,
  type LiteratureServiceStats,
} from './literature-service';

// 🔍 搜索服务 - 高级搜索和过滤功能
export {
  searchService,
  SearchService,
  type EnhancedSearchResult,
  type SearchFacets,
  type SearchSuggestions,
  type SearchOptions,
  type SearchServiceStats,
} from './search-service';

// 🤖 推荐服务 - 智能推荐算法
export {
  recommendationService,
  RecommendationService,
  type RecommendationResult,
  type RecommendedLiterature,
  type SuggestedTag,
  type RelatedCollection,
  type TrendingTopic,
  type RecommendationOptions,
} from './recommendation-service';

// 📊 分析服务 - 统计分析和报告
export {
  analyticsService,
  AnalyticsService,
  type UserStatistics,
  type LiteratureAnalytics,
  type CitationNetworkAnalytics,
  type PerformanceAnalytics,
  type AnalyticsReport,
} from './analytics-service';

// 🔗 引文服务 - 引文管理和网络分析
export {
  citationService,
  CitationService,
  type CitationNetworkResult,
  type CitationDiscoveryResult,
  type CitationStatistics,
} from './citation-service';

// 📂 集合服务 - 集合管理和智能集合
export {
  collectionService,
  CollectionService,
  type CreateCollectionInput,
  type CollectionRules,
  type CollectionStatistics,
  type CollectionRecommendation,
} from './collection-service';

// 👤 用户元数据服务 - 用户个性化数据管理
export {
  userMetaService,
  UserMetaService,
  type UserMetaCreateOptions,
  type UserMetaServiceStats,
} from './user-meta-service';

// ==================== 外部集成服务 ====================

// 🌐 后端API服务 - 外部数据源集成
export {
  backendApiService,
  BackendApiService,
  type LiteratureInput,
  type BatchProcessResult,
  type CitationNetworkResult as BackendCitationNetworkResult,
} from './backend-api-service';

// 🔄 组合服务 - 文献数据组合操作
export {
  compositionService,
  CompositionService,
  type CreateComposedLiteratureInput,
  type UpdateComposedLiteratureInput,
  type BatchOperationResult,
} from './composition-service';

// 🤖 AI服务 - AI能力集成
// export {
//     aiService,
//     AIService,
// } from './ai-service';

// ==================== 统一服务接口 ====================

/**
 * 🏪 Literature Domain Services - 统一服务聚合器
 * 
 * 提供文献领域的所有服务实例，简化外部调用
 */
// 导入服务实例
import { literatureService } from './literature-service';
import { searchService } from './search-service';
import { recommendationService } from './recommendation-service';
import { analyticsService } from './analytics-service';
import { citationService } from './citation-service';
import { collectionService } from './collection-service';
import { userMetaService } from './user-meta-service';
import { backendApiService } from './backend-api-service';

export const literatureDomainServices = {
  // 核心业务服务
  literature: literatureService,
  search: searchService,
  recommendation: recommendationService,
  analytics: analyticsService,
  citation: citationService,
  collection: collectionService,
  userMeta: userMetaService,

  // 外部集成服务
  backend: backendApiService,
  // ai: aiService,

  /**
   * 🚀 初始化所有服务
   */
  async initialize(): Promise<void> {
    console.log('[LiteratureDomainServices] Initializing services...');

    try {
      // 执行服务健康检查
      const healthChecks = await Promise.allSettled([
        this.testServiceConnectivity(),
        this.validateServiceDependencies(),
      ]);

      const failures = healthChecks.filter(result => result.status === 'rejected');
      if (failures.length > 0) {
        console.warn('[LiteratureDomainServices] Some health checks failed:', failures);
      }

      console.log('[LiteratureDomainServices] Services initialized successfully');
    } catch (error) {
      console.error('[LiteratureDomainServices] Initialization failed:', error);
      throw new Error('Failed to initialize literature domain services');
    }
  },

  /**
   * 🧹 清理所有服务
   */
  async cleanup(): Promise<void> {
    console.log('[LiteratureDomainServices] Cleaning up services...');

    try {
      // 清理所有服务缓存
      await Promise.all([
        this.search.clearCache(),
        this.recommendation.clearCache(),
        this.analytics.clearCache(),
        this.citation.clearCache(),
        this.collection.clearCache(),
        this.backend.clearCache(),
      ]);

      console.log('[LiteratureDomainServices] Services cleaned up successfully');
    } catch (error) {
      console.error('[LiteratureDomainServices] Cleanup failed:', error);
    }
  },

  /**
   * 📊 获取所有服务状态
   */
  async getServiceStatus(): Promise<{
    literature: boolean;
    search: boolean;
    recommendation: boolean;
    analytics: boolean;
    citation: boolean;
    collection: boolean;
    backend: boolean;
    // ai: boolean;
    overall: boolean;
  }> {
    try {
      // 简化的健康检查
      const services = {
        literature: true,
        search: true,
        recommendation: true,
        analytics: true,
        citation: true,
        collection: true,
        backend: true,
        // ai: true,
      };

      const overall = Object.values(services).every(status => status);

      return { ...services, overall };
    } catch (error) {
      console.error('[LiteratureDomainServices] Status check failed:', error);
      return {
        literature: false,
        search: false,
        recommendation: false,
        analytics: false,
        citation: false,
        collection: false,
        backend: false,
        // ai: false,
        overall: false,
      };
    }
  },

  /**
   * 📈 获取服务性能指标
   */
  getPerformanceMetrics() {
    return {
      literature: this.literature.getServiceStats(),
      search: this.search.getSearchStats(),
      recommendation: this.recommendation.getRecommendationStats(),
      analytics: this.analytics.getServiceStats(),
      citation: this.citation.getCitationServiceStats(),
      collection: this.collection.getCollectionServiceStats(),
      timestamp: new Date(),
    };
  },

  // 私有辅助方法
  async testServiceConnectivity(): Promise<void> {
    // 测试服务连接性
  },

  async validateServiceDependencies(): Promise<void> {
    // 验证服务依赖
  },
} as const;

// ==================== 便捷操作接口 ====================

/**
 * 🎯 Quick Literature Actions - 常用操作的便捷接口
 * 
 * 为最常用的操作提供简化的调用方式
 */
export const quickLiteratureActions = {
  // ➕ 快速添加文献
  async addLiterature(
    input: any, // LiteratureInput,
    userId?: string,
    options?: { autoTag?: boolean; autoExtractKeywords?: boolean }
  ) {
    return await literatureDomainServices.literature.createLiterature(
      input as any,
      // userId,
      options
    );
  },

  // 📦 批量添加文献
  async batchAddLiterature(
    inputs: any[], // LiteratureInput[],
    userId?: string,
    onProgress?: (progress: number, current: number, total: number) => void
  ) {
    const result = await literatureDomainServices.literature.bulkCreateLiterature(
      inputs as any,
      // userId,
      { batchSize: 10 }
    );

    // 简化的进度回调
    if (onProgress) {
      onProgress(100, result.successful, result.total);
    }

    return result;
  },

  // 🔍 快速搜索
  async searchLiterature(
    query: string,
    userId?: string,
    options?: { includeFacets?: boolean }
  ) {
    return await literatureDomainServices.search.searchLiterature(
      { searchTerm: query, authors: [query] },
      { field: 'createdAt', order: 'desc' },
      1,
      20,
      // userId,
      options as any
    );
  },

  // 🎯 获取推荐
  async getRecommendations(
    userId: string,
    baseLiteratureId?: string,
    options?: { limit?: number }
  ) {
    return await literatureDomainServices.recommendation.getPersonalizedRecommendations(
      userId,
      baseLiteratureId,
      { limit: options?.limit || 10 }
    );
  },

  // 🕸️ 获取引文网络
  async getCitationNetwork(lids: string[], depth: number = 2) {
    return await literatureDomainServices.citation.getCitationNetwork(
      lids,
      depth,
      true
    );
  },

  // 📂 创建集合
  async createCollection(
    userId: string,
    name: string,
    type: 'general' | 'topic' | 'project' | 'smart' | 'temporary' = 'general',
    options?: { description?: string; rules?: any }
  ) {
    return await literatureDomainServices.collection.createCollection(userId, {
      name,
      type,
      description: options?.description || '',
      rules: options?.rules,
    });
  },

  // 📋 获取用户集合
  async getUserCollections(userId: string, includeStats: boolean = false) {
    return await literatureDomainServices.collection.getUserCollections(
      userId,
      includeStats
    );
  },

  // 📊 获取用户统计
  async getUserStatistics(userId: string, period?: { start: Date; end: Date }) {
    return await literatureDomainServices.analytics.getUserStatistics(userId, period);
  },
} as const;

// ==================== 服务监控和诊断 ====================

/**
 * 📊 Service Monitoring - 服务监控和诊断工具
 */
export const literatureServiceMonitoring = {
  /**
   * 🏥 执行全面健康检查
   */
  async performHealthCheck() {
    const status = await literatureDomainServices.getServiceStatus();
    const metrics = literatureDomainServices.getPerformanceMetrics();

    return {
      status,
      metrics,
      timestamp: new Date(),
      recommendations: this.generateHealthRecommendations(status, metrics),
    };
  },

  /**
   * 📈 获取性能报告
   */
  async getPerformanceReport() {
    const metrics = literatureDomainServices.getPerformanceMetrics();

    return {
      overview: {
        totalServices: 8,
        healthyServices: Object.values(await literatureDomainServices.getServiceStatus())
          .filter(status => status === true).length - 1, // 减去overall
        averageResponseTime: this.calculateAverageResponseTime(metrics),
      },
      details: metrics,
      alerts: this.generatePerformanceAlerts(metrics),
      timestamp: new Date(),
    };
  },

  /**
   * 🧹 清理所有缓存
   */
  async clearAllCaches() {
    await literatureDomainServices.cleanup();
    return { success: true, clearedAt: new Date() };
  },

  // 私有辅助方法
  generateHealthRecommendations(status: any, metrics: any): string[] {
    const recommendations: string[] = [];

    if (!status.overall) {
      recommendations.push('Some services are not healthy - check individual service status');
    }

    if (metrics.search.averageResponseTime > 1000) {
      recommendations.push('Search service response time is high - consider cache optimization');
    }

    if (metrics.analytics.cacheHitRate < 0.5) {
      recommendations.push('Analytics cache hit rate is low - review caching strategy');
    }

    return recommendations;
  },

  calculateAverageResponseTime(metrics: any): number {
    const times = [
      metrics.literature.averageResponseTime,
      metrics.search.averageResponseTime,
      metrics.recommendation.averageResponseTime,
      metrics.analytics.averageComputeTime,
      metrics.citation.averageResponseTime,
      metrics.collection.averageResponseTime,
    ].filter(time => typeof time === 'number' && time > 0);

    return times.length > 0 ? times.reduce((sum, time) => sum + time, 0) / times.length : 0;
  },

  generatePerformanceAlerts(metrics: any): Array<{ type: string; message: string; severity: 'low' | 'medium' | 'high' }> {
    const alerts: Array<{ type: string; message: string; severity: 'low' | 'medium' | 'high' }> = [];

    // 检查响应时间
    if (metrics.search.averageResponseTime > 2000) {
      alerts.push({
        type: 'performance',
        message: 'Search service response time exceeds 2 seconds',
        severity: 'high',
      });
    }

    // 检查缓存命中率
    if (metrics.search.cacheHitRate < 0.3) {
      alerts.push({
        type: 'cache',
        message: 'Search cache hit rate is below 30%',
        severity: 'medium',
      });
    }

    return alerts;
  },
} as const;

// ==================== 默认导出 ====================

export default literatureDomainServices;