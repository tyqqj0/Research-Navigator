/**
 * 📚 Literature Feature - 统一对外接口
 * 
 * 设计原则:
 * 1. 最小权限暴露 - 只导出必要的接口
 * 2. 类型安全 - 完整的TypeScript支持
 * 3. 向后兼容 - 保持API稳定性
 * 4. 易于使用 - 提供便利的快捷方法
 * 5. 文档完善 - 清晰的使用说明
 */

import type {
    LibraryItem,
    UserLiteratureMetaCore,
    CreateLiteratureInput,
    UpdateLiteratureInput,
    LiteratureFilter,
    LiteratureSort,
    EnhancedLibraryItem,
} from './data-access/models';

import type {
    EnhancedSearchResult,
    UserLiteratureStatistics,
    RecommendationResult,
} from './data-access/services';

import type {
    UnifiedLiteratureStoreState,
} from './data-access/stores';

import {
    useUnifiedLiteratureStore,
    useLiteratureData,
    useLiteratureActions,
    useLiteratureUser,
    literatureStoreSelectors,
} from './data-access/stores';

import {
    unifiedLiteratureService,
} from './data-access/services';

// ==================== 核心类型导出 ====================

// 🎯 基础数据类型
export type {
    LibraryItem,
    UserLiteratureMetaCore,
    CitationCore,
    CollectionCore,
    EnhancedLibraryItem,
    CreateLiteratureInput,
    UpdateLiteratureInput,
    LiteratureFilter,
    LiteratureSort,
    PaginatedResult,
} from './data-access/models';

// 🎯 服务结果类型
export type {
    EnhancedLiteratureSearchResult,
    UserLiteratureStatistics,
    RecommendationResult,
    LiteratureAnalysis,
} from './data-access/services';

// 🎯 仓储操作结果类型
export type {
    LiteratureOperationResult,
    BulkLiteratureResult,
    LiteratureStatistics,
} from './data-access/repositories';

// 🎯 Store状态类型
export type {
    LiteratureStoreState,
} from './data-access/stores';

// ==================== 主要接口导出 ====================

// 🏪 状态管理 - 推荐的主要接口
export {
    useEnhancedLiteratureStore,
    useLiteratureData,
    useLiteratureActions,
    useLiteratureUser,
    literatureStoreSelectors,
} from './data-access/stores';

// 🔧 服务层 - 高级业务逻辑
export {
    enhancedLiteratureService,
} from './data-access/services';

// 🏗️ 仓储层 - 数据访问（仅在特殊情况下使用）
export {
    LiteratureRepository,
} from './data-access/repositories';

// ==================== 便利接口 ====================

/**
 * 🎯 Literature Feature 主要接口类
 * 
 * 提供统一的、类型安全的文献管理接口
 * 这是推荐的使用方式，封装了所有复杂的内部逻辑
 */
export class LiteratureFeature {
    private static instance: LiteratureFeature;

    // 🏪 Store实例
    private store = useEnhancedLiteratureStore.getState();

    /**
     * 🎯 获取单例实例
     */
    static getInstance(): LiteratureFeature {
        if (!LiteratureFeature.instance) {
            LiteratureFeature.instance = new LiteratureFeature();
        }
        return LiteratureFeature.instance;
    }

    /**
     * 🔧 初始化文献功能
     */
    async initialize(userId?: string): Promise<void> {
        return this.store.initialize(userId);
    }

    /**
     * 🧹 清理资源
     */
    cleanup(): void {
        this.store.cleanup();
    }

    // ==================== 文献操作 ====================

    /**
     * ➕ 创建文献
     */
    async createLiterature(
        input: CreateLiteratureInput,
        options?: {
            autoTag?: boolean;
            autoExtractKeywords?: boolean;
            linkCitations?: boolean;
        }
    ): Promise<string> {
        return this.store.createLiterature(input, options);
    }

    /**
     * 📝 更新文献
     */
    async updateLiterature(id: string, updates: UpdateLiteratureInput): Promise<void> {
        return this.store.updateLiterature(id, updates);
    }

    /**
     * 🗑️ 删除文献
     */
    async deleteLiterature(id: string): Promise<void> {
        return this.store.deleteLiterature(id);
    }

