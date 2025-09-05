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
import { useCitationStore, useLiteratureStore } from '../stores';
import { citationService } from '../services';
import type {
    CitationNetwork,
    CitationNode,
    CitationEdge,
    CitationStats,
    CitationAnalysis,
    EnhancedLibraryItem,
} from '../models';

// ==================== Hook State Interfaces ====================

interface CitationUIState {
    // 🔄 加载状态
    isLoading: boolean;
    isAnalyzing: boolean;
    loadingNodes: Set<string>;
    loadingNetworks: Set<string>;

    // 🎯 选择和焦点状态
    selectedNodes: Set<string>;
    highlightedPaths: string[];

    // 🌳 展开状态
    expandedNodes: Set<string>;

    // 🎨 视图状态
    viewMode: 'network' | 'tree' | 'list';
    showStats: boolean;

    // ❌ 错误状态
    error: string | null;
}

interface CitationFocusState {
    centerLid: string | null;
    depth: number;
    direction: 'all' | 'cited' | 'citing';
    networkId: string | null;
}

interface CitationConfig {
    maxDepth: number;
    maxNodes: number;
    includeIndirectCitations: boolean;
    minCitationCount: number;
}

// ==================== Hook Return Interface ====================

export interface UseCitationOperationsReturn {
    // 🔗 数据状态
    networks: CitationNetwork[];
    currentNetwork: CitationNetwork | null;
    nodes: CitationNode[];
    edges: CitationEdge[];

    // 🎯 焦点状态
    focusState: CitationFocusState;
    centerNode: CitationNode | null;
    centerLiterature: EnhancedLibraryItem | null;

    // 📊 UI状态
    uiState: CitationUIState;

    // ⚙️ 配置
    config: CitationConfig;

    // 📈 统计信息
    globalStats: {
        totalNetworks: number;
        totalNodes: number;
        totalEdges: number;
        selectedNodes: number;
        lastUpdated: Date | null;
    };

    // 🔧 基础操作
    clearError: () => void;
    setConfig: (config: Partial<CitationConfig>) => void;

    // 🔗 网络加载和管理
    loadCitationNetwork: (centerLid: string, options?: {
        depth?: number;
        direction?: 'all' | 'cited' | 'citing';
        maxNodes?: number;
    }) => Promise<CitationNetwork>;
    expandNode: (lid: string, options?: {
        depth?: number;
        direction?: 'all' | 'cited' | 'citing';
    }) => Promise<void>;
    refreshNetwork: (networkId: string) => Promise<void>;
    clearNetworks: () => void;

    // 📊 统计和分析
    loadCitationStats: (lid: string) => Promise<CitationStats>;
    batchLoadStats: (lids: string[]) => Promise<void>;
    analyzeCitationPath: (fromLid: string, toLid: string) => Promise<CitationAnalysis>;
    findInfluentialPapers: (networkId: string, options?: {
        metric?: 'citations' | 'pagerank' | 'betweenness';
        topK?: number;
    }) => Promise<CitationNode[]>;

    // 🎯 焦点控制
    setFocus: (centerLid: string, options?: {
        depth?: number;
        direction?: 'all' | 'cited' | 'citing';
    }) => void;
    clearFocus: () => void;

    // 📊 选择和高亮
    selectNode: (lid: string) => void;
    selectMultipleNodes: (lids: string[]) => void;
    clearSelection: () => void;
    toggleNodeSelection: (lid: string) => void;
    highlightPath: (path: string[]) => void;
    clearHighlight: () => void;

    // 🌳 展开控制
    expandNodeUI: (lid: string) => void;
    collapseNode: (lid: string) => void;
    toggleNodeExpansion: (lid: string) => void;
    expandAll: () => void;
    collapseAll: () => void;

    // 🎨 UI操作
    setViewMode: (mode: 'network' | 'tree' | 'list') => void;
    toggleStats: () => void;

