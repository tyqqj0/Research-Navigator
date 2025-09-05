/**
 * 📂 Collection Operations Hook - 集合业务编排和UI状态管理
 * 
 * 🎯 核心职责：
 * 1. 管理集合相关的UI状态（loading、selection、error等）
 * 2. 编排集合业务逻辑（调用Service，更新Store）
 * 3. 组合Collection Store和Literature Store的数据
 * 4. 处理集合相关的用户交互逻辑
 * 
 * 架构定位：
 * - 专门处理集合相关的业务编排
 * - 连接Collection Store和Collection Service
 * - 为集合相关组件提供完整的数据和操作
 * - 管理集合相关的UI状态
 */

import { useState, useCallback, useMemo } from 'react';
import { useCollectionStore, useLiteratureStore } from '../stores';
import { collectionService } from '../services';
import type {
    Collection,
    CollectionType,
    EnhancedLibraryItem,
} from '../models';
import type {
    CreateCollectionInput,
    UpdateCollectionInput,
} from '../services/collection-service';

// ==================== Hook State Interfaces ====================

interface CollectionUIState {
    // 🔄 加载状态
    isLoading: boolean;
    isSearching: boolean;
    loadingIds: Set<string>;

    // 🎯 选择状态
    selectedIds: Set<string>;

    // 🎨 视图状态
    viewMode: 'list' | 'grid' | 'tree';
    expandedIds: Set<string>; // 用于树形视图

    // ❌ 错误状态
    error: string | null;
}

interface CollectionSearchState {
    query: string;
    results: Collection[];
    total: number;
    hasMore: boolean;
    filter: {
        type?: CollectionType;
        isPublic?: boolean;
        hasItems?: boolean;
    };
    page: number;
    pageSize: number;
}

// ==================== Hook Return Interface ====================

export interface UseCollectionOperationsReturn {
    // 📂 数据状态
    collections: Collection[];
    selectedCollections: Collection[];

    // 🔍 搜索状态
    searchState: CollectionSearchState;

    // 📊 UI状态
    uiState: CollectionUIState;

    // 📈 统计信息
    stats: {
        total: number;
        selected: number;
        byType: Record<CollectionType, number>;
        lastUpdated: Date | null;
    };

    // 🔧 基础操作
    setCurrentUser: (userId: string | null) => void;
    clearError: () => void;

    // 📂 集合操作
    createCollection: (input: CreateCollectionInput) => Promise<Collection>;
    updateCollection: (id: string, input: UpdateCollectionInput) => Promise<Collection>;
    deleteCollection: (id: string) => Promise<void>;

    // 📚 集合内容管理
    addLiteratureToCollection: (collectionId: string, literatureId: string) => Promise<void>;
    removeLiteratureFromCollection: (collectionId: string, literatureId: string) => Promise<void>;
    addLiteraturesToCollection: (collectionId: string, lids: string[]) => Promise<void>;
    removeLiteraturesFromCollection: (collectionId: string, lids: string[]) => Promise<void>;

    // 🔄 数据同步
    loadCollections: (userId: string, options?: { force?: boolean }) => Promise<void>;
    loadCollection: (id: string) => Promise<Collection | null>;
    refreshCollection: (id: string) => Promise<void>;

    // 🔍 搜索操作
    searchCollections: (query: string, options?: {
        filter?: CollectionSearchState['filter'];
        page?: number;
        pageSize?: number;
    }) => Promise<void>;
    clearSearch: () => void;
    loadMoreResults: () => Promise<void>;

    // 🎯 选择操作
    selectCollection: (id: string) => void;
    selectMultipleCollections: (ids: string[]) => void;
    deselectCollection: (id: string) => void;
    clearSelection: () => void;
    toggleSelection: (id: string) => void;
    selectAll: () => void;

    // 🎨 UI操作
    setViewMode: (mode: 'list' | 'grid' | 'tree') => void;
    expandCollection: (id: string) => void;
    collapseCollection: (id: string) => void;
    toggleExpansion: (id: string) => void;

    // 🏷️ 过滤操作
    setTypeFilter: (type: CollectionType | null) => void;
    setPublicFilter: (isPublic: boolean | null) => void;
    clearFilters: () => void;

