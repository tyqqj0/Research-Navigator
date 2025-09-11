/**
 * 📚 Literature Operations Hook - 业务编排和UI状态管理
 * 
 * 🎯 核心职责：
 * 1. 管理UI状态（loading、selection、error等）
 * 2. 编排业务逻辑（调用Service，更新Store）
 * 3. 组合多个Store的数据为UI提供完整视图
 * 4. 处理复杂的用户交互逻辑
 * 
 * 架构定位：
 * - 这是"产品经理"层，根据UI需求设计最终产品
 * - 连接纯粹的Store（数据仓库）和Service（业务逻辑）
 * - 为组件提供开箱即用的数据和操作方法
 * - 管理所有UI相关的临时状态
 */

import { useState, useCallback, useMemo } from 'react';
import { useLiteratureStore } from '../data-access/stores';
import { compositionService } from '../data-access/services';
import type {
    EnhancedLibraryItem,
    LiteratureFilter,
    LiteratureSort,
    PaginatedResult,
} from '../data-access/models';
import type {
    CreateComposedLiteratureInput,
    UpdateComposedLiteratureInput,
} from '../data-access/services/composition-service';

// ==================== Hook State Interfaces ====================

interface LiteratureUIState {
    // 🔄 加载状态
    isLoading: boolean;
    isSearching: boolean;
    loadingIds: Set<string>;

    // 🎯 选择状态
    selectedIds: Set<string>;

    // 🎨 视图状态
    viewMode: 'list' | 'grid' | 'table';

    // ❌ 错误状态
    error: string | null;
}

interface SearchState {
    query: string;
    results: EnhancedLibraryItem[];
    total: number;
    hasMore: boolean;
    filter: LiteratureFilter;
    sort: LiteratureSort;
    page: number;
    pageSize: number;
}

// ==================== Hook Return Interface ====================

export interface UseLiteratureOperationsReturn {
    // 📚 数据状态
    literatures: EnhancedLibraryItem[];
    selectedLiteratures: EnhancedLibraryItem[];

    // 🔍 搜索状态
    searchState: SearchState;

    // 📊 UI状态
    uiState: LiteratureUIState;

    // 📈 统计信息
    stats: {
        total: number;
        selected: number;
        lastUpdated: Date | null;
    };

    // 🔧 基础操作
    setCurrentUser: (userId: string | null) => void;
    clearError: () => void;

    // 📚 数据操作 - 🎯 重构后：移除userId参数，Service内部自动获取
    createLiterature: (input: Omit<CreateComposedLiteratureInput, 'userId'>) => Promise<EnhancedLibraryItem>;
    updateLiterature: (paperId: string, input: UpdateComposedLiteratureInput) => Promise<EnhancedLibraryItem>;
    deleteLiterature: (paperId: string, options?: { deleteGlobally?: boolean }) => Promise<void>;
    batchDeleteLiteratures: (paperIds: string[], options?: { deleteGlobally?: boolean }) => Promise<void>;

    // 🔄 数据同步 - 🎯 重构后：自动使用当前用户
    loadLiteratures: (options?: { force?: boolean }) => Promise<void>;
    loadLiterature: (paperId: string) => Promise<EnhancedLibraryItem | null>;
    refreshLiterature: (paperId: string) => Promise<void>;

    // 🔍 搜索操作
    search: (query: string, options?: {
        filter?: Partial<LiteratureFilter>;
        sort?: LiteratureSort;
        page?: number;
        pageSize?: number;
    }) => Promise<void>;
    clearSearch: () => void;
    loadMoreResults: () => Promise<void>;

    // 🎯 选择操作
    selectLiterature: (paperId: string) => void;
    selectMultipleLiteratures: (paperIds: string[]) => void;
    deselectLiterature: (paperId: string) => void;
    clearSelection: () => void;
    toggleSelection: (paperId: string) => void;
    selectAll: () => void;

    // 🎨 UI操作
    setViewMode: (mode: 'list' | 'grid' | 'table') => void;

    // 📊 数据查询辅助
    getLiterature: (paperId: string) => EnhancedLibraryItem | undefined;
    getLiteratures: (paperIds: string[]) => EnhancedLibraryItem[];
    getFilteredLiteratures: (filter?: Partial<LiteratureFilter>) => EnhancedLibraryItem[];
}

// ==================== Hook Implementation ====================

