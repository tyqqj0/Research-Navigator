// Research Graph Domain - Zustand Store

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ResearchGraph, GraphNode, GraphEdge, PaperId, EdgeId, GraphDataSource, GraphSnapshot, GraphId } from './graph-types';
import { graphRepository } from './graph-repository';

interface GraphStoreState {
    // in-memory cache of opened graphs keyed by id
    graphs: Map<string, ResearchGraph>;
    currentGraphId: string | null;

    // ui states
    isLoading: boolean;
    error: string | null;

    // selectors
    getCurrentGraph: () => ResearchGraph | null;
    getGraphById: (graphId: string) => ResearchGraph | null;

    // graph management
    createGraph: (initial?: Partial<ResearchGraph>) => Promise<ResearchGraph>;
    loadGraph: (graphId: string) => Promise<ResearchGraph | null>;
    saveCurrentGraph: () => Promise<void>;
    setCurrentGraphId: (graphId: string | null) => void;
    deleteGraph: (graphId: string) => Promise<void>;
    listGraphs: () => Promise<{ id: string; name?: string }[]>;

    // node ops
    addNode: (node: GraphNode, opts?: { graphId?: string }) => Promise<void>;
    removeNode: (paperId: PaperId, opts?: { graphId?: string }) => Promise<void>;

    // edge ops
    addEdge: (edge: Omit<GraphEdge, 'id'> & { id?: EdgeId }, opts?: { graphId?: string }) => Promise<void>;
    removeEdge: (edgeId: EdgeId, opts?: { graphId?: string }) => Promise<void>;

    // json io
    exportCurrentGraphJson: () => Promise<string>;
    importGraphJson: (json: string, opts?: { overwrite?: boolean; generateNewId?: boolean }) => Promise<ResearchGraph>;
}

export const useGraphStore = create<GraphStoreState>()(
    devtools((set, get) => ({
        graphs: new Map(),
        currentGraphId: null,
        isLoading: false,
        error: null,

        getCurrentGraph: () => {
            const state = get();
            if (!state.currentGraphId) return null;
            return state.graphs.get(state.currentGraphId) ?? null;
        },

        getGraphById: (graphId) => {
            const state = get();
            return state.graphs.get(graphId) ?? null;
        },

        createGraph: async (initial) => {
            set({ isLoading: true, error: null });
            try {
                const graph = await graphRepository.createGraph(initial);
                set((state) => {
                    const graphs = new Map(state.graphs);
                    graphs.set(graph.id, graph);
                    return { graphs, currentGraphId: graph.id, isLoading: false };
                });
                return graph;
            } catch (e) {
                set({ error: (e as Error).message, isLoading: false });
                throw e;
            }
        },

        loadGraph: async (graphId) => {
            set({ isLoading: true, error: null });
            try {
                const graph = await graphRepository.getGraph(graphId);
                if (graph) {
                    set((state) => {
                        const graphs = new Map(state.graphs);
                        graphs.set(graph.id, graph);
                        return { graphs, currentGraphId: graph.id, isLoading: false };
                    });
                } else {
                    set({ isLoading: false });
                }
                return graph ?? null;
            } catch (e) {
                set({ error: (e as Error).message, isLoading: false });
                throw e;
            }
        },

        saveCurrentGraph: async () => {
            const state = get();
            const graph = state.getCurrentGraph();
            if (!graph) return;
            await graphRepository.saveGraph(graph);
        },

        setCurrentGraphId: (graphId) => set({ currentGraphId: graphId }),

        deleteGraph: async (graphId) => {
            set({ isLoading: true, error: null });
            try {
                await graphRepository.deleteGraph(graphId);
                set((state) => {
                    const graphs = new Map(state.graphs);
                    graphs.delete(graphId);
                    const isCurrent = state.currentGraphId === graphId;
                    return { graphs, currentGraphId: isCurrent ? null : state.currentGraphId, isLoading: false };
                });
            } catch (e) {
                set({ error: (e as Error).message, isLoading: false });
                throw e;
            }
        },

        listGraphs: async () => {
            return await graphRepository.listGraphs();
        },

        addNode: async (node, opts) => {
            const state = get();
            const target = opts?.graphId ? state.graphs.get(opts.graphId) ?? null : state.getCurrentGraph();
            if (!target) throw new Error('No target graph');
            const updated = await graphRepository.addNode(target.id, node);
            set((s) => {
                const graphs = new Map(s.graphs);
                const nextGraph = { ...updated, nodes: { ...updated.nodes }, edges: { ...updated.edges } };
                graphs.set(updated.id, nextGraph);
                return { graphs };
            });
        },

        removeNode: async (paperId, opts) => {
            const state = get();
            const target = opts?.graphId ? state.graphs.get(opts.graphId) ?? null : state.getCurrentGraph();
            if (!target) throw new Error('No target graph');
            const updated = await graphRepository.removeNode(target.id, paperId);
            set((s) => {
                const graphs = new Map(s.graphs);
                const nextGraph = { ...updated, nodes: { ...updated.nodes }, edges: { ...updated.edges } };
                graphs.set(updated.id, nextGraph);
                return { graphs };
            });
        },

        addEdge: async (edge, opts) => {
            const state = get();
            const target = opts?.graphId ? state.graphs.get(opts.graphId) ?? null : state.getCurrentGraph();
            if (!target) throw new Error('No target graph');
            const updated = await graphRepository.addEdge(target.id, edge);
            set((s) => {
                const graphs = new Map(s.graphs);
                const nextGraph = { ...updated, nodes: { ...updated.nodes }, edges: { ...updated.edges } };
                graphs.set(updated.id, nextGraph);
                return { graphs };
            });
        },

        removeEdge: async (edgeId, opts) => {
            const state = get();
            const target = opts?.graphId ? state.graphs.get(opts.graphId) ?? null : state.getCurrentGraph();
            if (!target) throw new Error('No target graph');
            const updated = await graphRepository.removeEdge(target.id, edgeId);
            set((s) => {
                const graphs = new Map(s.graphs);
                const nextGraph = { ...updated, nodes: { ...updated.nodes }, edges: { ...updated.edges } };
                graphs.set(updated.id, nextGraph);
                return { graphs };
            });
        },

        exportCurrentGraphJson: async () => {
            const state = get();
            const current = state.getCurrentGraph();
            if (!current) throw new Error('No current graph');
            return await graphRepository.exportGraphToJson(current.id);
        },

        importGraphJson: async (json, opts) => {
            const { graph } = await graphRepository.importGraphFromJson(json, opts);
            set((state) => {
                const graphs = new Map(state.graphs);
                graphs.set(graph.id, graph);
                return { graphs, currentGraphId: graph.id };
            });
            return graph;
        },
    }), { name: 'graph-store' })
);

