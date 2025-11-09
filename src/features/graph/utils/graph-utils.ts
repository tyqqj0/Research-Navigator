// Graph utility functions for importance scoring and mainline operations

import type { ResearchGraph, GraphNode, GraphEdge, PaperId } from '../data-access/graph-types';

/**
 * Get importance score from a node's meta field
 */
export function getNodeImportanceScore(node: GraphNode): number | undefined {
    if (!node.meta || typeof node.meta !== 'object') return undefined;
    const score = (node.meta as Record<string, unknown>).importanceScore;
    if (typeof score === 'number') return score;
    return undefined;
}

/**
 * Set importance score to a node's meta field
 */
export function setNodeImportanceScore(node: GraphNode, score: number): GraphNode {
    return {
        ...node,
        meta: {
            ...node.meta,
            importanceScore: score
        }
    };
}

/**
 * Check if a node is marked as mainline
 */
export function isMainlineNode(node: GraphNode): boolean {
    if (!node.meta || typeof node.meta !== 'object') return false;
    const isMainline = (node.meta as Record<string, unknown>).isMainline;
    return isMainline === true;
}

/**
 * Mark a node as mainline or not
 */
export function setMainlineNode(node: GraphNode, isMainline: boolean): GraphNode {
    return {
        ...node,
        meta: {
            ...node.meta,
            isMainline
        }
    };
}

/**
 * Get all mainline paper IDs from a graph
 */
export function getMainlineNodes(graph: ResearchGraph): PaperId[] {
    const mainlineIds: PaperId[] = [];
    for (const [paperId, node] of Object.entries(graph.nodes)) {
        if (isMainlineNode(node)) {
            mainlineIds.push(paperId);
        }
    }
    return mainlineIds;
}

/**
 * Check if an edge is a mainline edge (both ends are in mainline)
 */
export function isMainlineEdge(edge: GraphEdge, mainlineNodes: PaperId[]): boolean {
    const mainlineSet = new Set(mainlineNodes);
    return mainlineSet.has(edge.from) && mainlineSet.has(edge.to);
}

/**
 * Check if an edge connects mainline to sideline (one end is in mainline)
 */
export function isMainlineToSidelineEdge(edge: GraphEdge, mainlineNodes: PaperId[]): boolean {
    const mainlineSet = new Set(mainlineNodes);
    const fromInMainline = mainlineSet.has(edge.from);
    const toInMainline = mainlineSet.has(edge.to);
    return (fromInMainline && !toInMainline) || (!fromInMainline && toInMainline);
}

/**
 * Get edge tags with mainline classification
 * Returns tags array with appropriate mainline tag added
 */
export function classifyEdgeTags(
    edge: GraphEdge,
    mainlineNodes: PaperId[],
    existingTags?: string[]
): string[] {
    const tags = new Set(existingTags || edge.tags || []);

    // Remove old mainline classification tags if present
    tags.delete('mainline');
    tags.delete('mainline-to-sideline');
    tags.delete('sideline');

    // Add appropriate classification
    if (isMainlineEdge(edge, mainlineNodes)) {
        tags.add('mainline');
    } else if (isMainlineToSidelineEdge(edge, mainlineNodes)) {
        tags.add('mainline-to-sideline');
    } else {
        tags.add('sideline');
    }

    return Array.from(tags);
}

/**
 * Set isMainlineEdge flag in edge meta
 */
export function setMainlineEdgeFlag(edge: GraphEdge, isMainline: boolean): GraphEdge {
    return {
        ...edge,
        meta: {
            ...edge.meta,
            isMainlineEdge: isMainline
        }
    };
}

