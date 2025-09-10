/**
 * 🔗 Citation Operations Hook - 引用网络业务编排和UI状态管理
 * 
 * 🎯 核心职责：
 * 1. 管理引用网络相关的UI状态（loading、selection、focus等）
 * 2. 编排引用分析业务逻辑（调用Service，更新Store）
 * 3. 组合Citation Store和Literature Store的数据
 * 4. 处理引用网络可视化的交互逻辑
 * 
 * 架构定位：
 * - 专门处理引用网络相关的业务编排
 * - 连接Citation Store和Citation Service
 * - 为引用分析组件提供完整的数据和操作
 * - 管理引用网络可视化的UI状态
 */

import { useState, useCallback, useMemo } from 'react';
import { useCitationStore, useLiteratureStore } from '../data-access/stores';
import { citationService } from '../data-access/services';
import type {
    Citation,
    CitationOverview,
    EnhancedLibraryItem,
} from '../data-access/models';

// ==================== Hook State Interfaces ====================

interface CitationUIState {
    // 🔄 加载状态
    isLoading: boolean;
    isAnalyzing: boolean;

    // 🎯 选择状态
    selectedLids: Set<string>;

    // 🎨 视图状态
    viewMode: 'network' | 'tree' | 'list';
    showStats: boolean;

    // ❌ 错误状态
    error: string | null;
}

// ==================== Hook Return Interface ====================

export interface UseCitationOperationsReturn {
    // 🔗 数据状态
    citations: Citation[];
    overviews: CitationOverview[];

    // 📊 UI状态
    uiState: CitationUIState;

    // 📈 统计信息
    stats: {
        totalCitations: number;
        totalOverviews: number;
        selectedItems: number;
        lastUpdated: Date | null;
    };

    // 🔧 基础操作
    clearError: () => void;

    // 🔗 引用数据加载
    loadCitationOverview: (lid: string) => Promise<CitationOverview>;
    batchLoadOverviews: (lids: string[]) => Promise<void>;
    refreshCitations: () => Promise<void>;

    // 📊 选择操作
    selectLiterature: (lid: string) => void;
    selectMultipleLiteratures: (lids: string[]) => void;
    clearSelection: () => void;
    toggleSelection: (lid: string) => void;

    // 🎨 UI操作
    setViewMode: (mode: 'network' | 'tree' | 'list') => void;
    toggleStats: () => void;

    // 📊 数据查询辅助
    getCitation: (citationId: string) => Citation | undefined;
    getOverview: (lid: string) => CitationOverview | undefined;
    getSelectedOverviews: () => CitationOverview[];
}

// ==================== Hook Implementation ====================

