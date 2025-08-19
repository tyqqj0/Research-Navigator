// Research Tree Domain - Zustand Store
// 研究树领域状态管理

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
    ResearchTree,
    ResearchTreeNode,
    MCTSIteration,
    ResearchExpansion,
    TreeStatistics
} from './research-tree-types';

interface ResearchTreeState {
    // 当前活跃的树
    currentTree: ResearchTree | null;
    currentTreeNodes: Map<string, ResearchTreeNode>;

    // 所有树的列表
    trees: ResearchTree[];

    // MCTS执行状态
    isRunningMCTS: boolean;
    currentIteration: number;
    iterations: MCTSIteration[];

    // 扩展历史
    expansions: ResearchExpansion[];

    // UI状态
    selectedNodeId: string | null;
    expandedNodeIds: Set<string>;
    viewMode: 'tree' | 'graph' | 'list';

    // 统计信息
    statistics: TreeStatistics | null;

    // 加载状态
    isLoading: boolean;
    error: string | null;

    // Tree operations
    setCurrentTree: (tree: ResearchTree | null) => void;
    setCurrentTreeNodes: (nodes: ResearchTreeNode[]) => void;
    addNode: (node: ResearchTreeNode) => void;
    updateNode: (nodeId: string, updates: Partial<ResearchTreeNode>) => void;
    removeNode: (nodeId: string) => void;

    // Tree management
    addTree: (tree: ResearchTree) => void;
    updateTree: (treeId: string, updates: Partial<ResearchTree>) => void;
    removeTree: (treeId: string) => void;

    // MCTS operations
    startMCTS: () => void;
    stopMCTS: () => void;
    addIteration: (iteration: MCTSIteration) => void;
    setCurrentIteration: (iteration: number) => void;

    // Expansion operations
    addExpansion: (expansion: ResearchExpansion) => void;

    // UI operations
    setSelectedNode: (nodeId: string | null) => void;
    toggleNodeExpansion: (nodeId: string) => void;
    setViewMode: (mode: 'tree' | 'graph' | 'list') => void;

    // Statistics
    setStatistics: (stats: TreeStatistics) => void;

    // Loading states
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;

    // Computed getters
    getRootNode: () => ResearchTreeNode | null;
    getNodeById: (nodeId: string) => ResearchTreeNode | null;
    getChildNodes: (nodeId: string) => ResearchTreeNode[];
    getNodePath: (nodeId: string) => ResearchTreeNode[];
    getBestNodes: (limit?: number) => ResearchTreeNode[];
}

export const useResearchTreeStore = create<ResearchTreeState>()(
    devtools(
        (set, get) => ({
            // 初始状态
            currentTree: null,
            currentTreeNodes: new Map(),
            trees: [],
            isRunningMCTS: false,
            currentIteration: 0,
            iterations: [],
            expansions: [],
            selectedNodeId: null,
            expandedNodeIds: new Set(),
            viewMode: 'tree',
            statistics: null,
            isLoading: false,
            error: null,

            // Tree operations
            setCurrentTree: (tree) => {
                set({ currentTree: tree, selectedNodeId: null });
                if (!tree) {
                    set({ currentTreeNodes: new Map() });
                }
            },

            setCurrentTreeNodes: (nodes) => {
                const nodeMap = new Map();
                nodes.forEach(node => nodeMap.set(node.id, node));
                set({ currentTreeNodes: nodeMap });
            },

            addNode: (node) => set((state) => {
                const newNodes = new Map(state.currentTreeNodes);
                newNodes.set(node.id, node);
                return { currentTreeNodes: newNodes };
            }),

            updateNode: (nodeId, updates) => set((state) => {
                const newNodes = new Map(state.currentTreeNodes);
                const existingNode = newNodes.get(nodeId);
                if (existingNode) {
                    newNodes.set(nodeId, {
                        ...existingNode,
                        ...updates,
                        updatedAt: new Date()
                    });
                }
                return { currentTreeNodes: newNodes };
            }),

            removeNode: (nodeId) => set((state) => {
                const newNodes = new Map(state.currentTreeNodes);
                newNodes.delete(nodeId);
                return { currentTreeNodes: newNodes };
            }),

            // Tree management
            addTree: (tree) => set((state) => ({
                trees: [...state.trees, tree]
            })),

            updateTree: (treeId, updates) => set((state) => ({
                trees: state.trees.map(tree =>
                    tree.id === treeId ? { ...tree, ...updates, updatedAt: new Date() } : tree
                ),
                currentTree: state.currentTree?.id === treeId
                    ? { ...state.currentTree, ...updates, updatedAt: new Date() }
                    : state.currentTree
            })),

            removeTree: (treeId) => set((state) => ({
                trees: state.trees.filter(tree => tree.id !== treeId),
                currentTree: state.currentTree?.id === treeId ? null : state.currentTree
            })),

            // MCTS operations
            startMCTS: () => set({ isRunningMCTS: true }),
            stopMCTS: () => set({ isRunningMCTS: false }),

            addIteration: (iteration) => set((state) => ({
                iterations: [...state.iterations, iteration],
                currentIteration: iteration.iterationNumber
            })),

            setCurrentIteration: (iteration) => set({ currentIteration: iteration }),

            // Expansion operations
            addExpansion: (expansion) => set((state) => ({
                expansions: [...state.expansions, expansion]
            })),

            // UI operations
            setSelectedNode: (nodeId) => set({ selectedNodeId: nodeId }),

            toggleNodeExpansion: (nodeId) => set((state) => {
                const newExpanded = new Set(state.expandedNodeIds);
                if (newExpanded.has(nodeId)) {
                    newExpanded.delete(nodeId);
                } else {
                    newExpanded.add(nodeId);
                }
                return { expandedNodeIds: newExpanded };
            }),

            setViewMode: (mode) => set({ viewMode: mode }),

            // Statistics
            setStatistics: (stats) => set({ statistics: stats }),

            // Loading states
            setLoading: (loading) => set({ isLoading: loading }),
            setError: (error) => set({ error }),

            // Computed getters
            getRootNode: () => {
                const state = get();
                if (!state.currentTree) return null;
                return state.currentTreeNodes.get(state.currentTree.rootNodeId) || null;
            },

            getNodeById: (nodeId) => {
                const state = get();
                return state.currentTreeNodes.get(nodeId) || null;
            },

            getChildNodes: (nodeId) => {
                const state = get();
                const node = state.currentTreeNodes.get(nodeId);
                if (!node) return [];

                return node.children
                    .map(childId => state.currentTreeNodes.get(childId))
                    .filter((child): child is ResearchTreeNode => child !== undefined);
            },

            getNodePath: (nodeId) => {
                const state = get();
                const path: ResearchTreeNode[] = [];
                let currentId: string | undefined = nodeId;

                while (currentId) {
                    const node = state.currentTreeNodes.get(currentId);
                    if (!node) break;
                    path.unshift(node);
                    currentId = node.parentId;
                }

                return path;
            },

            getBestNodes: (limit = 10) => {
                const state = get();
                const nodes = Array.from(state.currentTreeNodes.values());

                return nodes
                    .filter(node => node.visits > 0)
                    .sort((a, b) => {
                        const scoreA = a.wins / a.visits;
                        const scoreB = b.wins / b.visits;
                        return scoreB - scoreA;
                    })
                    .slice(0, limit);
            }
        }),
        {
            name: 'research-tree-store',
        }
    )
);
