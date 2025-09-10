/**
 * 📂 Collection Store - 纯粹的集合数据存储层
 * 
 * 🎯 核心职责：
 * 1. 存储规范化的集合数据（唯一数据源）
 * 2. 提供原子化的数据操作（同步CRUD）
 * 3. 提供简单的数据查询（基础选择器）
 * 
 * ❌ 不负责的事情：
 * - UI状态管理（loading、selection、viewMode等）
 * - 业务逻辑编排（搜索、过滤等）
 * - API调用和错误处理
 * - 复杂的数据组合和计算
 * 
 * 架构定位：
 * - 专门管理集合数据的"仓库"
 * - 与Literature Store独立，各司其职
 * - Hook层负责组合和业务编排
 */

import { create } from 'zustand';
import { subscribeWithSelector, devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { Collection } from '../models';

// ==================== Store State Interface ====================

export interface CollectionStoreState {
    // 📂 核心数据 - 规范化存储（Record提供快速访问）
    collections: Record<string, Collection>;

    // 📊 简单统计
    stats: {
        total: number;
        lastUpdated: Date | null;
    };
}

// ==================== Store Actions Interface ====================

export interface CollectionStoreActions {
    // 📂 数据操作 - 原子化的同步操作
    addCollection: (collection: Collection) => void;
    addCollections: (collections: Collection[]) => void;
    updateCollection: (id: string, collection: Collection) => void;
    removeCollection: (id: string) => void;
    removeCollections: (ids: string[]) => void;
    clearCollections: () => void;
    replaceCollections: (collections: Collection[]) => void;

    // 📚 集合内容管理 - 原子操作
    addLiteratureToCollection: (collectionId: string, literatureId: string) => void;
    removeLiteratureFromCollection: (collectionId: string, literatureId: string) => void;
    addLiteraturesToCollection: (collectionId: string, lids: string[]) => void;
    removeLiteraturesFromCollection: (collectionId: string, lids: string[]) => void;

    // 📊 数据查询 - 简单的选择器
    getCollection: (id: string) => Collection | undefined;
    getAllCollections: () => Collection[];
    getCollections: (ids: string[]) => Collection[];
    hasCollection: (id: string) => boolean;
    getCollectionsByType: (type: Collection['type']) => Collection[];

    // 📈 统计更新
    updateStats: () => void;
}

// ==================== Initial State ====================

const initialState: CollectionStoreState = {
    collections: {},
    stats: {
        total: 0,
        lastUpdated: null,
    },
};

// ==================== Store Implementation ====================

export const useCollectionStore = create<CollectionStoreState & CollectionStoreActions>()(
    devtools(
        subscribeWithSelector(
            immer((set, get) => ({
                ...initialState,

                // 📂 数据操作 - 原子化操作
                addCollection: (collection) => {
                    set((state) => {
                        state.collections[collection.id] = collection;
                    });
                    get().updateStats();
                },

                addCollections: (collections) => {
                    set((state) => {
                        collections.forEach(collection => {
                            state.collections[collection.id] = collection;
                        });
                    });
                    get().updateStats();
                },

                updateCollection: (id, collection) => {
                    set((state) => {
                        if (state.collections[id]) {
                            state.collections[id] = collection;
                        }
                    });
                    get().updateStats();
                },

                removeCollection: (id) => {
                    set((state) => {
                        delete state.collections[id];
                    });
                    get().updateStats();
                },

                removeCollections: (ids) => {
                    set((state) => {
                        ids.forEach(id => delete state.collections[id]);
                    });
                    get().updateStats();
                },

                clearCollections: () => {
                    set((state) => {
                        state.collections = {};
                    });
                    get().updateStats();
                },

                replaceCollections: (collections) => {
                    set((state) => {
                        state.collections = {};
                        collections.forEach(collection => {
                            state.collections[collection.id] = collection;
                        });
                    });
                    get().updateStats();
                },

                // 📚 集合内容管理 - 原子操作
                addLiteratureToCollection: (collectionId, literatureId) => {
                    set((state) => {
                        const collection = state.collections[collectionId];
                        if (collection && !collection.lids.includes(literatureId)) {
                            collection.lids.push(literatureId);
                            collection.updatedAt = new Date();
                        }
                    });
                },

                removeLiteratureFromCollection: (collectionId, literatureId) => {
                    set((state) => {
                        const collection = state.collections[collectionId];
                        if (collection) {
                            const index = collection.lids.indexOf(literatureId);
                            if (index !== -1) {
                                collection.lids.splice(index, 1);
                                collection.updatedAt = new Date();
                            }
                        }
                    });
                },

                addLiteraturesToCollection: (collectionId, lids) => {
                    set((state) => {
                        const collection = state.collections[collectionId];
                        if (collection) {
                            lids.forEach(literatureId => {
                                if (!collection.lids.includes(literatureId)) {
                                    collection.lids.push(literatureId);
                                }
                            });
                            collection.updatedAt = new Date();
                        }
                    });
                },

                removeLiteraturesFromCollection: (collectionId, lids) => {
                    set((state) => {
                        const collection = state.collections[collectionId];
                        if (collection) {
                            collection.lids = collection.lids.filter(
                                (paperId: string) => !lids.includes(paperId)
                            );
                            collection.updatedAt = new Date();
                        }
                    });
                },

                // 📊 数据查询 - 简单选择器
                getCollection: (id) => {
                    return get().collections[id];
                },

                getAllCollections: () => {
                    return Object.values(get().collections);
                },

                getCollections: (ids) => {
                    const { collections } = get();
                    return ids
                        .map(id => collections[id])
                        .filter(Boolean) as Collection[];
                },

                hasCollection: (id) => {
                    return !!get().collections[id];
                },

                getCollectionsByType: (type) => {
                    const { collections } = get();
                    return Object.values(collections).filter(collection => collection.type === type);
                },

                // 📈 统计更新
                updateStats: () => {
                    set((state) => {
                        state.stats.total = Object.keys(state.collections).length;
                        state.stats.lastUpdated = new Date();
                    });
                },
            }))
        ),
        {
            name: 'collection-store',
            // 数据不持久化，每次重新加载
            partialize: () => ({}),
        }
    )
);

// ==================== Selectors ====================

// 📂 基础数据选择器
export const selectAllCollections = (state: CollectionStoreState & CollectionStoreActions) =>
    state.getAllCollections();

export const selectCollectionById = (id: string) =>
    (state: CollectionStoreState & CollectionStoreActions) =>
        state.getCollection(id);

export const selectCollectionCount = (state: CollectionStoreState & CollectionStoreActions) =>
    state.stats.total;

export const selectCollectionsByType = (type: Collection['type']) =>
    (state: CollectionStoreState & CollectionStoreActions) =>
        state.getCollectionsByType(type);

// 用户相关选择器已移除，在Hook层处理

// 📊 统计选择器
export const selectStats = (state: CollectionStoreState & CollectionStoreActions) =>
    state.stats;

// ==================== 默认导出 ====================

export default useCollectionStore;