    // 📊 数据查询辅助
    getNetwork: (networkId: string) => CitationNetwork | undefined;
    getNode: (lid: string) => CitationNode | undefined;
    getNodeWithLiterature: (lid: string) => {
        node: CitationNode;
        literature: EnhancedLibraryItem;
    } | null;
    getNodeStats: (lid: string) => CitationStats | undefined;
    getNodesInNetwork: (networkId: string) => CitationNode[];
    getEdgesInNetwork: (networkId: string) => CitationEdge[];
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
        loadingNodes: new Set(),
        loadingNetworks: new Set(),
        selectedNodes: new Set(),
        highlightedPaths: [],
        expandedNodes: new Set(),
        viewMode: 'network',
        showStats: true,
        error: null,
    });

    // 🎯 焦点状态管理
    const [focusState, setFocusState] = useState<CitationFocusState>({
        centerLid: null,
        depth: 2,
        direction: 'all',
        networkId: null,
    });

    // ⚙️ 配置状态管理
    const [config, setConfigState] = useState<CitationConfig>({
        maxDepth: 3,
        maxNodes: 100,
        includeIndirectCitations: true,
        minCitationCount: 1,
    });

    // 📈 派生状态
    const globalStats = useMemo(() => ({
        totalNetworks: citationStore.globalStats.totalNetworks,
        totalNodes: citationStore.globalStats.totalNodes,
        totalEdges: citationStore.globalStats.totalEdges,
        selectedNodes: uiState.selectedNodes.size,
        lastUpdated: citationStore.globalStats.lastUpdated,
    }), [citationStore.globalStats, uiState.selectedNodes.size]);

    const currentNetwork = useMemo(() => {
        return focusState.networkId ? citationStore.getNetwork(focusState.networkId) : null;
    }, [focusState.networkId, citationStore.networks]);

    const centerNode = useMemo(() => {
        return focusState.centerLid ? citationStore.getNode(focusState.centerLid) : null;
    }, [focusState.centerLid, citationStore.nodes]);

    const centerLiterature = useMemo(() => {
        return focusState.centerLid ? literatureStore.getLiterature(focusState.centerLid) : null;
    }, [focusState.centerLid, literatureStore.literatures]);

    // 🔧 基础操作
    const clearError = useCallback(() => {
        setUIState(prev => ({ ...prev, error: null }));
    }, []);

    const setConfig = useCallback((newConfig: Partial<CitationConfig>) => {
        setConfigState(prev => ({ ...prev, ...newConfig }));
    }, []);

    // 🔗 网络加载和管理
    const loadCitationNetwork = useCallback(async (centerLid: string, options: {
        depth?: number;
        direction?: 'all' | 'cited' | 'citing';
        maxNodes?: number;
    } = {}) => {
        const {
            depth = config.maxDepth,
            direction = 'all',
            maxNodes = config.maxNodes,
        } = options;

        setUIState(prev => ({ ...prev, isLoading: true, error: null }));
        setFocusState(prev => ({
            ...prev,
            centerLid,
            depth,
            direction,
        }));

        try {
            // Service层处理网络构建
            const network = await citationService.buildCitationNetwork(centerLid, {
                depth,
                direction,
                maxNodes,
                includeIndirectCitations: config.includeIndirectCitations,
                minCitationCount: config.minCitationCount,
            });

            // Store层更新数据
            citationStore.addNetwork(network);
            citationStore.addNodes(network.nodes);
            citationStore.addEdges(network.edges);

            // 更新焦点状态
            setFocusState(prev => ({
                ...prev,
                networkId: network.id,
            }));

            setUIState(prev => ({ ...prev, isLoading: false }));
            return network;
        } catch (error) {
            setUIState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : '构建引用网络失败',
                isLoading: false,
            }));
            throw error;
        }
    }, [config, citationStore]);

    const expandNode = useCallback(async (lid: string, options: {
        depth?: number;
        direction?: 'all' | 'cited' | 'citing';
    } = {}) => {
        const {
            depth = 1,
            direction = 'all',
        } = options;

        if (!focusState.networkId) return;

        setUIState(prev => ({
            ...prev,
            loadingNodes: new Set(prev.loadingNodes).add(lid),
            error: null,
        }));

        try {
            // Service层处理节点展开
            const expandedData = await citationService.expandCitationNode(lid, {
                depth,
                direction,
                networkId: focusState.networkId,
                maxNodes: config.maxNodes,
            });

            // Store层更新数据
            citationStore.addNodes(expandedData.nodes);
            citationStore.addEdges(expandedData.edges);

            // 更新网络数据
            const network = citationStore.getNetwork(focusState.networkId);
            if (network) {
                const updatedNetwork = {
                    ...network,
                    nodes: [...network.nodes, ...expandedData.nodes],
                    edges: [...network.edges, ...expandedData.edges],
                    updatedAt: new Date(),
                };
                citationStore.updateNetwork(focusState.networkId, updatedNetwork);
            }

            // 更新UI状态
            setUIState(prev => {
                const newLoadingNodes = new Set(prev.loadingNodes);
                newLoadingNodes.delete(lid);
                const newExpandedNodes = new Set(prev.expandedNodes);
                newExpandedNodes.add(lid);
                return { ...prev, loadingNodes: newLoadingNodes, expandedNodes: newExpandedNodes };
            });
        } catch (error) {
            setUIState(prev => {
                const newLoadingNodes = new Set(prev.loadingNodes);
                newLoadingNodes.delete(lid);
                return {
                    ...prev,
                    error: error instanceof Error ? error.message : '展开节点失败',
                    loadingNodes: newLoadingNodes,
                };
            });
            throw error;
        }
    }, [focusState.networkId, config.maxNodes, citationStore]);

    const refreshNetwork = useCallback(async (networkId: string) => {
        const network = citationStore.getNetwork(networkId);
        if (!network || !network.centerLid) return;

        setUIState(prev => ({
            ...prev,
            loadingNetworks: new Set(prev.loadingNetworks).add(networkId),
            error: null,
        }));

        try {
            // 重新构建网络
            const refreshedNetwork = await citationService.buildCitationNetwork(network.centerLid, {
                depth: network.depth,
                direction: network.direction,
                maxNodes: network.maxNodes,
            });

            // Store层更新数据
            citationStore.updateNetwork(networkId, refreshedNetwork);
            citationStore.addNodes(refreshedNetwork.nodes);
            citationStore.addEdges(refreshedNetwork.edges);

            setUIState(prev => {
                const newLoadingNetworks = new Set(prev.loadingNetworks);
                newLoadingNetworks.delete(networkId);
                return { ...prev, loadingNetworks: newLoadingNetworks };
            });
        } catch (error) {
            setUIState(prev => {
                const newLoadingNetworks = new Set(prev.loadingNetworks);
                newLoadingNetworks.delete(networkId);
                return {
                    ...prev,
                    error: error instanceof Error ? error.message : '刷新网络失败',
                    loadingNetworks: newLoadingNetworks,
                };
            });
            throw error;
        }
    }, [citationStore]);

    const clearNetworks = useCallback(() => {
        citationStore.clearNetworks();
        setFocusState({
            centerLid: null,
            depth: 2,
            direction: 'all',
            networkId: null,
        });
        setUIState(prev => ({
            ...prev,
            selectedNodes: new Set(),
            expandedNodes: new Set(),
            highlightedPaths: [],
        }));
    }, [citationStore]);

    // 📊 统计和分析
    const loadCitationStats = useCallback(async (lid: string) => {
        try {
            const stats = await citationService.getCitationStats(lid);
            citationStore.addStats(lid, stats);
            return stats;
        } catch (error) {
            setUIState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : '加载统计失败',
            }));
            throw error;
        }
    }, [citationStore]);

    const batchLoadStats = useCallback(async (lids: string[]) => {
        setUIState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            const statsResults = await citationService.batchGetCitationStats(lids);
            statsResults.forEach((stats, index) => {
                citationStore.addStats(lids[index], stats);
            });

            setUIState(prev => ({ ...prev, isLoading: false }));
        } catch (error) {
            setUIState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : '批量加载统计失败',
                isLoading: false,
            }));
            throw error;
        }
    }, [citationStore]);

    const analyzeCitationPath = useCallback(async (fromLid: string, toLid: string) => {
        setUIState(prev => ({ ...prev, isAnalyzing: true, error: null }));

        try {
            const analysis = await citationService.analyzeCitationPath(fromLid, toLid);
            const analysisId = `${fromLid}-${toLid}`;
            citationStore.addAnalysis(analysisId, analysis);

            setUIState(prev => ({ ...prev, isAnalyzing: false }));
            return analysis;
        } catch (error) {
            setUIState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : '路径分析失败',
                isAnalyzing: false,
            }));
            throw error;
        }
    }, [citationStore]);

    const findInfluentialPapers = useCallback(async (networkId: string, options: {
        metric?: 'citations' | 'pagerank' | 'betweenness';
        topK?: number;
    } = {}) => {
        const { metric = 'citations', topK = 10 } = options;

        setUIState(prev => ({ ...prev, isAnalyzing: true, error: null }));

        try {
            const influentialNodes = await citationService.findInfluentialPapers(networkId, {
                metric,
                topK,
            });

            setUIState(prev => ({ ...prev, isAnalyzing: false }));
            return influentialNodes;
        } catch (error) {
            setUIState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : '影响力分析失败',
                isAnalyzing: false,
            }));
            throw error;
        }
    }, []);

    // 🎯 焦点控制
    const setFocus = useCallback((centerLid: string, options: {
        depth?: number;
        direction?: 'all' | 'cited' | 'citing';
    } = {}) => {
        const { depth = 2, direction = 'all' } = options;
        setFocusState(prev => ({
            ...prev,
            centerLid,
            depth,
            direction,
        }));
    }, []);

    const clearFocus = useCallback(() => {
        setFocusState({
            centerLid: null,
            depth: 2,
            direction: 'all',
            networkId: null,
        });
    }, []);

    // 📊 选择和高亮
    const selectNode = useCallback((lid: string) => {
        setUIState(prev => ({
            ...prev,
            selectedNodes: new Set(prev.selectedNodes).add(lid),
        }));
    }, []);

    const selectMultipleNodes = useCallback((lids: string[]) => {
        setUIState(prev => {
            const newSelectedNodes = new Set(prev.selectedNodes);
            lids.forEach(lid => newSelectedNodes.add(lid));
            return { ...prev, selectedNodes: newSelectedNodes };
        });
    }, []);

    const clearSelection = useCallback(() => {
        setUIState(prev => ({ ...prev, selectedNodes: new Set() }));
    }, []);

    const toggleNodeSelection = useCallback((lid: string) => {
        setUIState(prev => {
            const newSelectedNodes = new Set(prev.selectedNodes);
            if (newSelectedNodes.has(lid)) {
                newSelectedNodes.delete(lid);
            } else {
                newSelectedNodes.add(lid);
            }
            return { ...prev, selectedNodes: newSelectedNodes };
        });
    }, []);

    const highlightPath = useCallback((path: string[]) => {
        setUIState(prev => ({ ...prev, highlightedPaths: path }));
    }, []);

    const clearHighlight = useCallback(() => {
        setUIState(prev => ({ ...prev, highlightedPaths: [] }));
    }, []);

    // 🌳 展开控制
    const expandNodeUI = useCallback((lid: string) => {
        setUIState(prev => ({
            ...prev,
            expandedNodes: new Set(prev.expandedNodes).add(lid),
        }));
    }, []);

    const collapseNode = useCallback((lid: string) => {
        setUIState(prev => {
            const newExpandedNodes = new Set(prev.expandedNodes);
            newExpandedNodes.delete(lid);
            return { ...prev, expandedNodes: newExpandedNodes };
        });
    }, []);

    const toggleNodeExpansion = useCallback((lid: string) => {
        setUIState(prev => {
            const newExpandedNodes = new Set(prev.expandedNodes);
            if (newExpandedNodes.has(lid)) {
                newExpandedNodes.delete(lid);
            } else {
                newExpandedNodes.add(lid);
            }
            return { ...prev, expandedNodes: newExpandedNodes };
        });
    }, []);

    const expandAll = useCallback(() => {
        const allNodes = citationStore.getAllNodes();
        setUIState(prev => ({
            ...prev,
            expandedNodes: new Set(allNodes.map(node => node.lid)),
        }));
    }, [citationStore]);

    const collapseAll = useCallback(() => {
        setUIState(prev => ({ ...prev, expandedNodes: new Set() }));
    }, []);

    // 🎨 UI操作
    const setViewMode = useCallback((mode: 'network' | 'tree' | 'list') => {
        setUIState(prev => ({ ...prev, viewMode: mode }));
    }, []);

    const toggleStats = useCallback(() => {
        setUIState(prev => ({ ...prev, showStats: !prev.showStats }));
    }, []);

    // 📊 数据查询辅助
    const getNetwork = useCallback((networkId: string) => {
        return citationStore.getNetwork(networkId);
    }, [citationStore]);

    const getNode = useCallback((lid: string) => {
        return citationStore.getNode(lid);
    }, [citationStore]);

    const getNodeWithLiterature = useCallback((lid: string) => {
        const node = citationStore.getNode(lid);
        const literature = literatureStore.getLiterature(lid);

        if (!node || !literature) return null;
        return { node, literature };
    }, [citationStore, literatureStore]);

    const getNodeStats = useCallback((lid: string) => {
        return citationStore.getNodeStats(lid);
    }, [citationStore]);

    const getNodesInNetwork = useCallback((networkId: string) => {
        return citationStore.getNodesInNetwork(networkId);
    }, [citationStore]);

    const getEdgesInNetwork = useCallback((networkId: string) => {
        return citationStore.getEdgesInNetwork(networkId);
    }, [citationStore]);

    return {
        // 🔗 数据状态
        networks: citationStore.getAllNetworks(),
        currentNetwork,
        nodes: citationStore.getAllNodes(),
        edges: citationStore.getAllEdges(),

        // 🎯 焦点状态
        focusState,
        centerNode,
        centerLiterature,

        // 📊 UI状态
        uiState,

        // ⚙️ 配置
        config,

        // 📈 统计信息
        globalStats,

        // 🔧 基础操作
        clearError,
        setConfig,

        // 🔗 网络加载和管理
        loadCitationNetwork,
        expandNode,
        refreshNetwork,
        clearNetworks,

        // 📊 统计和分析
        loadCitationStats,
        batchLoadStats,
        analyzeCitationPath,
        findInfluentialPapers,

        // 🎯 焦点控制
        setFocus,
        clearFocus,

        // 📊 选择和高亮
        selectNode,
        selectMultipleNodes,
        clearSelection,
        toggleNodeSelection,
        highlightPath,
        clearHighlight,

        // 🌳 展开控制
        expandNodeUI,
        collapseNode,
        toggleNodeExpansion,
        expandAll,
        collapseAll,

        // 🎨 UI操作
        setViewMode,
        toggleStats,

        // 📊 数据查询辅助
        getNetwork,
        getNode,
        getNodeWithLiterature,
        getNodeStats,
        getNodesInNetwork,
        getEdgesInNetwork,
    };
};

export default useCitationOperations;