export default useGraphStore;

// Adapter that makes current zustand store conform to GraphDataSource
// Lightweight pub-sub to guarantee UI updates even if selector subscriptions miss
const __dsSubscribers = new Map<GraphId, Set<(snap: GraphSnapshot) => void>>();
function __notify(graphId: GraphId) {
    const snap = graphStoreDataSource.getSnapshot(graphId);
    if (!snap) return;
    const subs = __dsSubscribers.get(graphId);
    if (!subs || subs.size === 0) return;
    for (const cb of Array.from(subs)) {
        try { cb(snap); } catch { /* noop */ }
    }
}

export const graphStoreDataSource: GraphDataSource = {
    getSnapshot(graphId: GraphId): GraphSnapshot | null {
        const s = useGraphStore.getState();
        const g = s.graphs.get(graphId) ?? null;
        if (!g) return null;
        // return shallow copy to prevent external mutation
        return { id: g.id, name: g.name, nodes: { ...g.nodes }, edges: { ...g.edges } };
    },
    subscribe(graphId: GraphId, cb: (snap: GraphSnapshot) => void): () => void {
        let set = __dsSubscribers.get(graphId);
        if (!set) { set = new Set(); __dsSubscribers.set(graphId, set); }
        set.add(cb);
        const unsubStore = useGraphStore.subscribe((state) => {
            if (state.graphs.has(graphId)) __notify(graphId);
        });
        return () => {
            try { unsubStore(); } catch { /* ignore */ }
            const curr = __dsSubscribers.get(graphId);
            if (curr) { curr.delete(cb); if (curr.size === 0) __dsSubscribers.delete(graphId); }
        };
    },
    async addNode(graphId: GraphId, node: GraphNode): Promise<void> {
        await useGraphStore.getState().addNode(node, { graphId });
        queueMicrotask(() => __notify(graphId));
    },
    async removeNode(graphId: GraphId, paperId: PaperId): Promise<void> {
        await useGraphStore.getState().removeNode(paperId, { graphId });
        queueMicrotask(() => __notify(graphId));
    },
    async addEdge(graphId: GraphId, edge: Omit<GraphEdge, 'id'> & { id?: EdgeId }): Promise<void> {
        await useGraphStore.getState().addEdge(edge, { graphId });
        queueMicrotask(() => __notify(graphId));
    },
    async removeEdge(graphId: GraphId, edgeId: EdgeId): Promise<void> {
        await useGraphStore.getState().removeEdge(edgeId, { graphId });
        queueMicrotask(() => __notify(graphId));
    },
};


