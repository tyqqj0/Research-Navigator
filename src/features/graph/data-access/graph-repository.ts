// Research Graph Domain - Repository (Dexie)

import Dexie, { Table } from 'dexie';
import type {
    ResearchGraph,
    GraphNode,
    GraphEdge,
    PaperId,
    EdgeId,
    GraphImportResult
} from './graph-types';

/**
 * Dexie database for Research Graph
 * Stores entire graph objects keyed by graph id for simplicity.
 */
class GraphDatabase extends Dexie {
    graphs!: Table<ResearchGraph, string>;

    constructor() {
        super('ResearchNavigatorGraph');

        this.version(1).stores({
            graphs: 'id'
        });
    }
}

const db = new GraphDatabase();

// ========== Utility helpers ==========

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

function createDedupeKey(from: string, to: string, relation: string): string {
    return `${from}→${to}#${relation}`;
}

function hashString(input: string): string {
    // djb2 string hash, returns unsigned 32-bit hex
    let hash = 5381;
    for (let i = 0; i < input.length; i += 1) {
        hash = ((hash << 5) + hash) + input.charCodeAt(i);
        hash |= 0; // force 32-bit
    }
    const unsigned = hash >>> 0;
    return unsigned.toString(16);
}

function generateEdgeId(from: string, to: string, relation: string): EdgeId {
    const key = createDedupeKey(from, to, relation);
    return `ed_${hashString(key)}`;
}

// ========== Repository ==========

export class GraphRepository {
    async createGraph(initial?: Partial<ResearchGraph>): Promise<ResearchGraph> {
        const id = initial?.id ?? crypto.randomUUID();
        const graph: ResearchGraph = {
            id,
            nodes: initial?.nodes ?? {},
            edges: initial?.edges ?? {}
        };
        await db.graphs.put(graph);
        return graph;
    }

    async getGraph(graphId: string): Promise<ResearchGraph | null> {
        return await db.graphs.get(graphId) ?? null;
    }

    async saveGraph(graph: ResearchGraph): Promise<void> {
        await db.graphs.put(graph);
    }

    async deleteGraph(graphId: string): Promise<void> {
        await db.graphs.delete(graphId);
    }

    async listGraphs(): Promise<Pick<ResearchGraph, 'id'>[]> {
        const all = await db.graphs.toArray();
        return all.map(g => ({ id: g.id }));
    }

    // ----- Node operations -----

    async addNode(graphId: string, node: GraphNode): Promise<ResearchGraph> {
        return await db.transaction('rw', db.graphs, async () => {
            const graph = await db.graphs.get(graphId);
            assert(graph, `Graph not found: ${graphId}`);

            const updated: ResearchGraph = {
                ...graph,
                nodes: { ...graph.nodes, [node.id]: node }
            };
            await db.graphs.put(updated);
            return updated;
        });
    }

    async removeNode(graphId: string, paperId: PaperId): Promise<ResearchGraph> {
        return await db.transaction('rw', db.graphs, async () => {
            const graph = await db.graphs.get(graphId);
            assert(graph, `Graph not found: ${graphId}`);

            if (!(paperId in graph.nodes)) return graph;

            const nodes = { ...graph.nodes };
            delete nodes[paperId];

            // remove any edges touching this node
            const edges: Record<EdgeId, GraphEdge> = {};
            for (const [eid, e] of Object.entries(graph.edges)) {
                if (e.from !== paperId && e.to !== paperId) edges[eid] = e;
            }

            const updated: ResearchGraph = { ...graph, nodes, edges };
            await db.graphs.put(updated);
            return updated;
        });
    }

    // ----- Edge operations -----

    async addEdge(graphId: string, edge: Omit<GraphEdge, 'id'> & { id?: EdgeId }): Promise<ResearchGraph> {
        return await db.transaction('rw', db.graphs, async () => {
            const graph = await db.graphs.get(graphId);
            assert(graph, `Graph not found: ${graphId}`);

            // validate nodes exist
            assert(graph.nodes[edge.from], `Edge.from does not exist: ${edge.from}`);
            assert(graph.nodes[edge.to], `Edge.to does not exist: ${edge.to}`);

            const id: EdgeId = edge.id ?? generateEdgeId(edge.from, edge.to, edge.relation);

            // dedupe: if exists with same from/to/relation id, keep existing
            const existing = graph.edges[id];
            if (existing) return graph;

            const updated: ResearchGraph = {
                ...graph,
                edges: { ...graph.edges, [id]: { id, ...edge } }
            };
            await db.graphs.put(updated);
            return updated;
        });
    }

