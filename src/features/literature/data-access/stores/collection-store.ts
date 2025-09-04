/**
 * 📂 Collection Store - 集合数据的统一事实来源
 * 
 * 设计原则:
 * 1. 单一事实来源：所有集合数据都从这里获取
 * 2. 原子化操作：只处理最基础的CRUD操作
 * 3. 响应式状态：使用Zustand管理状态变化
 * 4. 类型安全：严格的TypeScript类型定义
 * 
 * 架构理念:
 * - Store层只管理数据状态，不做业务逻辑
 * - 所有数据变更都通过actions进行
 * - 提供细粒度的selector方便组件订阅
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import {
    Collection,
    CollectionUIConfig,
    CollectionStats,
    CreateCollectionInput,
    UpdateCollectionInput,
    CollectionQuery,
    CollectionType
} from '../models';

// ==================== Store State ====================

export interface CollectionStoreState {
    // 📚 核心数据
    collections: Record<string, Collection>;

    // 🎨 UI配置数据
    uiConfigs: Record<string, CollectionUIConfig>;

    // 📊 统计数据
    stats: Record<string, CollectionStats>;

    // 🔄 加载状态
    loading: {
        fetch: boolean;
        create: boolean;
        update: boolean;
        delete: boolean;
    };

    // ❌ 错误状态
    error: string | null;

    // 📱 选择状态
    selectedCollectionId: string | null;

    // 🔍 查询状态
    lastQuery: CollectionQuery | null;
    queryResults: string[]; // collection IDs
}

// ==================== Store Actions ====================

export interface CollectionStoreActions {
    // 📚 基础CRUD操作
    setCollections: (collections: Collection[]) => void;
    addCollection: (collection: Collection) => void;
    updateCollection: (id: string, updates: Partial<Collection>) => void;
    removeCollection: (id: string) => void;

    // 🎨 UI配置管理
    setUIConfig: (config: CollectionUIConfig) => void;
    updateUIConfig: (collectionId: string, updates: Partial<CollectionUIConfig>) => void;

    // 📊 统计数据管理
    setStats: (stats: CollectionStats) => void;
    updateStats: (collectionId: string, stats: Partial<CollectionStats>) => void;

    // 🔄 状态管理
    setLoading: (key: keyof CollectionStoreState['loading'], loading: boolean) => void;
    setError: (error: string | null) => void;

    // 📱 选择管理
    selectCollection: (id: string | null) => void;

    // 🔍 查询管理
    setQueryResults: (query: CollectionQuery, results: string[]) => void;
    clearQuery: () => void;

    // 🧹 清理操作
    reset: () => void;
}

// ==================== Initial State ====================

const initialState: CollectionStoreState = {
    collections: {},
    uiConfigs: {},
    stats: {},
    loading: {
        fetch: false,
        create: false,
        update: false,
        delete: false,
    },
    error: null,
    selectedCollectionId: null,
    lastQuery: null,
    queryResults: [],
};

// ==================== Store Implementation ====================

export const useCollectionStore = create<CollectionStoreState & CollectionStoreActions>()(
    subscribeWithSelector(
        immer((set, get) => ({
            ...initialState,

            // ==================== 基础CRUD操作 ====================

            setCollections: (collections) =>
                set((state) => {
                    state.collections = {};
                    collections.forEach((collection) => {
                        state.collections[collection.id] = collection;
                    });
                }),

            addCollection: (collection) =>
                set((state) => {
                    state.collections[collection.id] = collection;
                }),

            updateCollection: (id, updates) =>
                set((state) => {
                    if (state.collections[id]) {
                        Object.assign(state.collections[id], {
                            ...updates,
                            updatedAt: new Date(),
                        });
                    }
                }),

            removeCollection: (id) =>
                set((state) => {
                    delete state.collections[id];
                    delete state.uiConfigs[id];
                    delete state.stats[id];

                    // 如果删除的是当前选中的集合，清除选择
                    if (state.selectedCollectionId === id) {
                        state.selectedCollectionId = null;
                    }

                    // 从查询结果中移除
                    state.queryResults = state.queryResults.filter(cid => cid !== id);
                }),

            // ==================== UI配置管理 ====================

            setUIConfig: (config) =>
                set((state) => {
                    state.uiConfigs[config.collectionId] = config;
                }),

            updateUIConfig: (collectionId, updates) =>
                set((state) => {
                    if (state.uiConfigs[collectionId]) {
                        Object.assign(state.uiConfigs[collectionId], {
                            ...updates,
                            updatedAt: new Date(),
                        });
                    } else {
                        // 创建默认UI配置
                        state.uiConfigs[collectionId] = {
                            collectionId,
                            sortBy: 'addedAt',
                            sortOrder: 'desc',
                            viewMode: 'list',
                            notifyOnUpdate: false,
                            updatedAt: new Date(),
                            ...updates,
                        };
                    }
                }),

            // ==================== 统计数据管理 ====================

            setStats: (stats) =>
                set((state) => {
                    state.stats[stats.collectionId] = stats;
                }),

            updateStats: (collectionId, statsUpdates) =>
                set((state) => {
                    if (state.stats[collectionId]) {
                        Object.assign(state.stats[collectionId], {
                            ...statsUpdates,
                            calculatedAt: new Date(),
                        });
                    } else {
                        // 创建默认统计
                        state.stats[collectionId] = {
                            collectionId,
                            itemCount: 0,
                            sourceDistribution: {},
                            yearDistribution: {},
                            calculatedAt: new Date(),
                            ...statsUpdates,
                        };
                    }
                }),

            // ==================== 状态管理 ====================

            setLoading: (key, loading) =>
                set((state) => {
                    state.loading[key] = loading;
                }),

            setError: (error) =>
                set((state) => {
                    state.error = error;
                }),

            // ==================== 选择管理 ====================

            selectCollection: (id) =>
                set((state) => {
                    state.selectedCollectionId = id;
                }),

            // ==================== 查询管理 ====================

            setQueryResults: (query, results) =>
                set((state) => {
                    state.lastQuery = query;
                    state.queryResults = results;
                }),

            clearQuery: () =>
                set((state) => {
                    state.lastQuery = null;
                    state.queryResults = [];
                }),

            // ==================== 清理操作 ====================

            reset: () =>
                set((state) => {
                    Object.assign(state, initialState);
                }),
        }))
    )
);

// ==================== Selectors ====================

// 🎯 基础选择器
export const collectionSelectors = {
    // 获取所有集合
    all: (state: CollectionStoreState) => Object.values(state.collections),

    // 根据ID获取集合
    byId: (state: CollectionStoreState, id: string) => state.collections[id],

    // 获取集合数量
    count: (state: CollectionStoreState) => Object.keys(state.collections).length,

    // 根据类型获取集合
    byType: (state: CollectionStoreState, type: CollectionType) =>
        Object.values(state.collections).filter(c => c.type === type),

    // 根据所有者获取集合
    byOwner: (state: CollectionStoreState, ownerId: string) =>
        Object.values(state.collections).filter(c => c.ownerId === ownerId),

    // 获取公开集合
    public: (state: CollectionStoreState) =>
        Object.values(state.collections).filter(c => c.isPublic),

    // 获取未归档集合
    active: (state: CollectionStoreState) =>
        Object.values(state.collections).filter(c => !c.isArchived),

    // 获取根集合（无父级）
    roots: (state: CollectionStoreState) =>
        Object.values(state.collections).filter(c => !c.parentId),

    // 获取子集合
    children: (state: CollectionStoreState, parentId: string) =>
        Object.values(state.collections).filter(c => c.parentId === parentId),
};

// 🎨 UI配置选择器
export const uiConfigSelectors = {
    byCollectionId: (state: CollectionStoreState, collectionId: string) =>
        state.uiConfigs[collectionId],
};

// 📊 统计选择器
export const statsSelectors = {
    byCollectionId: (state: CollectionStoreState, collectionId: string) =>
        state.stats[collectionId],
};

// 🔄 状态选择器
export const loadingSelectors = {
    any: (state: CollectionStoreState) => Object.values(state.loading).some(Boolean),
    specific: (state: CollectionStoreState, key: keyof CollectionStoreState['loading']) =>
        state.loading[key],
};

// ==================== 类型导出 ====================

export type CollectionStore = CollectionStoreState & CollectionStoreActions;