    // 📊 数据查询辅助
    getCollection: (id: string) => Collection | undefined;
    getCollections: (ids: string[]) => Collection[];
    getCollectionWithLiteratures: (id: string) => {
        collection: Collection;
        literatures: EnhancedLibraryItem[];
    } | null;
    getFilteredCollections: () => Collection[];
}

// ==================== Hook Implementation ====================

export const useCollectionOperations = (): UseCollectionOperationsReturn => {
    // 📂 Store数据
    const collectionStore = useCollectionStore();
    const literatureStore = useLiteratureStore();

    // 📊 UI状态管理
    const [uiState, setUIState] = useState<CollectionUIState>({
        isLoading: false,
        isSearching: false,
        loadingIds: new Set(),
        selectedIds: new Set(),
        viewMode: 'list',
        expandedIds: new Set(),
        error: null,
    });

    // 🔍 搜索状态管理
    const [searchState, setSearchState] = useState<CollectionSearchState>({
        query: '',
        results: [],
        total: 0,
        hasMore: false,
        filter: {},
        page: 1,
        pageSize: 20,
    });

    // 📈 派生状态
    const stats = useMemo(() => {
        const collections = collectionStore.getAllCollections();
        const byType = collections.reduce((acc, collection) => {
            acc[collection.type] = (acc[collection.type] || 0) + 1;
            return acc;
        }, {} as Record<CollectionType, number>);

        return {
            total: collectionStore.stats.total,
            selected: uiState.selectedIds.size,
            byType,
            lastUpdated: collectionStore.stats.lastUpdated,
        };
    }, [collectionStore.stats, uiState.selectedIds.size]);

    const selectedCollections = useMemo(() => {
        return Array.from(uiState.selectedIds)
            .map(id => collectionStore.getCollection(id))
            .filter(Boolean) as Collection[];
    }, [uiState.selectedIds, collectionStore.collections]);

    // 🔧 基础操作
    const setCurrentUser = useCallback((userId: string | null) => {
        collectionStore.setCurrentUser(userId);
        // 清空UI状态
        setUIState(prev => ({
            ...prev,
            selectedIds: new Set(),
            expandedIds: new Set(),
            error: null,
        }));
        setSearchState(prev => ({
            ...prev,
            query: '',
            results: [],
            total: 0,
            hasMore: false,
            page: 1,
        }));
    }, [collectionStore]);

    const clearError = useCallback(() => {
        setUIState(prev => ({ ...prev, error: null }));
    }, []);

    // 📂 集合操作
    const createCollection = useCallback(async (input: CreateCollectionInput) => {
        if (!collectionStore.currentUserId) throw new Error('用户未登录');

        setUIState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            // Service层处理业务逻辑
            const collection = await collectionService.createCollection(collectionStore.currentUserId, input);

            // Store层更新数据
            collectionStore.addCollection(collection);

            setUIState(prev => ({ ...prev, isLoading: false }));
            return collection;
        } catch (error) {
            setUIState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : '创建集合失败',
                isLoading: false,
            }));
            throw error;
        }
    }, [collectionStore]);

    const updateCollection = useCallback(async (id: string, input: UpdateCollectionInput) => {
        if (!collectionStore.currentUserId) throw new Error('用户未登录');

        setUIState(prev => ({
            ...prev,
            loadingIds: new Set(prev.loadingIds).add(id),
            error: null,
        }));

        try {
            // Service层处理业务逻辑
            const collection = await collectionService.updateCollection(id, collectionStore.currentUserId, input);

            // Store层更新数据
            collectionStore.updateCollection(id, collection);

            setUIState(prev => {
                const newLoadingIds = new Set(prev.loadingIds);
                newLoadingIds.delete(id);
                return { ...prev, loadingIds: newLoadingIds };
            });

            return collection;
        } catch (error) {
            setUIState(prev => {
                const newLoadingIds = new Set(prev.loadingIds);
                newLoadingIds.delete(id);
                return {
                    ...prev,
                    error: error instanceof Error ? error.message : '更新集合失败',
                    loadingIds: newLoadingIds,
                };
            });
            throw error;
        }
    }, [collectionStore]);

    const deleteCollection = useCallback(async (id: string) => {
        if (!collectionStore.currentUserId) throw new Error('用户未登录');

        setUIState(prev => ({
            ...prev,
            loadingIds: new Set(prev.loadingIds).add(id),
            error: null,
        }));

        try {
            // Service层处理业务逻辑
            await collectionService.deleteCollection(id, collectionStore.currentUserId);

            // Store层更新数据
            collectionStore.removeCollection(id);

            // 更新UI状态
            setUIState(prev => {
                const newLoadingIds = new Set(prev.loadingIds);
                newLoadingIds.delete(id);
                const newSelectedIds = new Set(prev.selectedIds);
                newSelectedIds.delete(id);
                const newExpandedIds = new Set(prev.expandedIds);
                newExpandedIds.delete(id);
                return {
                    ...prev,
                    loadingIds: newLoadingIds,
                    selectedIds: newSelectedIds,
                    expandedIds: newExpandedIds,
                };
            });
        } catch (error) {
            setUIState(prev => {
                const newLoadingIds = new Set(prev.loadingIds);
                newLoadingIds.delete(id);
                return {
                    ...prev,
                    error: error instanceof Error ? error.message : '删除集合失败',
                    loadingIds: newLoadingIds,
                };
            });
            throw error;
        }
    }, [collectionStore]);

    // 📚 集合内容管理
    const addLiteratureToCollection = useCallback(async (collectionId: string, literatureId: string) => {
        if (!collectionStore.currentUserId) throw new Error('用户未登录');

        try {
            // Service层处理业务逻辑
            await collectionService.addItemsToCollection(collectionId, [literatureId], collectionStore.currentUserId);

            // Store层更新数据
            collectionStore.addLiteratureToCollection(collectionId, literatureId);
        } catch (error) {
            setUIState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : '添加文献失败',
            }));
            throw error;
        }
    }, [collectionStore]);

    const removeLiteratureFromCollection = useCallback(async (collectionId: string, literatureId: string) => {
        if (!collectionStore.currentUserId) throw new Error('用户未登录');

        try {
            // Service层处理业务逻辑
            await collectionService.removeItemsFromCollection(collectionId, [literatureId], collectionStore.currentUserId);

            // Store层更新数据
            collectionStore.removeLiteratureFromCollection(collectionId, literatureId);
        } catch (error) {
            setUIState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : '移除文献失败',
            }));
            throw error;
        }
    }, [collectionStore]);

    const addLiteraturesToCollection = useCallback(async (collectionId: string, lids: string[]) => {
        if (!collectionStore.currentUserId) throw new Error('用户未登录');

        try {
            // Service层处理业务逻辑
            await collectionService.addItemsToCollection(collectionId, lids, collectionStore.currentUserId);

            // Store层更新数据
            collectionStore.addLiteraturesToCollection(collectionId, lids);
        } catch (error) {
            setUIState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : '批量添加文献失败',
            }));
            throw error;
        }
    }, [collectionStore]);

    const removeLiteraturesFromCollection = useCallback(async (collectionId: string, lids: string[]) => {
        if (!collectionStore.currentUserId) throw new Error('用户未登录');

        try {
            // Service层处理业务逻辑
            await collectionService.removeItemsFromCollection(collectionId, lids, collectionStore.currentUserId);

            // Store层更新数据
            collectionStore.removeLiteraturesFromCollection(collectionId, lids);
        } catch (error) {
            setUIState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : '批量移除文献失败',
            }));
            throw error;
        }
    }, [collectionStore]);

    // 🔄 数据同步
    const loadCollections = useCallback(async (userId: string, options: { force?: boolean } = {}) => {
        const { force = false } = options;

        // 如果已有数据且不强制刷新，则跳过
        if (!force && collectionStore.stats.total > 0) return;

        setUIState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            // Service层获取数据
            const result = await collectionService.getUserCollections(userId);

            // Store层更新数据
            collectionStore.replaceCollections(result);

            setUIState(prev => ({ ...prev, isLoading: false }));
        } catch (error) {
            setUIState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : '加载集合失败',
                isLoading: false,
            }));
            throw error;
        }
    }, [collectionStore]);

    const loadCollection = useCallback(async (id: string) => {
        if (!collectionStore.currentUserId) throw new Error('用户未登录');

        setUIState(prev => ({
            ...prev,
            loadingIds: new Set(prev.loadingIds).add(id),
            error: null,
        }));

        try {
            // Service层获取数据
            const collection = await collectionService.getCollection(id, collectionStore.currentUserId);

            if (collection) {
                // Store层更新数据
                collectionStore.addCollection(collection);
            }

            setUIState(prev => {
                const newLoadingIds = new Set(prev.loadingIds);
                newLoadingIds.delete(id);
                return { ...prev, loadingIds: newLoadingIds };
            });

            return collection;
        } catch (error) {
            setUIState(prev => {
                const newLoadingIds = new Set(prev.loadingIds);
                newLoadingIds.delete(id);
                return {
                    ...prev,
                    error: error instanceof Error ? error.message : '加载集合失败',
                    loadingIds: newLoadingIds,
                };
            });
            return null;
        }
    }, [collectionStore]);

    const refreshCollection = useCallback(async (id: string) => {
        await loadCollection(id);
    }, [loadCollection]);

    // 🔍 搜索操作
    const searchCollections = useCallback(async (query: string, options: {
        filter?: CollectionSearchState['filter'];
        page?: number;
        pageSize?: number;
    } = {}) => {
        const {
            filter = {},
            page = 1,
            pageSize = 20,
        } = options;

        if (!collectionStore.currentUserId) return;

        setUIState(prev => ({ ...prev, isSearching: true, error: null }));
        setSearchState(prev => ({
            ...prev,
            query,
            filter,
            page,
            pageSize,
        }));

        try {
            // Service层处理搜索
            const result = await collectionService.searchCollections(collectionStore.currentUserId, {
                searchTerm: query,
                ...filter,
            });

            setSearchState(prev => ({
                ...prev,
                results: result.items,
                total: result.total,
                hasMore: result.hasMore,
            }));

            setUIState(prev => ({ ...prev, isSearching: false }));
        } catch (error) {
            setUIState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : '搜索集合失败',
                isSearching: false,
            }));
        }
    }, [collectionStore]);

    const clearSearch = useCallback(() => {
        setSearchState(prev => ({
            ...prev,
            query: '',
            results: [],
            total: 0,
            hasMore: false,
            page: 1,
        }));
    }, []);

    const loadMoreResults = useCallback(async () => {
        if (!collectionStore.currentUserId || !searchState.hasMore || uiState.isSearching) return;

        const nextPage = searchState.page + 1;

        setUIState(prev => ({ ...prev, isSearching: true }));

        try {
            // Service层处理分页搜索
            const result = await collectionService.searchCollections(collectionStore.currentUserId, {
                searchTerm: searchState.query,
                ...searchState.filter,
                page: nextPage,
                pageSize: searchState.pageSize,
            });

            setSearchState(prev => ({
                ...prev,
                results: [...prev.results, ...result.items],
                page: nextPage,
                hasMore: result.hasMore,
            }));

            setUIState(prev => ({ ...prev, isSearching: false }));
        } catch (error) {
            setUIState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : '加载更多失败',
                isSearching: false,
            }));
        }
    }, [collectionStore, searchState, uiState.isSearching]);

    // 🎯 选择操作
    const selectCollection = useCallback((id: string) => {
        setUIState(prev => ({
            ...prev,
            selectedIds: new Set(prev.selectedIds).add(id),
        }));
    }, []);

    const selectMultipleCollections = useCallback((ids: string[]) => {
        setUIState(prev => {
            const newSelectedIds = new Set(prev.selectedIds);
            ids.forEach(id => newSelectedIds.add(id));
            return { ...prev, selectedIds: newSelectedIds };
        });
    }, []);

    const deselectCollection = useCallback((id: string) => {
        setUIState(prev => {
            const newSelectedIds = new Set(prev.selectedIds);
            newSelectedIds.delete(id);
            return { ...prev, selectedIds: newSelectedIds };
        });
    }, []);

    const clearSelection = useCallback(() => {
        setUIState(prev => ({ ...prev, selectedIds: new Set() }));
    }, []);

    const toggleSelection = useCallback((id: string) => {
        setUIState(prev => {
            const newSelectedIds = new Set(prev.selectedIds);
            if (newSelectedIds.has(id)) {
                newSelectedIds.delete(id);
            } else {
                newSelectedIds.add(id);
            }
            return { ...prev, selectedIds: newSelectedIds };
        });
    }, []);

    const selectAll = useCallback(() => {
        const items = searchState.query ? searchState.results : collectionStore.getAllCollections();
        setUIState(prev => ({
            ...prev,
            selectedIds: new Set(items.map(item => item.id)),
        }));
    }, [searchState, collectionStore]);

    // 🎨 UI操作
    const setViewMode = useCallback((mode: 'list' | 'grid' | 'tree') => {
        setUIState(prev => ({ ...prev, viewMode: mode }));
    }, []);

    const expandCollection = useCallback((id: string) => {
        setUIState(prev => ({
            ...prev,
            expandedIds: new Set(prev.expandedIds).add(id),
        }));
    }, []);

    const collapseCollection = useCallback((id: string) => {
        setUIState(prev => {
            const newExpandedIds = new Set(prev.expandedIds);
            newExpandedIds.delete(id);
            return { ...prev, expandedIds: newExpandedIds };
        });
    }, []);

    const toggleExpansion = useCallback((id: string) => {
        setUIState(prev => {
            const newExpandedIds = new Set(prev.expandedIds);
            if (newExpandedIds.has(id)) {
                newExpandedIds.delete(id);
            } else {
                newExpandedIds.add(id);
            }
            return { ...prev, expandedIds: newExpandedIds };
        });
    }, []);

    // 🏷️ 过滤操作
    const setTypeFilter = useCallback((type: CollectionType | null) => {
        setSearchState(prev => ({
            ...prev,
            filter: { ...prev.filter, type: type || undefined },
        }));
    }, []);

    const setPublicFilter = useCallback((isPublic: boolean | null) => {
        setSearchState(prev => ({
            ...prev,
            filter: { ...prev.filter, isPublic: isPublic || undefined },
        }));
    }, []);

    const clearFilters = useCallback(() => {
        setSearchState(prev => ({
            ...prev,
            filter: {},
        }));
    }, []);

    // 📊 数据查询辅助
    const getCollection = useCallback((id: string) => {
        return collectionStore.getCollection(id);
    }, [collectionStore]);

    const getCollections = useCallback((ids: string[]) => {
        return collectionStore.getCollections(ids);
    }, [collectionStore]);

    const getCollectionWithLiteratures = useCallback((id: string) => {
        const collection = collectionStore.getCollection(id);
        if (!collection) return null;

        const literatures = literatureStore.getLiteratures(collection.lids);
        return { collection, literatures };
    }, [collectionStore, literatureStore]);

    const getFilteredCollections = useCallback(() => {
        const collections = collectionStore.getAllCollections();
        const { filter } = searchState;

        return collections.filter(collection => {
            if (filter.type && collection.type !== filter.type) {
                return false;
            }

            if (filter.isPublic !== undefined && collection.isPublic !== filter.isPublic) {
                return false;
            }

            if (filter.hasItems !== undefined) {
                const hasItems = collection.lids.length > 0;
                if (hasItems !== filter.hasItems) {
                    return false;
                }
            }

            return true;
        });
    }, [collectionStore, searchState.filter]);

    return {
        // 📂 数据状态
        collections: collectionStore.getAllCollections(),
        selectedCollections,

        // 🔍 搜索状态
        searchState,

        // 📊 UI状态
        uiState,

        // 📈 统计信息
        stats,

        // 🔧 基础操作
        setCurrentUser,
        clearError,

        // 📂 集合操作
        createCollection,
        updateCollection,
        deleteCollection,

        // 📚 集合内容管理
        addLiteratureToCollection,
        removeLiteratureFromCollection,
        addLiteraturesToCollection,
        removeLiteraturesFromCollection,

        // 🔄 数据同步
        loadCollections,
        loadCollection,
        refreshCollection,

        // 🔍 搜索操作
        searchCollections,
        clearSearch,
        loadMoreResults,

        // 🎯 选择操作
        selectCollection,
        selectMultipleCollections,
        deselectCollection,
        clearSelection,
        toggleSelection,
        selectAll,

        // 🎨 UI操作
        setViewMode,
        expandCollection,
        collapseCollection,
        toggleExpansion,

        // 🏷️ 过滤操作
        setTypeFilter,
        setPublicFilter,
        clearFilters,

        // 📊 数据查询辅助
        getCollection,
        getCollections,
        getCollectionWithLiteratures,
        getFilteredCollections,
    };
};

export default useCollectionOperations;