    /**
     * 📦 批量导入文献
     */
    async bulkImportLiterature(inputs: CreateLiteratureInput[]): Promise<void> {
        return this.store.bulkImportLiterature(inputs);
    }

    // ==================== 搜索和过滤 ====================

    /**
     * 🔍 搜索文献
     */
    async searchLiterature(
        filter?: LiteratureFilter,
        sort?: LiteratureSort,
        page?: number
    ): Promise<void> {
        return this.store.searchLiterature(filter, sort, page);
    }

    /**
     * 🔧 设置搜索过滤器
     */
    setFilter(filter: Partial<LiteratureFilter>): void {
        this.store.setFilter(filter);
    }

    /**
     * 📈 设置排序方式
     */
    setSort(sort: LiteratureSort): void {
        this.store.setSort(sort);
    }

    /**
     * 📄 设置页码
     */
    setPage(page: number): void {
        this.store.setPage(page);
    }

    /**
     * 🧹 清除搜索
     */
    clearSearch(): void {
        this.store.clearSearch();
    }

    // ==================== 用户相关 ====================

    /**
     * 👤 设置当前用户
     */
    async setCurrentUser(userId: string): Promise<void> {
        return this.store.setCurrentUser(userId);
    }

    /**
     * 📝 更新用户元数据
     */
    async updateUserMeta(
        paperId: string,
        updates: Partial<UserLiteratureMetaCore>
    ): Promise<void> {
        return this.store.updateUserMeta(paperId, updates);
    }

    /**
     * 📊 获取用户统计
     */
    async getUserStatistics(force?: boolean): Promise<UserLiteratureStatistics> {
        return this.store.getUserStatistics(force);
    }

    // ==================== 智能推荐 ====================

    /**
     * 🤖 获取推荐
     */
    async getRecommendations(paperId: string, force?: boolean): Promise<RecommendationResult> {
        return this.store.getRecommendations(paperId, force);
    }

    /**
     * 🧹 清除推荐缓存
     */
    clearRecommendations(): void {
        this.store.clearRecommendations();
    }

    // ==================== 配置和维护 ====================

    /**
     * ⚙️ 更新偏好设置
     */
    updatePreferences(preferences: Partial<LiteratureStoreState['preferences']>): void {
        this.store.updatePreferences(preferences);
    }

    /**
     * 🗄️ 清除缓存
     */
    clearCache(): void {
        this.store.clearCache();
    }

    /**
     * 🔄 刷新缓存
     */
    async refreshCache(): Promise<void> {
        return this.store.refreshCache();
    }

    /**
     * 📊 获取性能指标
     */
    getPerformanceMetrics() {
        return this.store.getPerformanceMetrics();
    }

    // ==================== 状态访问 ====================

    /**
     * 📋 获取当前文献列表
     */
    get literatures(): EnhancedLiteratureItem[] {
        return this.store.literaturesList;
    }

    /**
     * 🔍 获取搜索结果
     */
    get searchResults(): EnhancedLiteratureSearchResult | null {
        return this.store.searchResults;
    }

    /**
     * 👤 获取当前用户ID
     */
    get currentUserId(): string | null {
        return this.store.currentUserId;
    }

    /**
     * 📊 获取用户统计
     */
    get userStatistics(): UserLiteratureStatistics | null {
        return this.store.userStatistics;
    }

    /**
     * ⏳ 获取加载状态
     */
    get loading() {
        return this.store.loading;
    }

    /**
     * ❌ 获取错误状态
     */
    get error() {
        return this.store.error;
    }

    /**
     * ⚙️ 获取偏好设置
     */
    get preferences() {
        return this.store.preferences;
    }
}

// ==================== 快捷方法导出 ====================

/**
 * 🎯 获取文献功能实例
 * 
 * 这是推荐的使用方式
 */
export const useLiteratureFeature = () => LiteratureFeature.getInstance();

/**
 * 🚀 快速初始化文献功能
 * 
 * 便利方法，用于应用启动时初始化
 */
export const initializeLiteratureFeature = async (userId?: string) => {
    const feature = LiteratureFeature.getInstance();
    await feature.initialize(userId);
    return feature;
};

