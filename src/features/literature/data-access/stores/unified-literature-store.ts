/**
 * 🏪 Unified Literature Store - 统一文献状态管理
 * 
 * 设计原则:
 * 1. 只暴露组合后的数据 - 对外隐藏数据组合复杂性
 * 2. 空文献支持 - 支持临时文献和自动解析
 * 3. 统一数据源 - 所有组件只从这里获取数据
 * 4. 响应式更新 - 自动同步UI状态
 * 5. 性能优化 - 智能缓存和批量操作
 */

import { create } from 'zustand';
import { subscribeWithSelector, devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import {
    EnhancedLiteratureItem,
    LibraryItemCore,
    UserLiteratureMetaCore,
    LiteratureFilter,
    LiteratureSort,
    PaginatedResult,
    ErrorHandler,
} from '../models';
import { compositionService, CompositionOptions } from '../services/composition-service';

/**
 * 🎯 统一Store状态接口
 */
export interface UnifiedLiteratureStoreState {
    // ==================== 核心数据 ====================

    // 📚 组合后的文献数据 - 这是唯一对外暴露的数据源
    literatures: Map<string, EnhancedLiteratureItem>;

    // 👤 当前用户
    currentUserId: string | null;

    // 🔍 搜索和过滤状态
    searchResults: {
        items: EnhancedLiteratureItem[];
        total: number;
        hasMore: boolean;
        query: string;
        filter: LiteratureFilter;
        sort: LiteratureSort;
    } | null;

    // 📊 UI状态
    loading: {
        global: boolean;
        search: boolean;
        create: boolean;
        update: boolean;
        delete: boolean;
        parse: boolean; // 解析URL/文件的状态
    };

    error: {
        global: string | null;
        search: string | null;
        create: string | null;
        update: string | null;
        delete: string | null;
        parse: string | null;
    };

    // 🎛️ 配置
    preferences: {
        autoParseUrls: boolean; // 自动解析URL
        batchSize: number;
        cacheEnabled: boolean;
    };

    // ==================== 核心操作 ====================

    // 🔧 初始化
    initialize: (userId?: string) => Promise<void>;
    setCurrentUser: (userId: string | null) => void;

    // 📚 文献操作 - 只操作组合后的数据
    getLiterature: (lid: string) => EnhancedLiteratureItem | null;
    getAllLiteratures: () => EnhancedLiteratureItem[];
    getUserLiteratures: (userId?: string) => EnhancedLiteratureItem[];

    // ✨ 创建文献 - 支持空文献
    createLiterature: (input: {
        title?: string;
        url?: string;
        authors?: string[];
        autoParseUrl?: boolean;
    }) => Promise<EnhancedLiteratureItem>;

    // 📝 更新文献
    updateLiterature: (lid: string, updates: Partial<LibraryItemCore>) => Promise<void>;

    // 🏷️ 更新用户元数据
    updateUserMeta: (lid: string, updates: Partial<UserLiteratureMetaCore>) => Promise<void>;

    // 🗑️ 删除文献
    deleteLiterature: (lid: string) => Promise<void>;

    // 🔍 搜索和过滤
    search: (query: string, filter?: LiteratureFilter, sort?: LiteratureSort) => Promise<void>;
    clearSearch: () => void;

    // 🔄 数据同步
    refresh: (lids?: string[]) => Promise<void>;
    refreshAll: () => Promise<void>;

    // 🧹 清理
    cleanup: () => void;
}

/**
 * 🏪 创建统一文献Store
 */
export const useUnifiedLiteratureStore = create<UnifiedLiteratureStoreState>()(
    devtools(
        subscribeWithSelector(
            immer((set, get) => ({
                // ==================== 初始状态 ====================

                literatures: new Map(),
                currentUserId: null,
                searchResults: null,

                loading: {
                    global: false,
                    search: false,
                    create: false,
                    update: false,
                    delete: false,
                    parse: false,
                },

                error: {
                    global: null,
                    search: null,
                    create: null,
                    update: null,
                    delete: null,
                    parse: null,
                },

                preferences: {
                    autoParseUrls: true,
                    batchSize: 50,
                    cacheEnabled: true,
                },

                // ==================== 实现方法 ====================

                /**
                 * 🔧 初始化Store
                 */
                initialize: async (userId?: string) => {
                    set(state => {
                        state.loading.global = true;
                        state.error.global = null;
                    });

                    try {
                        if (userId) {
                            set(state => {
                                state.currentUserId = userId;
                            });

                            // 加载用户的所有文献
                            const userLiteratures = await compositionService.composeForUser(userId, {
                                includeUserMeta: true,
                                includeCitationStats: true,
                            });

                            set(state => {
                                state.literatures.clear();
                                userLiteratures.forEach(lit => {
                                    state.literatures.set(lit.lid, lit);
                                });
                            });
                        }
                    } catch (error) {
                        set(state => {
                            state.error.global = ErrorHandler.handle(error, {
                                operation: 'store.initialize',
                                layer: 'store',
                                userId,
                            });
                        });
                    } finally {
                        set(state => {
                            state.loading.global = false;
                        });
                    }
                },

                /**
                 * 👤 设置当前用户
                 */
                setCurrentUser: (userId: string | null) => {
                    set(state => {
                        state.currentUserId = userId;
                    });

                    // 如果切换用户，重新初始化
                    if (userId) {
                        get().initialize(userId);
                    } else {
                        set(state => {
                            state.literatures.clear();
                        });
                    }
                },

                /**
                 * 📚 获取单个文献
                 */
                getLiterature: (lid: string) => {
                    return get().literatures.get(lid) || null;
                },

                /**
                 * 📚 获取所有文献
                 */
                getAllLiteratures: () => {
                    return Array.from(get().literatures.values());
                },

                /**
                 * 📚 获取用户文献
                 */
                getUserLiteratures: (userId?: string) => {
                    const targetUserId = userId || get().currentUserId;
                    if (!targetUserId) return [];

                    return Array.from(get().literatures.values())
                        .filter(lit => lit.userMeta?.userId === targetUserId);
                },

                /**
                 * ✨ 创建文献 - 支持空文献
                 */
                createLiterature: async (input) => {
                    set(state => {
                        state.loading.create = true;
                        state.error.create = null;
                    });

                    try {
                        const { currentUserId } = get();

                        // 创建空文献
                        const newLiterature = await compositionService.createEmptyLiterature({
                            ...input,
                            userId: currentUserId || undefined,
                        });

                        // 添加到Store
                        set(state => {
                            state.literatures.set(newLiterature.lid, newLiterature);
                        });

                        // 如果提供了URL且启用自动解析，触发解析
                        if (input.url && input.autoParseUrl !== false && get().preferences.autoParseUrls) {
                            // 异步解析，不阻塞返回
                            get().parseUrl(newLiterature.lid, input.url);
                        }

                        return newLiterature;
                    } catch (error) {
                        const { currentUserId } = get();
                        set(state => {
                            state.error.create = ErrorHandler.handle(error, {
                                operation: 'store.createLiterature',
                                layer: 'store',
                                userId: currentUserId || undefined,
                            });
                        });
                        throw error;
                    } finally {
                        set(state => {
                            state.loading.create = false;
                        });
                    }
                },

                /**
                 * 📝 更新文献
                 */
                updateLiterature: async (lid: string, updates: Partial<LibraryItemCore>) => {
                    set(state => {
                        state.loading.update = true;
                        state.error.update = null;
                    });

                    try {
                        // 如果是空文献，使用填充方法
                        const existingLit = get().literatures.get(lid);
                        if (existingLit?.status === 'empty' || existingLit?.status === 'draft') {
                            const updatedLit = await compositionService.fillEmptyLiterature(lid, updates);
                            if (updatedLit) {
                                set(state => {
                                    state.literatures.set(lid, updatedLit);
                                });
                            }
                        } else {
                            // 常规更新
                            // 这里需要调用repository的update方法，然后重新组合数据
                            // 简化实现，实际需要调用具体的repository
                            const updatedLit = await compositionService.composeSingle(lid, {
                                userId: get().currentUserId || undefined,
                                includeUserMeta: true,
                                includeCitationStats: true,
                            });

                            if (updatedLit) {
                                set(state => {
                                    state.literatures.set(lid, updatedLit);
                                });
                            }
                        }
                    } catch (error) {
                        set(state => {
                            state.error.update = ErrorHandler.handle(error, {
                                operation: 'store.updateLiterature',
                                layer: 'store',
                                userId: get().currentUserId || undefined,
                            });
                        });
                        throw error;
                    } finally {
                        set(state => {
                            state.loading.update = false;
                        });
                    }
                },

                /**
                 * 🏷️ 更新用户元数据
                 */
                updateUserMeta: async (lid: string, updates: Partial<UserLiteratureMetaCore>) => {
                    try {
                        const { currentUserId } = get();
                        if (!currentUserId) return;

                        // 更新用户元数据 (需要调用具体的repository)
                        // 简化实现

                        // 重新组合数据
                        const updatedLit = await compositionService.composeSingle(lid, {
                            userId: currentUserId,
                            includeUserMeta: true,
                            includeCitationStats: true,
                        });

                        if (updatedLit) {
                            set(state => {
                                state.literatures.set(lid, updatedLit);
                            });
                        }
                    } catch (error) {
                        ErrorHandler.handle(error, {
                            operation: 'store.updateUserMeta',
                            layer: 'store',
                            userId: get().currentUserId || undefined,
                        });
                        throw error;
                    }
                },

                /**
                 * 🗑️ 删除文献
                 */
                deleteLiterature: async (lid: string) => {
                    set(state => {
                        state.loading.delete = true;
                        state.error.delete = null;
                    });

                    try {
                        // 调用repository删除 (简化实现)

                        // 从Store中移除
                        set(state => {
                            state.literatures.delete(lid);
                        });
                    } catch (error) {
                        set(state => {
                            state.error.delete = ErrorHandler.handle(error, {
                                operation: 'store.deleteLiterature',
                                layer: 'store',
                                userId: get().currentUserId || undefined,
                            });
                        });
                        throw error;
                    } finally {
                        set(state => {
                            state.loading.delete = false;
                        });
                    }
                },

                /**
                 * 🔍 搜索文献
                 */
                search: async (query: string, filter?: LiteratureFilter, sort?: LiteratureSort) => {
                    set(state => {
                        state.loading.search = true;
                        state.error.search = null;
                    });

                    try {
                        // 这里需要调用搜索服务
                        // 简化实现：从当前数据中过滤
                        const allLiteratures = Array.from(get().literatures.values());
                        const filteredResults = allLiteratures.filter(lit =>
                            lit.title.toLowerCase().includes(query.toLowerCase()) ||
                            lit.authors.some(author => author.toLowerCase().includes(query.toLowerCase()))
                        );

                        set(state => {
                            state.searchResults = {
                                items: filteredResults,
                                total: filteredResults.length,
                                hasMore: false,
                                query,
                                filter: filter || {},
                                sort: sort || { field: 'createdAt', order: 'desc' },
                            };
                        });
                    } catch (error) {
                        set(state => {
                            state.error.search = ErrorHandler.handle(error, {
                                operation: 'store.search',
                                layer: 'store',
                                userId: get().currentUserId || undefined,
                            });
                        });
                    } finally {
                        set(state => {
                            state.loading.search = false;
                        });
                    }
                },

                /**
                 * 🔍 清除搜索
                 */
                clearSearch: () => {
                    set(state => {
                        state.searchResults = null;
                    });
                },

                /**
                 * 🔄 刷新数据
                 */
                refresh: async (lids?: string[]) => {
                    try {
                        const { currentUserId } = get();
                        if (!currentUserId) return;

                        if (lids) {
                            // 刷新指定文献
                            const refreshedLiteratures = await compositionService.composeBatch(lids, {
                                userId: currentUserId,
                                includeUserMeta: true,
                                includeCitationStats: true,
                            });

                            set(state => {
                                refreshedLiteratures.forEach(lit => {
                                    state.literatures.set(lit.lid, lit);
                                });
                            });
                        } else {
                            // 刷新所有数据
                            await get().refreshAll();
                        }
                    } catch (error) {
                        ErrorHandler.handle(error, {
                            operation: 'store.refresh',
                            layer: 'store',
                            userId: get().currentUserId || undefined,
                        });
                    }
                },

                /**
                 * 🔄 刷新所有数据
                 */
                refreshAll: async () => {
                    const { currentUserId } = get();
                    if (currentUserId) {
                        await get().initialize(currentUserId);
                    }
                },

                /**
                 * 🧹 清理Store
                 */
                cleanup: () => {
                    set(state => {
                        state.literatures.clear();
                        state.currentUserId = null;
                        state.searchResults = null;
                        state.loading = {
                            global: false,
                            search: false,
                            create: false,
                            update: false,
                            delete: false,
                            parse: false,
                        };
                        state.error = {
                            global: null,
                            search: null,
                            create: null,
                            update: null,
                            delete: null,
                            parse: null,
                        };
                    });
                },

                // ==================== 私有辅助方法 ====================

                /**
                 * 🔗 解析URL (私有方法)
                 */
                parseUrl: async (lid: string, url: string) => {
                    set(state => {
                        state.loading.parse = true;
                        state.error.parse = null;
                    });

                    try {
                        // 这里调用后端API解析URL
                        // 简化实现：模拟解析过程

                        // 解析完成后，更新文献数据
                        const parsedData = {
                            // 模拟解析结果
                            title: 'Parsed Title from URL',
                            authors: ['Parsed Author'],
                            abstract: 'Parsed abstract...',
                            status: 'active' as const,
                        };

                        await get().updateLiterature(lid, parsedData);
                    } catch (error) {
                        set(state => {
                            state.error.parse = ErrorHandler.handle(error, {
                                operation: 'store.parseUrl',
                                layer: 'store',
                                userId: get().currentUserId || undefined,
                            });
                        });
                    } finally {
                        set(state => {
                            state.loading.parse = false;
                        });
                    }
                },
            }))
        ),
        {
            name: 'unified-literature-store',
        }
    )
);

// 导出类型
export type { EnhancedLiteratureItem };