export const useCitationOperations = (): UseCitationOperationsReturn => {
    // 🔗 Store数据
    const citationStore = useCitationStore();
    const literatureStore = useLiteratureStore();

    // 📊 UI状态管理
    const [uiState, setUIState] = useState<CitationUIState>({
        isLoading: false,
        isAnalyzing: false,
        selectedLids: new Set(),
        viewMode: 'network',
        showStats: true,
        error: null,
    });

    // 📈 派生状态
    const stats = useMemo(() => ({
        totalCitations: citationStore.stats.totalCitations,
        totalOverviews: Object.keys(citationStore.overviews).length,
        selectedItems: uiState.selectedLids.size,
        lastUpdated: citationStore.stats.lastUpdated,
    }), [citationStore.stats, citationStore.overviews, uiState.selectedLids.size]);

    // 🔧 基础操作
    const clearError = useCallback(() => {
        setUIState(prev => ({ ...prev, error: null }));
    }, []);

    // 🔗 引用数据加载
    const loadCitationOverview = useCallback(async (lid: string) => {
        setUIState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            // 从store获取相关引文数据构建概览
            const incomingCitations = citationStore.getIncomingCitations(lid);
            const outgoingCitations = citationStore.getOutgoingCitations(lid);
            const allCitations = citationStore.getAllCitations();

            // 构建概览对象
            const overview: CitationOverview = {
                totalCitations: allCitations.length,
                uniqueSourceItems: new Set(allCitations.map(c => c.sourceItemId)).size,
                uniqueTargetItems: new Set(allCitations.map(c => c.targetItemId)).size,
                averageOutDegree: allCitations.length > 0 ? outgoingCitations.length / allCitations.length : 0,
                averageInDegree: allCitations.length > 0 ? incomingCitations.length / allCitations.length : 0,
                lastUpdated: new Date()
            };
            citationStore.addOverview(lid, overview);
            setUIState(prev => ({ ...prev, isLoading: false }));
            return overview;
        } catch (error) {
            setUIState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : '加载引用数据失败',
                isLoading: false,
            }));
            throw error;
        }
    }, [citationStore]);

    const batchLoadOverviews = useCallback(async (lids: string[]) => {
        setUIState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            // 为每个lid构建概览
            const allCitations = citationStore.getAllCitations();
            const overview: CitationOverview = {
                totalCitations: allCitations.length,
                uniqueSourceItems: new Set(allCitations.map(c => c.sourceItemId)).size,
                uniqueTargetItems: new Set(allCitations.map(c => c.targetItemId)).size,
                averageOutDegree: allCitations.length > 0 ? allCitations.filter(c => lids.includes(c.sourceItemId)).length / lids.length : 0,
                averageInDegree: allCitations.length > 0 ? allCitations.filter(c => lids.includes(c.targetItemId)).length / lids.length : 0,
                lastUpdated: new Date()
            };

            // 为每个lid添加相同的概览
            lids.forEach(lid => {
                citationStore.addOverview(lid, overview);
            });
            setUIState(prev => ({ ...prev, isLoading: false }));
        } catch (error) {
            setUIState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : '批量加载引用数据失败',
                isLoading: false,
            }));
            throw error;
        }
    }, [citationStore]);

    const refreshCitations = useCallback(async (): Promise<void> => {
        setUIState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            // 刷新引文数据 - 重新获取所有引文
            const allCitations = await citationService.getCitationNetwork([], 1);
            if (allCitations.edges) {
                const citations: Citation[] = allCitations.edges.map(edge => ({
                    sourceItemId: edge.source,
                    targetItemId: edge.target,
                    context: `${edge.type} citation`,
                    createdAt: new Date()
                }));
                citationStore.replaceCitations(citations);
            }
        } catch (error) {
            setUIState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : 'Failed to refresh citations',
                isLoading: false,
            }));
            throw error;
        } finally {
            setUIState(prev => ({ ...prev, isLoading: false }));
        }
    }, [citationStore]);

    // 📊 选择操作
    const selectLiterature = useCallback((lid: string) => {
        setUIState(prev => ({
            ...prev,
            selectedLids: new Set([...prev.selectedLids, lid]),
        }));
    }, []);

    const selectMultipleLiteratures = useCallback((lids: string[]) => {
        setUIState(prev => ({
            ...prev,
            selectedLids: new Set([...prev.selectedLids, ...lids]),
        }));
    }, []);

    const clearSelection = useCallback(() => {
        setUIState(prev => ({
            ...prev,
            selectedLids: new Set(),
        }));
    }, []);

    const toggleSelection = useCallback((lid: string) => {
        setUIState(prev => {
            const newSelection = new Set(prev.selectedLids);
            if (newSelection.has(lid)) {
                newSelection.delete(lid);
            } else {
                newSelection.add(lid);
            }
            return {
                ...prev,
                selectedLids: newSelection,
            };
        });
    }, []);

    // 🎨 UI操作
    const setViewMode = useCallback((mode: 'network' | 'tree' | 'list') => {
        setUIState(prev => ({
            ...prev,
            viewMode: mode,
        }));
    }, []);

    const toggleStats = useCallback(() => {
        setUIState(prev => ({
            ...prev,
            showStats: !prev.showStats,
        }));
    }, []);

    // 📊 数据查询辅助
    const getCitation = useCallback((citationId: string) => {
        return citationStore.getCitation(citationId);
    }, [citationStore]);

    const getOverview = useCallback((lid: string) => {
        return citationStore.getOverview(lid);
    }, [citationStore]);

    const getSelectedOverviews = useCallback(() => {
        const selectedLids = Array.from(uiState.selectedLids);
        return selectedLids
            .map(lid => citationStore.getOverview(lid))
            .filter((overview): overview is CitationOverview => overview !== undefined);
    }, [citationStore, uiState.selectedLids]);

    return {
        // 🔗 数据状态
        citations: citationStore.getAllCitations(),
        overviews: citationStore.getAllOverviews(),

        // 📊 UI状态
        uiState,

        // 📈 统计信息
        stats,

        // 🔧 基础操作
        clearError,

        // 🔗 引用数据加载
        loadCitationOverview,
        batchLoadOverviews,
        refreshCitations,

        // 📊 选择操作
        selectLiterature,
        selectMultipleLiteratures,
        clearSelection,
        toggleSelection,

        // 🎨 UI操作
        setViewMode,
        toggleStats,

        // 📊 数据查询辅助
        getCitation,
        getOverview,
        getSelectedOverviews,
    };
};