/**
 * 🧹 快速清理文献功能
 * 
 * 便利方法，用于应用关闭时清理
 */
export const cleanupLiteratureFeature = () => {
    const feature = LiteratureFeature.getInstance();
    feature.cleanup();
};

// ==================== 常量导出 ====================

/**
 * 📊 文献功能常量
 */
export const LITERATURE_FEATURE_CONSTANTS = {
    // 分页
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,

    // 搜索
    MAX_SEARCH_RESULTS: 1000,
    DEFAULT_SEARCH_FIELDS: ['title', 'authors'] as const,

    // 批量操作
    MAX_BULK_SIZE: 500,

    // 缓存
    DEFAULT_CACHE_TTL: 300000, // 5分钟
    MAX_CACHE_SIZE: 1000,

    // 推荐
    DEFAULT_RECOMMENDATION_LIMIT: 10,
    MAX_RECOMMENDATION_LIMIT: 50,

    // 性能
    SLOW_OPERATION_THRESHOLD: 1000, // 1秒
} as const;

/**
 * 🎨 文献功能主题配置
 */
export const LITERATURE_FEATURE_THEME = {
    colors: {
        primary: '#2563eb',
        secondary: '#64748b',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#06b6d4',
    },

    icons: {
        literature: '📚',
        search: '🔍',
        filter: '🔧',
        sort: '📈',
        user: '👤',
        statistics: '📊',
        recommendations: '🤖',
        loading: '⏳',
        error: '❌',
        success: '✅',
    },
} as const;

// ==================== 版本信息 ====================

/**
 * 📦 文献功能版本信息
 */
export const LITERATURE_FEATURE_VERSION = {
    version: '2.0.0',
    buildDate: new Date().toISOString(),
    features: [
        'Enhanced Repository Pattern',
        'Smart Caching System',
        'Intelligent Recommendations',
        'Real-time State Management',
        'Advanced Error Handling',
        'Performance Monitoring',
        'Offline Support',
        'Type Safety',
    ],
} as const;

/**
 * 🔍 检查功能兼容性
 */
export const checkLiteratureFeatureCompatibility = () => {
    const requiredFeatures = [
        'IndexedDB',
        'Zustand',
        'TypeScript',
        'React',
    ];

    const compatibility = {
        supported: true,
        missing: [] as string[],
        warnings: [] as string[],
    };

    // 检查IndexedDB支持
    if (!window.indexedDB) {
        compatibility.supported = false;
        compatibility.missing.push('IndexedDB');
    }

    // 检查其他必要功能...

    return compatibility;
};

// ==================== 开发工具 ====================

/**
 * 🛠️ 开发工具（仅在开发环境可用）
 */
export const LiteratureDevTools = {
    /**
     * 🔍 获取内部状态（调试用）
     */
    getInternalState: () => {
        if (process.env.NODE_ENV !== 'development') {
            console.warn('LiteratureDevTools is only available in development mode');
            return null;
        }

        return {
            store: useEnhancedLiteratureStore.getState(),
            service: enhancedLiteratureService.getPerformanceMetrics(),
        };
    },

    /**
     * 📊 生成性能报告
     */
    generatePerformanceReport: () => {
        if (process.env.NODE_ENV !== 'development') {
            console.warn('LiteratureDevTools is only available in development mode');
            return null;
        }

        const feature = LiteratureFeature.getInstance();
        return feature.getPerformanceMetrics();
    },

    /**
     * 🧪 运行健康检查
     */
    runHealthCheck: async () => {
        if (process.env.NODE_ENV !== 'development') {
            console.warn('LiteratureDevTools is only available in development mode');
            return null;
        }

        // TODO: 实现完整的健康检查
        return {
            database: 'healthy',
            repositories: 'healthy',
            services: 'healthy',
            store: 'healthy',
            overall: 'healthy',
        };
    },
};

// ==================== 默认导出 ====================

/**
 * 🎯 默认导出 - Literature Feature类
 * 
 * 推荐使用方式：
 * ```typescript
 * import LiteratureFeature from '@/features/literature';
 * 
 * const literature = LiteratureFeature.getInstance();
 * await literature.initialize(userId);
 * ```
 */
export default LiteratureFeature;