    async removeEdge(graphId: string, edgeId: EdgeId): Promise<ResearchGraph> {
        return await db.transaction('rw', db.graphs, async () => {
            const graph = await db.graphs.get(graphId);
            assert(graph, `Graph not found: ${graphId}`);
            if (!(edgeId in graph.edges)) return graph;

            const edges = { ...graph.edges };
            delete edges[edgeId];

            const updated: ResearchGraph = { ...graph, edges };
            await db.graphs.put(updated);
            return updated;
        });
    }

    async listNeighbors(graphId: string, paperId: PaperId): Promise<{ paper: GraphNode; via: GraphEdge }[]> {
        const graph = await db.graphs.get(graphId);
        assert(graph, `Graph not found: ${graphId}`);

        const results: { paper: GraphNode; via: GraphEdge }[] = [];
        for (const edge of Object.values(graph.edges)) {
            if (edge.from === paperId) {
                const neighbor = graph.nodes[edge.to];
                if (neighbor) results.push({ paper: neighbor, via: edge });
            } else if (edge.to === paperId) {
                const neighbor = graph.nodes[edge.from];
                if (neighbor) results.push({ paper: neighbor, via: edge });
            }
        }
        return results;
    }

    // ----- JSON Import/Export -----

    async exportGraphToJson(graphId: string): Promise<string> {
        const graph = await db.graphs.get(graphId);
        assert(graph, `Graph not found: ${graphId}`);
        return JSON.stringify(graph, null, 2);
    }

    async importGraphFromJson(json: string, options?: { overwrite?: boolean; generateNewId?: boolean }): Promise<GraphImportResult> {
        const warnings: string[] = [];
        let parsed: unknown;
        try {
            parsed = JSON.parse(json);
        } catch {
            throw new Error('Invalid JSON');
        }

        const candidate = parsed as Partial<ResearchGraph>;
        assert(typeof candidate === 'object' && candidate !== null, 'Invalid graph payload');
        assert(typeof candidate.id === 'string', 'Graph.id is required');
        assert(candidate.nodes && typeof candidate.nodes === 'object', 'Graph.nodes is required');
        assert(candidate.edges && typeof candidate.edges === 'object', 'Graph.edges is required');

        const graphId = options?.generateNewId ? crypto.randomUUID() : (candidate.id as string);

        // type-safe reconstruction and validation
        const nodes: Record<PaperId, GraphNode> = {};
        for (const [pid, node] of Object.entries(candidate.nodes as Record<string, GraphNode>)) {
            if (!node || typeof node !== 'object') continue;
            if (!node.id || typeof node.id !== 'string') continue;
            nodes[pid] = { id: node.id, kind: 'paper', meta: node.meta };
        }

        const edges: Record<EdgeId, GraphEdge> = {};
        for (const e of Object.values(candidate.edges as Record<string, GraphEdge>)) {
            if (!e || typeof e !== 'object') continue;
            if (!e.from || !e.to || !e.relation) continue;
            if (!nodes[e.from]) { warnings.push(`Drop edge (missing from node): ${e.from}`); continue; }
            if (!nodes[e.to]) { warnings.push(`Drop edge (missing to node): ${e.to}`); continue; }
            const id = e.id ?? generateEdgeId(e.from, e.to, e.relation);
            if (edges[id]) { warnings.push(`Drop duplicated edge id: ${id}`); continue; }
            edges[id] = { id, from: e.from, to: e.to, relation: e.relation, tags: e.tags, meta: e.meta };
        }

        const graph: ResearchGraph = { id: graphId, nodes, edges };

        if (options?.overwrite) {
            await db.graphs.put(graph);
        } else {
            const exists = await db.graphs.get(graph.id);
            if (exists) warnings.push(`Graph already exists: ${graph.id}`);
            await db.graphs.put(graph);
        }

        return { graph, warnings };
    }
}

export const graphRepository = new GraphRepository();


