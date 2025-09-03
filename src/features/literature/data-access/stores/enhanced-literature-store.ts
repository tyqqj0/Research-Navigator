/**
 * 🏪 Enhanced Literature Store - 优化版文献状态管理
 * 
 * 设计原则:
 * 1. 响应式状态 - 自动UI更新
 * 2. 智能缓存 - 减少不必要的网络请求
 * 3. 离线支持 - 本地数据持久化
 * 4. 性能优化 - 虚拟化和懒加载
 * 5. 类型安全 - 完整TypeScript支持
 */

import { create } from 'zustand';
import { subscribeWithSelector, devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import {
    enhancedLiteratureService,
    type EnhancedLiteratureSearchResult,
    type UserLiteratureStatistics,
    type RecommendationResult,
} from '../services';
import {
    LibraryItemCore,
    UserLiteratureMetaCore,
    EnhancedLiteratureItem,
    CreateLiteratureInput,
    UpdateLiteratureInput,
    LiteratureFilter,
    LiteratureSort,
    PaginatedResult,
    ErrorHandler,
    LITERATURE_CONSTANTS,
} from '../models';

/**
 * 🎯 Store状态接口
 */
export interface LiteratureStoreState {
    // ==================== 数据状态 ====================

    // 📚 文献数据
    literatures: Map<string, EnhancedLiteratureItem>;
    literaturesList: EnhancedLiteratureItem[];

    // 👤 用户数据
    currentUserId: string | null;
    userStatistics: UserLiteratureStatistics | null;

    // 🔍 搜索状态
    searchResults: EnhancedLiteratureSearchResult | null;
    currentFilter: LiteratureFilter;
    currentSort: LiteratureSort;
    currentPage: number;

    // 🤖 推荐系统
    recommendations: Map<string, RecommendationResult>;

    // 📊 UI状态
    loading: {
        search: boolean;
        create: boolean;
        update: boolean;
        delete: boolean;
        recommendations: boolean;
        statistics: boolean;
    };

    error: {
        search: string | null;
        create: string | null;
        update: string | null;
        delete: string | null;
        recommendations: string | null;
        statistics: string | null;
    };

    // 🎛️ 配置状态
    preferences: {
        pageSize: number;
        autoRefresh: boolean;
        cacheEnabled: boolean;
        offlineMode: boolean;
    };

    // 📈 性能状态
    performance: {
        lastUpdateTime: Date | null;
        operationCount: number;
        averageResponseTime: number;
        cacheHitRate: number;
    };

    // ==================== 操作方法 ====================

    // 🔧 初始化
    initialize: (userId?: string) => Promise<void>;
    cleanup: () => void;

    // 📚 文献操作
    createLiterature: (input: CreateLiteratureInput, options?: {
        autoTag?: boolean;
        autoExtractKeywords?: boolean;
        linkCitations?: boolean;
    }) => Promise<string>;

    updateLiterature: (id: string, updates: UpdateLiteratureInput) => Promise<void>;
    deleteLiterature: (id: string) => Promise<void>;
    bulkImportLiterature: (inputs: CreateLiteratureInput[]) => Promise<void>;

    // 🔍 搜索和过滤
    searchLiterature: (
        filter?: LiteratureFilter,
        sort?: LiteratureSort,
        page?: number,
        options?: { force?: boolean }
    ) => Promise<void>;

    setFilter: (filter: Partial<LiteratureFilter>) => void;
    setSort: (sort: LiteratureSort) => void;
    setPage: (page: number) => void;
    clearSearch: () => void;

    // 👤 用户操作
    setCurrentUser: (userId: string) => Promise<void>;
    updateUserMeta: (literatureId: string, updates: Partial<UserLiteratureMetaCore>) => Promise<void>;
    getUserStatistics: (force?: boolean) => Promise<UserLiteratureStatistics>;

    // 🤖 推荐系统
    getRecommendations: (literatureId: string, force?: boolean) => Promise<RecommendationResult>;
    clearRecommendations: () => void;

    // 📊 统计和分析
    refreshStatistics: () => Promise<void>;
    getPerformanceMetrics: () => ReturnType<typeof enhancedLiteratureService.getPerformanceMetrics>;

    // 🎛️ 配置管理
    updatePreferences: (preferences: Partial<LiteratureStoreState['preferences']>) => void;

    // 🗄️ 缓存管理
    clearCache: () => void;
    refreshCache: () => Promise<void>;

    // 📱 离线支持
    enableOfflineMode: () => void;
    disableOfflineMode: () => void;
    syncOfflineChanges: () => Promise<void>;
}

/**
 * 🏪 增强版文献Store
 */
export const useEnhancedLiteratureStore = create<LiteratureStoreState>()(
    devtools(
        persist(
            subscribeWithSelector(
                immer((set, get) => ({
                    // ==================== 初始状态 ====================

                    literatures: new Map(),
                    literaturesList: [],
                    currentUserId: null,
                    userStatistics: null,
                    searchResults: null,
                    currentFilter: {},
                    currentSort: { field: 'createdAt', order: 'desc' },
                    currentPage: 1,
                    recommendations: new Map(),

                    loading: {
                        search: false,
                        create: false,
                        update: false,
                        delete: false,
                        recommendations: false,
                        statistics: false,
                    },

                    error: {
                        search: null,
                        create: null,
                        update: null,
                        delete: null,
                        recommendations: null,
                        statistics: null,
                    },

                    preferences: {
                        pageSize: LITERATURE_CONSTANTS.DEFAULT_PAGE_SIZE,
                        autoRefresh: false,
                        cacheEnabled: true,
                        offlineMode: false,
                    },

                    performance: {
                        lastUpdateTime: null,
                        operationCount: 0,
                        averageResponseTime: 0,
                        cacheHitRate: 0,
                    },

                    // ==================== 操作方法 ====================

                    /**
                     * 🔧 初始化Store
                     */
                    initialize: async (userId?: string) => {
                        try {
                            console.log('[EnhancedLiteratureStore] Initializing store...');

                            if (userId) {
                                await get().setCurrentUser(userId);
                            }

                            // 执行初始搜索
                            await get().searchLiterature();

                            console.log('[EnhancedLiteratureStore] Store initialized successfully');
                        } catch (error) {
                            console.error('[EnhancedLiteratureStore] Initialization failed:', error);
                            throw ErrorHandler.handle(error, {
                                operation: 'store.initialize',
                                layer: 'store',
                                userId,
                            });
                        }
                    },

                    /**
                     * 🧹 清理Store
                     */
                    cleanup: () => {
                        set((state) => {
                            state.literatures.clear();
                            state.literaturesList = [];
                            state.searchResults = null;
                            state.recommendations.clear();
                            state.userStatistics = null;
                            state.currentUserId = null;
                        });
                    },

                    /**
                     * ➕ 创建文献
                     */
                    createLiterature: async (input, options = {}) => {
                        const startTime = Date.now();

                        set((state) => {
                            state.loading.create = true;
                            state.error.create = null;
                        });

                        try {
                            const result = await enhancedLiteratureService.createLiterature(
                                input,
                                get().currentUserId || undefined,
                                options
                            );

                            set((state) => {
                                if (result.enhancedItem) {
                                    state.literatures.set(result.id, result.enhancedItem);
                                    state.literaturesList.unshift(result.enhancedItem);
                                }

                                state.loading.create = false;
                                state.performance.operationCount++;
                                state.performance.lastUpdateTime = new Date();

                                // 更新平均响应时间
                                const responseTime = Date.now() - startTime;
                                state.performance.averageResponseTime =
                                    (state.performance.averageResponseTime * (state.performance.operationCount - 1) + responseTime) /
                                    state.performance.operationCount;
                            });

                            // 刷新搜索结果
                            if (get().searchResults) {
                                await get().searchLiterature(get().currentFilter, get().currentSort, get().currentPage);
                            }

                            return result.id;
                        } catch (error) {
                            const errorMessage = error instanceof Error ? error.message : String(error);

                            set((state) => {
                                state.loading.create = false;
                                state.error.create = errorMessage;
                            });

                            throw error;
                        }
                    },

                    /**
                     * 📝 更新文献
                     */
                    updateLiterature: async (id, updates) => {
                        const startTime = Date.now();

                        set((state) => {
                            state.loading.update = true;
                            state.error.update = null;
                        });

                        try {
                            // TODO: 实现更新逻辑
                            // await enhancedLiteratureService.updateLiterature(id, updates);

                            set((state) => {
                                const existing = state.literatures.get(id);
                                if (existing) {
                                    const updated = { ...existing, ...updates, updatedAt: new Date() };
                                    state.literatures.set(id, updated);

                                    // 更新列表中的项目
                                    const listIndex = state.literaturesList.findIndex(item => item.lid === id);
                                    if (listIndex !== -1) {
                                        state.literaturesList[listIndex] = updated;
                                    }
                                }

                                state.loading.update = false;
                                state.performance.operationCount++;
                                state.performance.lastUpdateTime = new Date();

                                const responseTime = Date.now() - startTime;
                                state.performance.averageResponseTime =
                                    (state.performance.averageResponseTime * (state.performance.operationCount - 1) + responseTime) /
                                    state.performance.operationCount;
                            });
                        } catch (error) {
                            const errorMessage = error instanceof Error ? error.message : String(error);

                            set((state) => {
                                state.loading.update = false;
                                state.error.update = errorMessage;
                            });

                            throw error;
                        }
                    },

                    /**
                     * 🗑️ 删除文献
                     */
                    deleteLiterature: async (id) => {
                        set((state) => {
                            state.loading.delete = true;
                            state.error.delete = null;
                        });

                        try {
                            // TODO: 实现删除逻辑
                            // await enhancedLiteratureService.deleteLiterature(id);

                            set((state) => {
                                state.literatures.delete(id);
                                state.literaturesList = state.literaturesList.filter(item => item.lid !== id);
                                state.loading.delete = false;
                                state.performance.operationCount++;
                                state.performance.lastUpdateTime = new Date();
                            });

                            // 刷新搜索结果
                            if (get().searchResults) {
                                await get().searchLiterature(get().currentFilter, get().currentSort, get().currentPage);
                            }
                        } catch (error) {
                            const errorMessage = error instanceof Error ? error.message : String(error);

                            set((state) => {
                                state.loading.delete = false;
                                state.error.delete = errorMessage;
                            });

                            throw error;
                        }
                    },

                    /**
                     * 📦 批量导入文献
                     */
                    bulkImportLiterature: async (inputs) => {
                        set((state) => {
                            state.loading.create = true;
                            state.error.create = null;
                        });

                        try {
                            const result = await enhancedLiteratureService.bulkImportLiterature(
                                inputs,
                                get().currentUserId || undefined
                            );

                            set((state) => {
                                state.loading.create = false;
                                state.performance.operationCount++;
                                state.performance.lastUpdateTime = new Date();
                            });

                            // 刷新搜索结果
                            await get().searchLiterature(get().currentFilter, get().currentSort, 1);

                            console.log('[EnhancedLiteratureStore] Bulk import completed:', result);
                        } catch (error) {
                            const errorMessage = error instanceof Error ? error.message : String(error);

                            set((state) => {
                                state.loading.create = false;
                                state.error.create = errorMessage;
                            });

                            throw error;
                        }
                    },

                    /**
                     * 🔍 搜索文献
                     */
                    searchLiterature: async (filter, sort, page, options = {}) => {
                        const finalFilter = filter || get().currentFilter;
                        const finalSort = sort || get().currentSort;
                        const finalPage = page || get().currentPage;

                        set((state) => {
                            state.loading.search = true;
                            state.error.search = null;
                            state.currentFilter = finalFilter;
                            state.currentSort = finalSort;
                            state.currentPage = finalPage;
                        });

                        try {
                            const result = await enhancedLiteratureService.searchLiterature(
                                finalFilter,
                                finalSort,
                                finalPage,
                                get().preferences.pageSize,
                                get().currentUserId || undefined,
                                {
                                    includeFacets: true,
                                    includeRecommendations: false,
                                    enableSmartSuggestions: true,
                                }
                            );

                            set((state) => {
                                state.searchResults = result;
                                state.loading.search = false;
                                state.performance.operationCount++;
                                state.performance.lastUpdateTime = new Date();

                                // 更新本地缓存
                                for (const item of result.items) {
                                    state.literatures.set(item.lid, item);
                                }

                                // 更新列表（如果是第一页）
                                if (finalPage === 1) {
                                    state.literaturesList = result.items;
                                }
                            });
                        } catch (error) {
                            const errorMessage = error instanceof Error ? error.message : String(error);

                            set((state) => {
                                state.loading.search = false;
                                state.error.search = errorMessage;
                            });

                            throw error;
                        }
                    },

                    /**
                     * 🔧 设置过滤器
                     */
                    setFilter: (filter) => {
                        set((state) => {
                            state.currentFilter = { ...state.currentFilter, ...filter };
                            state.currentPage = 1; // 重置到第一页
                        });

                        // 自动搜索
                        get().searchLiterature();
                    },

                    /**
                     * 📈 设置排序
                     */
                    setSort: (sort) => {
                        set((state) => {
                            state.currentSort = sort;
                            state.currentPage = 1; // 重置到第一页
                        });

                        // 自动搜索
                        get().searchLiterature();
                    },

                    /**
                     * 📄 设置页码
                     */
                    setPage: (page) => {
                        set((state) => {
                            state.currentPage = page;
                        });

                        // 自动搜索
                        get().searchLiterature();
                    },

                    /**
                     * 🧹 清除搜索
                     */
                    clearSearch: () => {
                        set((state) => {
                            state.searchResults = null;
                            state.currentFilter = {};
                            state.currentSort = { field: 'createdAt', order: 'desc' };
                            state.currentPage = 1;
                        });
                    },

                    /**
                     * 👤 设置当前用户
                     */
                    setCurrentUser: async (userId) => {
                        set((state) => {
                            state.currentUserId = userId;
                            state.userStatistics = null;
                        });

                        // 获取用户统计
                        await get().getUserStatistics(true);
                    },

                    /**
                     * 📝 更新用户元数据
                     */
                    updateUserMeta: async (literatureId, updates) => {
                        const userId = get().currentUserId;
                        if (!userId) return;

                        try {
                            // TODO: 实现用户元数据更新
                            // await enhancedLiteratureService.updateUserMeta(userId, literatureId, updates);

                            set((state) => {
                                const item = state.literatures.get(literatureId);
                                if (item && item.userMeta) {
                                    item.userMeta = { ...item.userMeta, ...updates, updatedAt: new Date() };
                                }
                            });
                        } catch (error) {
                            throw ErrorHandler.handle(error, {
                                operation: 'store.updateUserMeta',
                                layer: 'store',
                                entityId: literatureId,
                                userId,
                            });
                        }
                    },

                    /**
                     * 📊 获取用户统计
                     */
                    getUserStatistics: async (force = false) => {
                        const userId = get().currentUserId;
                        if (!userId) throw new Error('No current user set');

                        if (!force && get().userStatistics) {
                            return get().userStatistics!;
                        }

                        set((state) => {
                            state.loading.statistics = true;
                            state.error.statistics = null;
                        });

                        try {
                            const statistics = await enhancedLiteratureService.getUserStatistics(userId);

                            set((state) => {
                                state.userStatistics = statistics;
                                state.loading.statistics = false;
                            });

                            return statistics;
                        } catch (error) {
                            const errorMessage = error instanceof Error ? error.message : String(error);

                            set((state) => {
                                state.loading.statistics = false;
                                state.error.statistics = errorMessage;
                            });

                            throw error;
                        }
                    },

                    /**
                     * 🤖 获取推荐
                     */
                    getRecommendations: async (literatureId, force = false) => {
                        const userId = get().currentUserId;
                        if (!userId) throw new Error('No current user set');

                        if (!force && get().recommendations.has(literatureId)) {
                            return get().recommendations.get(literatureId)!;
                        }

                        set((state) => {
                            state.loading.recommendations = true;
                            state.error.recommendations = null;
                        });

                        try {
                            const recommendations = await enhancedLiteratureService.generateRecommendations(
                                literatureId,
                                userId
                            );

                            set((state) => {
                                state.recommendations.set(literatureId, recommendations);
                                state.loading.recommendations = false;
                            });

                            return recommendations;
                        } catch (error) {
                            const errorMessage = error instanceof Error ? error.message : String(error);

                            set((state) => {
                                state.loading.recommendations = false;
                                state.error.recommendations = errorMessage;
                            });

                            throw error;
                        }
                    },

                    /**
                     * 🧹 清除推荐
                     */
                    clearRecommendations: () => {
                        set((state) => {
                            state.recommendations.clear();
                        });
                    },

                    /**
                     * 🔄 刷新统计
                     */
                    refreshStatistics: async () => {
                        if (get().currentUserId) {
                            await get().getUserStatistics(true);
                        }
                    },

                    /**
                     * 📊 获取性能指标
                     */
                    getPerformanceMetrics: () => {
                        const serviceMetrics = enhancedLiteratureService.getPerformanceMetrics();
                        const storeMetrics = get().performance;

                        return {
                            service: serviceMetrics,
                            store: storeMetrics,
                            combined: {
                                totalOperations: storeMetrics.operationCount,
                                averageResponseTime: storeMetrics.averageResponseTime,
                                cacheHitRate: serviceMetrics.cacheHitRate || 0,
                                lastUpdate: storeMetrics.lastUpdateTime,
                            },
                        };
                    },

                    /**
                     * ⚙️ 更新偏好设置
                     */
                    updatePreferences: (preferences) => {
                        set((state) => {
                            state.preferences = { ...state.preferences, ...preferences };
                        });
                    },

                    /**
                     * 🗄️ 清除缓存
                     */
                    clearCache: () => {
                        set((state) => {
                            state.literatures.clear();
                            state.literaturesList = [];
                            state.searchResults = null;
                            state.recommendations.clear();
                            state.userStatistics = null;
                        });
                    },

                    /**
                     * 🔄 刷新缓存
                     */
                    refreshCache: async () => {
                        get().clearCache();
                        await get().searchLiterature();

                        if (get().currentUserId) {
                            await get().getUserStatistics(true);
                        }
                    },

                    /**
                     * 📱 启用离线模式
                     */
                    enableOfflineMode: () => {
                        set((state) => {
                            state.preferences.offlineMode = true;
                        });
                    },

                    /**
                     * 🌐 禁用离线模式
                     */
                    disableOfflineMode: () => {
                        set((state) => {
                            state.preferences.offlineMode = false;
                        });
                    },

                    /**
                     * 🔄 同步离线更改
                     */
                    syncOfflineChanges: async () => {
                        // TODO: 实现离线同步逻辑
                        console.log('[EnhancedLiteratureStore] Syncing offline changes...');
                    },
                })),
            ),
            {
                name: 'enhanced-literature-store',
                partialize: (state) => ({
                    // 只持久化必要的状态
                    currentUserId: state.currentUserId,
                    preferences: state.preferences,
                    currentFilter: state.currentFilter,
                    currentSort: state.currentSort,
                }),
            }
        ),
        {
            name: 'enhanced-literature-store',
        }
    )
);

/**
 * 🎯 Store选择器 - 优化性能的选择器
 */
export const literatureStoreSelectors = {
    // 基础数据选择器
    literatures: (state: LiteratureStoreState) => state.literaturesList,
    searchResults: (state: LiteratureStoreState) => state.searchResults,
    currentUser: (state: LiteratureStoreState) => state.currentUserId,
    userStats: (state: LiteratureStoreState) => state.userStatistics,

    // 加载状态选择器
    isLoading: (state: LiteratureStoreState) => Object.values(state.loading).some(Boolean),
    isSearching: (state: LiteratureStoreState) => state.loading.search,
    isCreating: (state: LiteratureStoreState) => state.loading.create,

    // 错误状态选择器
    hasError: (state: LiteratureStoreState) => Object.values(state.error).some(Boolean),
    searchError: (state: LiteratureStoreState) => state.error.search,

    // 计算属性选择器
    totalLiteratures: (state: LiteratureStoreState) => state.searchResults?.pagination.total || 0,
    currentPage: (state: LiteratureStoreState) => state.currentPage,
    totalPages: (state: LiteratureStoreState) => state.searchResults?.pagination.totalPages || 0,

    // 过滤器选择器
    activeFilters: (state: LiteratureStoreState) => {
        const filter = state.currentFilter;
        return Object.entries(filter).filter(([_, value]) =>
            value !== undefined && value !== null &&
            (Array.isArray(value) ? value.length > 0 : true)
        ).length;
    },

    // 性能选择器
    performance: (state: LiteratureStoreState) => state.performance,
};

/**
 * 🎣 自定义Hooks - 便利的React hooks
 */
export const useLiteratureData = () => {
    const literatures = useEnhancedLiteratureStore(literatureStoreSelectors.literatures);
    const searchResults = useEnhancedLiteratureStore(literatureStoreSelectors.searchResults);
    const isLoading = useEnhancedLiteratureStore(literatureStoreSelectors.isLoading);
    const hasError = useEnhancedLiteratureStore(literatureStoreSelectors.hasError);

    return {
        literatures,
        searchResults,
        isLoading,
        hasError,
    };
};

export const useLiteratureActions = () => {
    const store = useEnhancedLiteratureStore();

    return {
        createLiterature: store.createLiterature,
        updateLiterature: store.updateLiterature,
        deleteLiterature: store.deleteLiterature,
        searchLiterature: store.searchLiterature,
        setFilter: store.setFilter,
        setSort: store.setSort,
        setPage: store.setPage,
    };
};

export const useLiteratureUser = () => {
    const currentUserId = useEnhancedLiteratureStore(literatureStoreSelectors.currentUser);
    const userStatistics = useEnhancedLiteratureStore(literatureStoreSelectors.userStats);
    const setCurrentUser = useEnhancedLiteratureStore(state => state.setCurrentUser);
    const updateUserMeta = useEnhancedLiteratureStore(state => state.updateUserMeta);

    return {
        currentUserId,
        userStatistics,
        setCurrentUser,
        updateUserMeta,
    };
};

export default useEnhancedLiteratureStore;
