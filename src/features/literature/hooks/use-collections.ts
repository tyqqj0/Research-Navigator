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
import { useCollectionStore } from '../data-access/stores';
import { collectionService } from '../data-access/services';
import type {
    Collection,
    CollectionType,
    CreateCollectionInput,
    UpdateCollectionInput,
} from '../data-access/models';

// ==================== 基础集合Hook ====================

/**
 * 🎯 使用所有集合
 */
export function useCollections() {
    const store = useCollectionStore();

    // 获取集合列表
    const fetchCollections = useCallback(async () => {
        try {
            const result = await collectionService.getUserCollections();
            store.replaceCollections(result);
            return result;
        } catch (error) {
            console.error('Failed to fetch collections:', error);
            throw error;
        }
    }, [store]);

    return {
        collections: store.getAllCollections(),
        stats: store.stats,
        refetch: fetchCollections,
    };
}

/**
 * 🎯 使用单个集合
 */
export function useCollection(collectionId: string | null) {
    const store = useCollectionStore();

    const collection = collectionId ? store.getCollection(collectionId) : null;

    // 更新集合
    const updateCollection = useCallback(
        async (updates: UpdateCollectionInput) => {
            if (!collectionId) return null;

            try {
                const updatedCollection = await collectionService.updateCollection(collectionId, updates);
                store.updateCollection(collectionId, updatedCollection);
                return updatedCollection;
            } catch (error) {
                console.error('Failed to update collection:', error);
                throw error;
            }
        },
        [collectionId, store]
    );

    return {
        collection,
        updateCollection,
    };
}

// ==================== 集合操作Hooks ====================

/**
 * 🎯 集合CRUD操作
 */
export function useCollectionOperations() {
    const store = useCollectionStore();

    // 创建集合
    const createCollection = useCallback(
        async (input: CreateCollectionInput) => {
            try {
                const collection = await collectionService.createCollection(input);
                store.addCollection(collection);
                return collection;
            } catch (error) {
                console.error('Failed to create collection:', error);
                throw error;
            }
        },
        [store]
    );

    // 删除集合
    const deleteCollection = useCallback(
        async (collectionId: string) => {
            try {
                await collectionService.deleteCollection(collectionId);
                store.removeCollection(collectionId);
            } catch (error) {
                console.error('Failed to delete collection:', error);
                throw error;
            }
        },
        [store]
    );

    return {
        createCollection,
        deleteCollection,
    };
}

/**
 * 🎯 集合文献管理
 */
export function useCollectionLiterature(collectionId: string) {
    const store = useCollectionStore();
    const collection = store.getCollection(collectionId);

    // 添加文献到集合
    const addLiterature = useCallback(
        async (paperIds: string[]) => {
            try {
                await collectionService.addItemsToCollection(collectionId, paperIds);
                // 更新本地状态
                store.addLiteraturesToCollection(collectionId, paperIds);
            } catch (error) {
                console.error('Failed to add literature:', error);
                throw error;
            }
        },
        [collectionId, store]
    );

    // 从集合移除文献
    const removeLiterature = useCallback(
        async (paperIds: string[]) => {
            try {
                await collectionService.removeItemsFromCollection(collectionId, paperIds);
                // 更新本地状态
                store.removeLiteraturesFromCollection(collectionId, paperIds);
            } catch (error) {
                console.error('Failed to remove literature:', error);
                throw error;
            }
        },
        [collectionId, store]
    );

    return {
        paperIds: collection?.paperIds || [],
        addLiterature,
        removeLiterature,
    };
}

// ==================== 专用Hooks ====================

/**
 * 🎯 按类型获取集合
 */
export function useCollectionsByType(type: CollectionType) {
    const store = useCollectionStore();
    return store.getCollectionsByType(type);
}

// 简化的hooks，移除复杂的选择器和状态管理
// 这些功能可以通过useCollectionOperations hook来实现

export type UseCollectionsReturn = ReturnType<typeof useCollections>;
