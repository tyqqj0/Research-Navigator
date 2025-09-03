/**
 * 🎯 Literature Services - 简化版服务聚合
 * 
 * 新架构: 后端为主，前端为辅
 * 核心理念: API-First + 智能缓存 + 用户体验优化
 */

// 🌐 后端API服务
export {
  backendApiService,
  BackendApiService,
  type LiteratureInput,
  type BatchProcessResult,
  type CitationNetworkResult
} from './backend-api-service';

// 📚 文献管理服务 (原版 + 增强版)
export {
  simplifiedLiteratureService,
  SimplifiedLiteratureService
} from './literature-service-simplified';

export {
  enhancedLiteratureService,
  EnhancedLiteratureService,
  type EnhancedLiteratureSearchResult,
  type UserLiteratureStatistics,
  type RecommendationResult,
  type LiteratureAnalysis
} from './enhanced-literature-service';

// 🔗 引用关系服务
export {
  simplifiedCitationService,
  SimplifiedCitationService
} from './citation-service-simplified';

// 📂 集合管理服务
export {
  simplifiedCollectionService,
  SimplifiedCollectionService
} from './collection-service-simplified';

/**
 * 🏪 Literature Domain Services - 统一服务接口
 * 
 * 提供文献领域的所有服务实例
 * 简化外部调用，统一错误处理
 */
export const literatureDomainServices = {
  // 🌐 后端API服务
  backend: backendApiService,

  // 📚 核心业务服务
  literature: simplifiedLiteratureService,
  enhancedLiterature: enhancedLiteratureService,
  citation: simplifiedCitationService,
  collection: simplifiedCollectionService,

  // 🔧 服务管理
  async initialize(): Promise<void> {
    console.log('[LiteratureDomainServices] Initializing services...');

    try {
      // 执行健康检查
      const healthCheck = await this.literature.healthCheck();

      if (!healthCheck.isHealthy) {
        console.warn('[LiteratureDomainServices] Health check warnings:', healthCheck.recommendations);
      }

      console.log('[LiteratureDomainServices] Services initialized successfully');
    } catch (error) {
      console.error('[LiteratureDomainServices] Initialization failed:', error);
      throw new Error('Failed to initialize literature domain services');
    }
  },

  async cleanup(): Promise<void> {
    console.log('[LiteratureDomainServices] Cleaning up services...');

    try {
      // 清理缓存
      this.backend.clearCache();

      console.log('[LiteratureDomainServices] Services cleaned up successfully');
    } catch (error) {
      console.error('[LiteratureDomainServices] Cleanup failed:', error);
    }
  },

  async getServiceStatus(): Promise<{
    backend: boolean;
    literature: boolean;
    citation: boolean;
    collection: boolean;
    overall: boolean;
  }> {
    try {
      const literatureHealth = await this.literature.healthCheck();

      return {
        backend: literatureHealth.backend,
        literature: literatureHealth.localCache,
        citation: true, // 简化版本，假设总是健康
        collection: true, // 简化版本，假设总是健康
        overall: literatureHealth.isHealthy
      };
    } catch (error) {
      console.error('[LiteratureDomainServices] Status check failed:', error);
      return {
        backend: false,
        literature: false,
        citation: false,
        collection: false,
        overall: false
      };
    }
  }
} as const;

/**
 * 🎯 快捷服务访问
 * 
 * 为常用操作提供简化接口
 */
export const quickLiteratureActions = {
  // ➕ 快速添加文献
  async addLiterature(input: LiteratureInput, userId?: string) {
    return await literatureDomainServices.literature.addLiterature(input, userId);
  },

  // 📦 批量添加文献
  async batchAddLiterature(
    inputs: LiteratureInput[],
    userId?: string,
    onProgress?: (progress: number, current: number, total: number) => void
  ) {
    return await literatureDomainServices.literature.batchAddLiterature(inputs, userId, onProgress);
  },

  // 🔍 搜索文献
  async searchLiterature(query: string, userId?: string) {
    return await literatureDomainServices.literature.searchLiterature(
      { text: query },
      1,
      20,
      userId
    );
  },

  // 🎯 获取推荐
  async getRecommendations(userId: string, currentLiteratureId?: string) {
    return await literatureDomainServices.literature.getRecommendations(userId, {
      currentLiteratureId,
      limit: 10
    });
  },

  // 🕸️ 获取引用网络
  async getCitationNetwork(literatureIds: string[]) {
    return await literatureDomainServices.citation.getCitationNetwork(literatureIds);
  },

  // 📂 创建集合
  async createCollection(userId: string, name: string, type: 'manual' | 'smart' | 'topic' = 'manual') {
    return await literatureDomainServices.collection.createCollection(userId, {
      name,
      type,
      description: ''
    });
  },

  // 📋 获取用户集合
  async getUserCollections(userId: string) {
    return await literatureDomainServices.collection.getUserCollections(userId);
  }
} as const;

/**
 * 📊 服务统计和监控
 */
export const literatureServiceMetrics = {
  async getOverallStatistics() {
    const [literatureStats, serviceStatus] = await Promise.all([
      literatureDomainServices.literature.getServiceStatistics(),
      literatureDomainServices.getServiceStatus()
    ]);

    return {
      literature: literatureStats,
      services: serviceStatus,
      timestamp: new Date()
    };
  },

  async performHealthCheck() {
    return await literatureDomainServices.literature.healthCheck();
  },

  async getCacheStatistics() {
    const backendStats = literatureDomainServices.backend.getCacheStats();
    const literatureStats = await literatureDomainServices.literature.getServiceStatistics();

    return {
      backend: backendStats,
      local: literatureStats.local,
      recommendations: [
        ...(backendStats.totalEntries === 0 ? ['Backend cache is empty'] : []),
        ...(literatureStats.local.totalLiterature === 0 ? ['Local cache is empty'] : [])
      ]
    };
  }
} as const;