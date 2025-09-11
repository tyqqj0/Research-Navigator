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
import { citationService } from '../data-access/services';
import type {
    Citation,
    CitationOverview,
} from '../data-access/models';

// ==================== Hook State Interfaces ====================

interface CitationUIState {
    // 🔄 加载状态
    isLoading: boolean;
    isAnalyzing: boolean;

    // 🎯 选择状态
    selectedPaperIds: Set<string>;

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
    loadCitationOverview: (paperId: string) => Promise<CitationOverview>;
    batchLoadOverviews: (paperIds: string[]) => Promise<void>;
    refreshCitations: () => Promise<void>;

    // 📊 选择操作
    selectLiterature: (paperId: string) => void;
    selectMultipleLiteratures: (paperIds: string[]) => void;
    clearSelection: () => void;
    toggleSelection: (paperId: string) => void;

    // 🎨 UI操作
    setViewMode: (mode: 'network' | 'tree' | 'list') => void;
    toggleStats: () => void;

    // 📊 数据查询辅助
    getCitation: (citationId: string) => Citation | undefined;
    getOverview: (paperId: string) => CitationOverview | undefined;
    getSelectedOverviews: () => CitationOverview[];
}

// ==================== Hook Implementation ====================

export const useCitationOperations = (): UseCitationOperationsReturn => {
    // 🔗 本地数据（不再使用全局Store）
    const [citations, setCitations] = useState<Citation[]>([]);
    const [overviewsMap, setOverviewsMap] = useState<Record<string, CitationOverview>>({});
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    // 📊 UI状态管理
    const [uiState, setUIState] = useState<CitationUIState>({
        isLoading: false,
        isAnalyzing: false,
        selectedPaperIds: new Set(),
        viewMode: 'network',
        showStats: true,
        error: null,
    });

    // 📈 派生状态
    const stats = useMemo(() => ({
        totalCitations: citations.length,
        totalOverviews: Object.keys(overviewsMap).length,
        selectedItems: uiState.selectedPaperIds.size,
        lastUpdated,
    }), [citations.length, overviewsMap, uiState.selectedPaperIds.size, lastUpdated]);

    // 🔧 基础操作
    const clearError = useCallback(() => {
        setUIState(prev => ({ ...prev, error: null }));
    }, []);

    // 🔗 引用数据加载
    const loadCitationOverview = useCallback(async (paperId: string) => {
        setUIState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            // 基于当前本地引文数据构建概览
            const incomingCitations = citations.filter(c => c.targetItemId === paperId);
            const outgoingCitations = citations.filter(c => c.sourceItemId === paperId);
            const allCitations = citations;

            // 构建概览对象
            const overview: CitationOverview = {
                totalCitations: allCitations.length,
                uniqueSourceItems: new Set(allCitations.map(c => c.sourceItemId)).size,
                uniqueTargetItems: new Set(allCitations.map(c => c.targetItemId)).size,
                averageOutDegree: allCitations.length > 0 ? outgoingCitations.length / allCitations.length : 0,
                averageInDegree: allCitations.length > 0 ? incomingCitations.length / allCitations.length : 0,
                lastUpdated: new Date()
            };
            setOverviewsMap(prev => ({ ...prev, [paperId]: overview }));
            setLastUpdated(new Date());
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
    }, [citations]);

    const batchLoadOverviews = useCallback(async (paperIds: string[]) => {
        setUIState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            // 为每个lid基于当前本地引文数据构建概览
            const allCitations = citations;
            const overview: CitationOverview = {
                totalCitations: allCitations.length,
                uniqueSourceItems: new Set(allCitations.map(c => c.sourceItemId)).size,
                uniqueTargetItems: new Set(allCitations.map(c => c.targetItemId)).size,
                averageOutDegree: allCitations.length > 0 ? allCitations.filter(c => paperIds.includes(c.sourceItemId)).length / paperIds.length : 0,
                averageInDegree: allCitations.length > 0 ? allCitations.filter(c => paperIds.includes(c.targetItemId)).length / paperIds.length : 0,
                lastUpdated: new Date()
            };

            // 为每个lid添加相同的概览
            setOverviewsMap(prev => {
                const next = { ...prev };
                paperIds.forEach(paperId => { next[paperId] = overview; });
                return next;
            });
            setLastUpdated(new Date());
            setUIState(prev => ({ ...prev, isLoading: false }));
        } catch (error) {
            setUIState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : '批量加载引用数据失败',
                isLoading: false,
            }));
            throw error;
        }
    }, [citations]);

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
                setCitations(citations);
                setLastUpdated(new Date());
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
    }, []);

    // 📊 选择操作
    const selectLiterature = useCallback((paperId: string) => {
        setUIState(prev => ({
            ...prev,
            selectedPaperIds: new Set([...prev.selectedPaperIds, paperId]),
        }));
    }, []);

    const selectMultipleLiteratures = useCallback((paperIds: string[]) => {
        setUIState(prev => ({
            ...prev,
            selectedPaperIds: new Set([...prev.selectedPaperIds, ...paperIds]),
        }));
    }, []);

    const clearSelection = useCallback(() => {
        setUIState(prev => ({
            ...prev,
            selectedPaperIds: new Set(),
        }));
    }, []);

    const toggleSelection = useCallback((paperId: string) => {
        setUIState(prev => {
            const newSelection = new Set(prev.selectedPaperIds);
            if (newSelection.has(paperId)) {
                newSelection.delete(paperId);
            } else {
                newSelection.add(paperId);
            }
            return {
                ...prev,
                selectedPaperIds: newSelection,
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
        return citations.find(c => `${c.sourceItemId}-${c.targetItemId}` === citationId);
    }, [citations]);

    const getOverview = useCallback((paperId: string) => {
        return overviewsMap[paperId];
    }, [overviewsMap]);

    const getSelectedOverviews = useCallback(() => {
        const selectedPaperIds = Array.from(uiState.selectedPaperIds);
        return selectedPaperIds
            .map(paperId => overviewsMap[paperId])
            .filter((overview): overview is CitationOverview => overview !== undefined);
    }, [overviewsMap, uiState.selectedPaperIds]);

    return {
        // 🔗 数据状态
        citations,
        overviews: Object.values(overviewsMap),

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