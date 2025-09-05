/**
 * 📂 Collection Hooks - 集合数据的组合Hooks
 * 
 * 设计原则:
 * 1. 数据组合：将Store数据与Service逻辑组合
 * 2. 响应式：提供响应式的数据和操作
 * 3. 类型安全：完整的TypeScript支持
 * 4. 错误处理：统一的错误处理机制
 * 
 * 架构职责:
 * - Hook层负责数据组合和状态管理
 * - 连接Store层（数据）和Service层（业务逻辑）
 * - 提供组件友好的API接口
 * - 处理loading状态和错误状态
 */

import { useCallback, useEffect, useMemo } from 'react';
import { shallow } from 'zustand/shallow';
import {
    useCollectionStore,
    collectionSelectors,
    uiConfigSelectors,
    statsSelectors,
    loadingSelectors,
} from '../stores/collection-store';
import { collectionService } from '../services/collection-service-refactored';
import {
    Collection,
    CollectionType,
    CollectionUIConfig,
    CollectionStats,
    CreateCollectionInput,
    UpdateCollectionInput,
    CollectionQuery,
    CollectionSort,
} from '../models';

// ==================== 基础集合Hook ====================

/**
 * 🎯 使用所有集合
 */
export function useCollections(query?: CollectionQuery) {
    const {
        collections,
        queryResults,
        lastQuery,
        loading,
        error,
        setCollections,
        setQueryResults,
        setLoading,
        setError,
    } = useCollectionStore(
        useCallback((state) => ({
            collections: state.collections,
            queryResults: state.queryResults,
            lastQuery: state.lastQuery,
            loading: state.loading,
            error: state.error,
            setCollections: state.setCollections,
            setQueryResults: state.setQueryResults,
            setLoading: state.setLoading,
            setError: state.setError,
        }), []),
        shallow
    );

    // 获取集合列表
    const fetchCollections = useCallback(
        async (
            searchQuery: CollectionQuery = {},
            sort: CollectionSort = { field: 'createdAt', order: 'desc' },
            page: number = 1,
            pageSize: number = 50
        ) => {
            setLoading('fetch', true);
            setError(null);

            try {
                const result = await collectionService.queryCollections(
                    searchQuery,
                    sort,
                    page,
                    pageSize
                );

                setCollections(result.items);
                setQueryResults(searchQuery, result.items.map(c => c.id));

                return result;
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Failed to fetch collections';
                setError(errorMessage);
                throw error;
            } finally {
                setLoading('fetch', false);
            }
        },
        [setCollections, setQueryResults, setLoading, setError]
    );

    // 计算当前显示的集合
    const displayedCollections = useMemo(() => {
        if (query && JSON.stringify(query) === JSON.stringify(lastQuery)) {
            return queryResults.map(id => collections[id]).filter(Boolean);
        }
        return Object.values(collections);
    }, [collections, queryResults, lastQuery, query]);

    // 自动加载
    useEffect(() => {
        if (query) {
            fetchCollections(query);
        }
    }, [query, fetchCollections]);

    return {
        collections: displayedCollections,
        allCollections: Object.values(collections),
        loading: loading.fetch,
        error,
        refetch: fetchCollections,
    };
}

/**
 * 🎯 使用单个集合
 */
export function useCollection(collectionId: string | null) {
    const {
        collection,
        uiConfig,
        stats,
        loading,
        error,
        updateCollection: updateCollectionInStore,
        setUIConfig,
        setStats,
        setLoading,
        setError,
    } = useCollectionStore(
        useCallback((state) => ({
            collection: collectionId ? collectionSelectors.byId(state, collectionId) : null,
            uiConfig: collectionId ? uiConfigSelectors.byCollectionId(state, collectionId) : null,
            stats: collectionId ? statsSelectors.byCollectionId(state, collectionId) : null,
            loading: state.loading,
            error: state.error,
            updateCollection: state.updateCollection,
            setUIConfig: state.setUIConfig,
            setStats: state.setStats,
            setLoading: state.setLoading,
            setError: state.setError,
        }), [collectionId]),
        shallow
    );

    // 更新集合
    const updateCollection = useCallback(
        async (updates: UpdateCollectionInput, userId: string) => {
            if (!collectionId) return null;

            setLoading('update', true);
            setError(null);

            try {
                const updatedCollection = await collectionService.updateCollection(
                    collectionId,
                    userId,
                    updates
                );

                updateCollectionInStore(collectionId, updatedCollection);
                return updatedCollection;
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Failed to update collection';
                setError(errorMessage);
                throw error;
            } finally {
                setLoading('update', false);
            }
        },
        [collectionId, updateCollectionInStore, setLoading, setError]
    );

    // 更新UI配置
    const updateUIConfig = useCallback(
        (configUpdates: Partial<CollectionUIConfig>) => {
            if (!collectionId) return;

            const newConfig: CollectionUIConfig = {
                collectionId,
                sortBy: 'addedAt',
                sortOrder: 'desc',
                viewMode: 'list',
                notifyOnUpdate: false,
                updatedAt: new Date(),
                ...uiConfig,
                ...configUpdates,
            };

            setUIConfig(newConfig);
        },
        [collectionId, uiConfig, setUIConfig]
    );

    return {
        collection,
        uiConfig,
        stats,
        loading: loading.update,
        error,
        updateCollection,
        updateUIConfig,
    };
}

// ==================== 集合操作Hooks ====================

/**
 * 🎯 集合CRUD操作
 */
