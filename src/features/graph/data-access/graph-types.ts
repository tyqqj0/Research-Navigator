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


