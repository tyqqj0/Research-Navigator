// Research Graph Domain - Types (paperId-only)

export type GraphId = string;
export type EdgeId = string;
export type PaperId = string;

export type GraphNodeKind = 'paper';

export interface PaperNode {
    id: PaperId;           // equal to paperId
    kind: GraphNodeKind;   // 'paper'
    meta?: Record<string, unknown>;
}

export type GraphNode = PaperNode;

export interface GraphEdge {
    id: EdgeId;
    from: PaperId;
    to: PaperId;
    relation: string;
    tags?: string[];
    meta?: Record<string, unknown>;
}

export interface ResearchGraph {
    id: GraphId;
    name?: string;
    nodes: Record<PaperId, GraphNode>;
    edges: Record<EdgeId, GraphEdge>;
}

export interface GraphImportResult {
    graph: ResearchGraph;
    warnings: string[];
}

// Snapshot used by UI (immutable per tick)
export interface GraphSnapshot {
    id: GraphId;
    name?: string;
    nodes: Record<PaperId, GraphNode>;
    edges: Record<EdgeId, GraphEdge>;
}

// Abstract data source to decouple UI from storage/backend
export interface GraphDataSource {
    getSnapshot(graphId: GraphId): GraphSnapshot | null;
    subscribe(graphId: GraphId, cb: (snap: GraphSnapshot) => void): () => void;

    addNode(graphId: GraphId, node: GraphNode): Promise<void>;
    removeNode(graphId: GraphId, paperId: PaperId): Promise<void>;
    addEdge(graphId: GraphId, edge: Omit<GraphEdge, 'id'> & { id?: EdgeId }): Promise<void>;
    removeEdge(graphId: GraphId, edgeId: EdgeId): Promise<void>;
}