export const useLiteratureOperations = (): UseLiteratureOperationsReturn => {
    // 📚 Store数据
    const store = useLiteratureStore();

    // 📊 UI状态管理
    const [uiState, setUIState] = useState<LiteratureUIState>({
        isLoading: false,
        isSearching: false,
        loadingIds: new Set(),
        selectedIds: new Set(),
        viewMode: 'list',
        error: null,
    });

    // 🔍 搜索状态管理
    const [searchState, setSearchState] = useState<SearchState>({
        query: '',
        results: [],
        total: 0,
        hasMore: false,
        filter: {},
        sort: { field: 'createdAt', order: 'desc' },
        page: 1,
        pageSize: 20,
    });

    // 📈 派生状态
    const stats = useMemo(() => ({
        total: store.stats.total,
        selected: uiState.selectedIds.size,
        lastUpdated: store.stats.lastUpdated,
    }), [store.stats, uiState.selectedIds.size]);

    const selectedLiteratures = useMemo(() => {
        return Array.from(uiState.selectedIds)
            .map(paperId => store.getLiterature(paperId))
            .filter(Boolean) as EnhancedLibraryItem[];
    }, [uiState.selectedIds, store]);

    // 🔧 基础操作
    const setCurrentUser = useCallback((userId: string | null) => {
        // Store层不再需要setCurrentUser方法，用户身份由Service层管理
        // 清空UI状态
        setUIState(prev => ({
            ...prev,
            selectedIds: new Set(),
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
    }, []);

    const clearError = useCallback(() => {
        setUIState(prev => ({ ...prev, error: null }));
    }, []);

    // 📚 数据操作 - 🎯 重构后：Service自动处理用户身份
    const createLiterature = useCallback(async (input: Omit<CreateComposedLiteratureInput, 'userId'>) => {
        setUIState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            // 🔐 Service层自动获取用户身份并处理业务逻辑
            const enhanced = await compositionService.createComposedLiterature(input);

            // Store层更新数据
            store.addLiterature(enhanced);

            setUIState(prev => ({ ...prev, isLoading: false }));
            return enhanced;
        } catch (error) {
            setUIState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : '创建文献失败',
                isLoading: false,
            }));
            throw error;
        }
    }, [store]);

    const updateLiterature = useCallback(async (paperId: string, input: UpdateComposedLiteratureInput) => {
        setUIState(prev => ({
            ...prev,
            loadingIds: new Set(prev.loadingIds).add(paperId),
            error: null,
        }));

        try {
            // 🔐 Service层自动获取用户身份并处理业务逻辑
            const enhanced = await compositionService.updateComposedLiterature(paperId, input);

            // Store层更新数据
            store.updateLiterature(paperId, enhanced);

            // 更新搜索结果中的数据
            if (searchState.query && searchState.results.some(item => item.literature.paperId === paperId)) {
                setSearchState(prev => ({
                    ...prev,
                    results: prev.results.map(item =>
                        item.literature.paperId === paperId ? enhanced : item
                    ),
                }));
            }

            setUIState(prev => {
                const newLoadingIds = new Set(prev.loadingIds);
                newLoadingIds.delete(paperId);
                return { ...prev, loadingIds: newLoadingIds };
            });

            return enhanced;
        } catch (error) {
            setUIState(prev => {
                const newLoadingIds = new Set(prev.loadingIds);
                newLoadingIds.delete(paperId);
                return {
                    ...prev,
                    error: error instanceof Error ? error.message : '更新文献失败',
                    loadingIds: newLoadingIds,
                };
            });
            throw error;
        }
    }, [store, searchState]);

    const deleteLiterature = useCallback(async (paperId: string, options: { deleteGlobally?: boolean } = {}) => {
        setUIState(prev => ({
            ...prev,
            loadingIds: new Set(prev.loadingIds).add(paperId),
            error: null,
        }));

        try {
            // 🔐 Service层自动获取用户身份并处理业务逻辑
            await compositionService.deleteComposedLiterature(paperId, options);

            // Store层更新数据
            store.removeLiterature(paperId);

            // 更新UI状态
            setUIState(prev => {
                const newLoadingIds = new Set(prev.loadingIds);
                newLoadingIds.delete(paperId);
                const newSelectedIds = new Set(prev.selectedIds);
                newSelectedIds.delete(paperId);
                return { ...prev, loadingIds: newLoadingIds, selectedIds: newSelectedIds };
            });

            // 从搜索结果中移除
            setSearchState(prev => ({
                ...prev,
                results: prev.results.filter(item => item.literature.paperId !== paperId),
            }));
        } catch (error) {
            setUIState(prev => {
                const newLoadingIds = new Set(prev.loadingIds);
                newLoadingIds.delete(paperId);
                return {
                    ...prev,
                    error: error instanceof Error ? error.message : '删除文献失败',
                    loadingIds: newLoadingIds,
                };
            });
            throw error;
        }
    }, [store]);

    const batchDeleteLiteratures = useCallback(async (paperIds: string[], options: { deleteGlobally?: boolean } = {}) => {
        setUIState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            // 🔐 Service层自动获取用户身份并处理业务逻辑
            await compositionService.deleteComposedLiteratureBatch(
                paperIds.map(paperId => ({ paperId, deleteGlobally: options.deleteGlobally }))
            );

            // Store层更新数据
            store.removeLiteratures(paperIds);

            // 更新UI状态
            setUIState(prev => {
                const newSelectedIds = new Set(prev.selectedIds);
                paperIds.forEach(paperId => newSelectedIds.delete(paperId));
                return { ...prev, selectedIds: newSelectedIds, isLoading: false };
            });

            // 从搜索结果中移除
            setSearchState(prev => ({
                ...prev,
                results: prev.results.filter(item => !paperIds.includes(item.literature.paperId)),
            }));
        } catch (error) {
            setUIState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : '批量删除失败',
                isLoading: false,
            }));
            throw error;
        }
    }, [store]);

    // 🔄 数据同步 - 🎯 重构后：自动使用当前用户
    const loadLiteratures = useCallback(async (options: { force?: boolean } = {}) => {
        const { force = false } = options;

        // 如果已有数据且不强制刷新，则跳过
        if (!force && store.stats.total > 0) return;

        setUIState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            // 🔐 Service层自动获取当前用户的数据
            const result = await compositionService.getUserComposedLiteratures();

            // Store层更新数据
            store.replaceLiteratures(result);

            setUIState(prev => ({ ...prev, isLoading: false }));
        } catch (error) {
            setUIState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : '加载文献失败',
                isLoading: false,
            }));
            throw error;
        }
    }, [store]);

    const loadLiterature = useCallback(async (paperId: string) => {
        setUIState(prev => ({
            ...prev,
            loadingIds: new Set(prev.loadingIds).add(paperId),
            error: null,
        }));

        try {
            // 🔐 Service层自动获取当前用户的数据
            const enhanced = await compositionService.getEnhancedLiterature(paperId);

            if (enhanced) {
                // Store层更新数据
                store.addLiterature(enhanced);
            }

            setUIState(prev => {
                const newLoadingIds = new Set(prev.loadingIds);
                newLoadingIds.delete(paperId);
                return { ...prev, loadingIds: newLoadingIds };
            });

            return enhanced;
        } catch (error) {
            setUIState(prev => {
                const newLoadingIds = new Set(prev.loadingIds);
                newLoadingIds.delete(paperId);
                return {
                    ...prev,
                    error: error instanceof Error ? error.message : '加载文献失败',
                    loadingIds: newLoadingIds,
                };
            });
            return null;
        }
    }, [store]);

    const refreshLiterature = useCallback(async (paperId: string) => {
        await loadLiterature(paperId);
    }, [loadLiterature]);

    // 🔍 搜索操作
    const search = useCallback(async (query: string, options: {
        filter?: Partial<LiteratureFilter>;
        sort?: LiteratureSort;
        page?: number;
        pageSize?: number;
    } = {}) => {
        const {
            filter = {},
            sort = { field: 'createdAt', order: 'desc' },
            page = 1,
            pageSize = 20,
        } = options;

        setUIState(prev => ({ ...prev, isSearching: true, error: null }));
        setSearchState(prev => ({
            ...prev,
            query,
            filter,
            sort,
            page,
            pageSize,
        }));

        try {
            // 🔐 Service层自动获取当前用户并处理搜索
            const result = await compositionService.searchEnhancedLiteratures(
                { searchTerm: query, ...filter },
                sort,
                page,
                pageSize
            );

            setSearchState(prev => ({
                ...prev,
                results: result.items,
                total: result.total,
                hasMore: result.page < result.totalPages,
            }));

            setUIState(prev => ({ ...prev, isSearching: false }));
        } catch (error) {
            setUIState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : '搜索失败',
                isSearching: false,
            }));
        }
    }, [store]);

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
        if (!searchState.hasMore || uiState.isSearching) return;

        const nextPage = searchState.page + 1;

        setUIState(prev => ({ ...prev, isSearching: true }));

        try {
            // Service层处理分页搜索
            const result = await compositionService.searchEnhancedLiteratures(
                { searchTerm: searchState.query, ...searchState.filter },
                searchState.sort,
                nextPage,
                searchState.pageSize
            );

            setSearchState(prev => ({
                ...prev,
                results: [...prev.results, ...result.items],
                page: nextPage,
                hasMore: result.page < result.totalPages,
            }));

            setUIState(prev => ({ ...prev, isSearching: false }));
        } catch (error) {
            setUIState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : '加载更多失败',
                isSearching: false,
            }));
        }
    }, [searchState, uiState.isSearching]);

    // 🎯 选择操作
    const selectLiterature = useCallback((paperId: string) => {
        setUIState(prev => ({
            ...prev,
            selectedIds: new Set(prev.selectedIds).add(paperId),
        }));
    }, []);

    const selectMultipleLiteratures = useCallback((paperIds: string[]) => {
        setUIState(prev => {
            const newSelectedIds = new Set(prev.selectedIds);
            paperIds.forEach(paperId => newSelectedIds.add(paperId));
            return { ...prev, selectedIds: newSelectedIds };
        });
    }, []);

    const deselectLiterature = useCallback((paperId: string) => {
        setUIState(prev => {
            const newSelectedIds = new Set(prev.selectedIds);
            newSelectedIds.delete(paperId);
            return { ...prev, selectedIds: newSelectedIds };
        });
    }, []);

    const clearSelection = useCallback(() => {
        setUIState(prev => ({ ...prev, selectedIds: new Set() }));
    }, []);

    const toggleSelection = useCallback((paperId: string) => {
        setUIState(prev => {
            const newSelectedIds = new Set(prev.selectedIds);
            if (newSelectedIds.has(paperId)) {
                newSelectedIds.delete(paperId);
            } else {
                newSelectedIds.add(paperId);
            }
            return { ...prev, selectedIds: newSelectedIds };
        });
    }, []);

    const selectAll = useCallback(() => {
        const items = searchState.query ? searchState.results : store.getAllLiteratures();
        setUIState(prev => ({
            ...prev,
            selectedIds: new Set(items.map(item => item.literature.paperId)),
        }));
    }, [searchState, store]);

    // 🎨 UI操作
    const setViewMode = useCallback((mode: 'list' | 'grid' | 'table') => {
        setUIState(prev => ({ ...prev, viewMode: mode }));
    }, []);

    // 📊 数据查询辅助
    const getLiterature = useCallback((paperId: string) => {
        return store.getLiterature(paperId);
    }, [store]);

    const getLiteratures = useCallback((paperIds: string[]) => {
        return store.getLiteratures(paperIds);
    }, [store]);

    const getFilteredLiteratures = useCallback((filter: Partial<LiteratureFilter> = {}) => {
        const items = store.getAllLiteratures();

        return items.filter(item => {
            // 来源过滤
            if (filter.source && filter.source !== 'all' && item.literature.source !== filter.source) {
                return false;
            }

            // 搜索词过滤
            if (filter.searchTerm) {
                const searchTerm = filter.searchTerm.toLowerCase();
                const title = item.literature.title?.toLowerCase() || '';
                const abstract = item.literature.abstract?.toLowerCase() || '';
                const authors = item.literature.authors?.join(' ').toLowerCase() || '';

                if (!title.includes(searchTerm) &&
                    !abstract.includes(searchTerm) &&
                    !authors.includes(searchTerm)) {
                    return false;
                }
            }

            // 年份范围过滤
            if (filter.yearRange && item.literature.year) {
                if (item.literature.year < filter.yearRange.start ||
                    item.literature.year > filter.yearRange.end) {
                    return false;
                }
            }

            // 作者过滤
            if (filter.authors && filter.authors.length > 0) {
                const itemAuthors = item.literature.authors || [];
                const hasAuthor = filter.authors.some(author =>
                    itemAuthors.some(itemAuthor =>
                        itemAuthor.toLowerCase().includes(author.toLowerCase())
                    )
                );
                if (!hasAuthor) return false;
            }

            // 摘要存在性过滤
            if (filter.hasAbstract !== undefined) {
                const hasAbstract = !!(item.literature.abstract && item.literature.abstract.trim());
                if (filter.hasAbstract !== hasAbstract) return false;
            }

            // PDF存在性过滤
            if (filter.hasPdf !== undefined) {
                const hasPdf = !!(item.literature.pdfPath);
                if (filter.hasPdf !== hasPdf) return false;
            }

            return true;
        });
    }, [store]);

    return {
        // 📚 数据状态
        literatures: store.getAllLiteratures(),
        selectedLiteratures,

        // 🔍 搜索状态
        searchState,

        // 📊 UI状态
        uiState,

        // 📈 统计信息
        stats,

        // 🔧 基础操作
        setCurrentUser,
        clearError,

        // 📚 数据操作
        createLiterature,
        updateLiterature,
        deleteLiterature,
        batchDeleteLiteratures,

        // 🔄 数据同步
        loadLiteratures,
        loadLiterature,
        refreshLiterature,

        // 🔍 搜索操作
        search,
        clearSearch,
        loadMoreResults,

        // 🎯 选择操作
        selectLiterature,
        selectMultipleLiteratures,
        deselectLiterature,
        clearSelection,
        toggleSelection,
        selectAll,

        // 🎨 UI操作
        setViewMode,

        // 📊 数据查询辅助
        getLiterature,
        getLiteratures,
        getFilteredLiteratures,
    };
};

export default useLiteratureOperations;