export function useCollectionOperations() {
    const {
        addCollection,
        removeCollection,
        setLoading,
        setError,
    } = useCollectionStore(
        useCallback((state) => ({
            addCollection: state.addCollection,
            removeCollection: state.removeCollection,
            setLoading: state.setLoading,
            setError: state.setError,
        }), []),
        shallow
    );

    // 创建集合
    const createCollection = useCallback(
        async (userId: string, input: CreateCollectionInput) => {
            setLoading('create', true);
            setError(null);

            try {
                const collection = await collectionService.createCollection(userId, input);
                addCollection(collection);
                return collection;
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Failed to create collection';
                setError(errorMessage);
                throw error;
            } finally {
                setLoading('create', false);
            }
        },
        [addCollection, setLoading, setError]
    );

    // 删除集合
    const deleteCollection = useCallback(
        async (collectionId: string, userId: string) => {
            setLoading('delete', true);
            setError(null);

            try {
                await collectionService.deleteCollection(collectionId, userId);
                removeCollection(collectionId);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Failed to delete collection';
                setError(errorMessage);
                throw error;
            } finally {
                setLoading('delete', false);
            }
        },
        [removeCollection, setLoading, setError]
    );

    const { loading } = useCollectionStore(
        useCallback((state) => ({ loading: state.loading }), [])
    );

    return {
        createCollection,
        deleteCollection,
        loading: {
            create: loading.create,
            delete: loading.delete,
        },
    };
}

/**
 * 🎯 集合文献管理
 */
export function useCollectionLiterature(collectionId: string) {
    const {
        collection,
        updateCollection,
        setError,
    } = useCollectionStore(
        useCallback((state) => ({
            collection: collectionSelectors.byId(state, collectionId),
            updateCollection: state.updateCollection,
            setError: state.setError,
        }), [collectionId]),
        shallow
    );

    // 添加文献到集合
    const addLiterature = useCallback(
        async (lids: string[], userId: string) => {
            setError(null);

            try {
                await collectionService.addLiteratureToCollection(
                    collectionId,
                    lids,
                    userId
                );

                // 更新本地状态
                if (collection) {
                    const newLiteratureIds = [
                        ...new Set([...collection.lids, ...lids])
                    ];
                    updateCollection(collectionId, {
                        lids: newLiteratureIds,
                        updatedAt: new Date(),
                    });
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Failed to add literature';
                setError(errorMessage);
                throw error;
            }
        },
        [collectionId, collection, updateCollection, setError]
    );

    // 从集合移除文献
    const removeLiterature = useCallback(
        async (lids: string[], userId: string) => {
            setError(null);

            try {
                await collectionService.removeLiteratureFromCollection(
                    collectionId,
                    lids,
                    userId
                );

                // 更新本地状态
                if (collection) {
                    const newLiteratureIds = collection.lids.filter(
                        id => !lids.includes(id)
                    );
                    updateCollection(collectionId, {
                        lids: newLiteratureIds,
                        updatedAt: new Date(),
                    });
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Failed to remove literature';
                setError(errorMessage);
                throw error;
            }
        },
        [collectionId, collection, updateCollection, setError]
    );

    return {
        lids: collection?.lids || [],
        addLiterature,
        removeLiterature,
    };
}

// ==================== 专用Hooks ====================

/**
 * 🎯 按类型获取集合
 */
export function useCollectionsByType(type: CollectionType) {
    const collections = useCollectionStore(
        useCallback((state) => collectionSelectors.byType(state, type), [type])
    );

    return collections;
}

/**
 * 🎯 按用户获取集合
 */
export function useUserCollections(userId: string) {
    const collections = useCollectionStore(
        useCallback((state) => collectionSelectors.byOwner(state, userId), [userId])
    );

    return collections;
}

/**
 * 🎯 获取公开集合
 */
export function usePublicCollections() {
    const collections = useCollectionStore(
        useCallback((state) => collectionSelectors.public(state), [])
    );

    return collections;
}

/**
 * 🎯 获取活跃集合（未归档）
 */
export function useActiveCollections() {
    const collections = useCollectionStore(
        useCallback((state) => collectionSelectors.active(state), [])
    );

    return collections;
}

/**
 * 🎯 集合层次结构
 */
export function useCollectionHierarchy(parentId?: string) {
    const {
        rootCollections,
        childCollections,
    } = useCollectionStore(
        useCallback((state) => ({
            rootCollections: collectionSelectors.roots(state),
            childCollections: parentId ? collectionSelectors.children(state, parentId) : [],
        }), [parentId]),
        shallow
    );

    return parentId ? childCollections : rootCollections;
}

/**
 * 🎯 集合选择状态
 */
export function useCollectionSelection() {
    const {
        selectedCollectionId,
        selectedCollection,
        selectCollection,
    } = useCollectionStore(
        useCallback((state) => ({
            selectedCollectionId: state.selectedCollectionId,
            selectedCollection: state.selectedCollectionId
                ? collectionSelectors.byId(state, state.selectedCollectionId)
                : null,
            selectCollection: state.selectCollection,
        }), []),
        shallow
    );

    return {
        selectedCollectionId,
        selectedCollection,
        selectCollection,
    };
}

/**
 * 🎯 集合加载状态
 */
export function useCollectionLoading() {
    const loading = useCollectionStore(
        useCallback((state) => ({
            isLoading: loadingSelectors.any(state),
            fetch: state.loading.fetch,
            create: state.loading.create,
            update: state.loading.update,
            delete: state.loading.delete,
        }), [])
    );

    return loading;
}
