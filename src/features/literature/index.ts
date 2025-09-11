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

// ==================== 类型导出（来自 models） ====================
export type {
    // 基础数据类型
    LibraryItem,
    ExtendedLibraryItem,
    UserLiteratureMetaCore,
    CreateLiteratureInput,
    UpdateLiteratureInput,
    LiteratureFilter,
    LiteratureSort,
    EnhancedLibraryItem,
    // 组合输入
    CreateComposedLiteratureInput,
    UpdateComposedLiteratureInput,
    // 领域类型与别名（兼容旧命名）
    LiteratureStatus,
    ComponentStatus,
    PaginatedResult,
} from './data-access/models';

// 兼容别名：在旧代码中，常用 `CitationCore`/`CollectionCore` 命名
export type { Citation as CitationCore, Collection as CollectionCore } from './data-access/models';

// ==================== Store 导出（来自 stores） ====================
export {
    // Literature Store
    useLiteratureStore,
    selectAllLiteratures,
    selectLiteratureById,
    selectLiteratureCount,
    selectStats as selectLiteratureStats,
    // Collection Store
    useCollectionStore,
    selectAllCollections,
    selectCollectionById,
    selectCollectionCount,
    selectCollectionsByType,
    selectCollectionStats,
} from './data-access/stores';

export type {
    LiteratureStoreState,
    LiteratureStoreActions,
    CollectionStoreState,
    CollectionStoreActions,
} from './data-access/stores';

// ==================== 数据访问入口（来自 data-access） ====================
export {
    literatureDataAccess,
    literatureEntry,
    normalizeLiteratureIdentifier,
} from './data-access';

export type {
    LiteratureDataAccessAPI,
    CollectionDataAccessAPI,
    LiteraturesDataAccessAPI,
} from './data-access';

// ==================== 便利接口（基于 Data Access） ====================
// 提供少量便捷方法，统一由 data-access 层实现具体逻辑
export const LiteratureConvenience = {
    // 通过统一标识添加文献（DOI/URL/S2等）
    addByIdentifier: async (identifier: string, options?: any) => {
        const m = await import('./data-access');
        return m.literatureEntry.addByIdentifier(identifier, options);
    },

    // 搜索（轻量代理到 data-access）
    search: async (query: string, options?: any) => {
        const m = await import('./data-access');
        return m.literatureDataAccess.searchLiterature(query, options);
    },
} as const;

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
    if (typeof window !== 'undefined' && !window.indexedDB) {
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
    // 🔍 获取内部状态（仅开发环境）
    getInternalState: () => {
        if (process.env.NODE_ENV !== 'development') {
            console.warn('LiteratureDevTools is only available in development mode');
            return null;
        }
        try {
            const { useLiteratureStore } = require('./data-access/stores');
            const { useCollectionStore } = require('./data-access/stores');
            return {
                literatureStore: (useLiteratureStore as any).getState(),
                collectionStore: (useCollectionStore as any).getState(),
            };
        } catch (e) {
            console.warn('Failed to get internal store states', e);
            return null;
        }
    },

    // 🧪 运行健康检查（委托给 data-access）
    runHealthCheck: async () => {
        try {
            const { literatureDataAccess } = require('./data-access');
            return await literatureDataAccess.performHealthCheck();
        } catch (e) {
            console.warn('Health check failed', e);
            return { overall: false, recommendations: ['Health check failed'] };
        }
    },

    // 📈 生成统计报告（委托给 data-access）
    generateStatisticsReport: async () => {
        try {
            const { literatureDataAccess } = require('./data-access');
            return await literatureDataAccess.generateStatisticsReport();
        } catch (e) {
            console.warn('Statistics report failed', e);
            return { overview: {}, insights: {}, recommendations: ['Statistics report failed'] };
        }
    },
} as const;

// ==================== 默认导出 ====================
// 对外默认暴露统一的数据访问入口
export { literatureDataAccess as default } from './data-access';