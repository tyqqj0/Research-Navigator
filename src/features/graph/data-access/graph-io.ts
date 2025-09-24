// Research Graph Domain - Public IO helpers (import/export only)

import type { GraphImportResult, ResearchGraph, PaperId } from './graph-types';
import { graphRepository } from './graph-repository';
import { literatureDataAccess } from '@/features/literature/data-access';

export async function exportGraphToJson(graphId: string): Promise<string> {
    return await graphRepository.exportGraphToJson(graphId);
}

export async function importGraphFromJson(json: string, options?: { overwrite?: boolean; generateNewId?: boolean }): Promise<GraphImportResult> {
    return await graphRepository.importGraphFromJson(json, options);
}

export interface GraphBriefNode { id: string; title: string; firstAuthor?: string; year?: number; abstract?: string }
export interface GraphBriefEdge { id: string; from: string; to: string; relation: string; fromTitle?: string; toTitle?: string }

export async function exportGraphBriefDataset(graphId: string): Promise<{ nodes: GraphBriefNode[]; edges: GraphBriefEdge[] }> {
    const graph: ResearchGraph | null = await graphRepository.getGraph(graphId);
    if (!graph) throw new Error('Graph not found');
    const nodeIds: string[] = Object.keys(graph.nodes);
    const extractFirstAuthor = (authors: any): string | undefined => {
        if (!authors || !Array.isArray(authors) || authors.length === 0) return undefined;
        const first = authors[0];
        if (typeof first === 'string') return first || undefined;
        if (first && typeof first === 'object') {
            const name = first.name || first.fullName || first.display_name || first.displayName || first.author_name;
            return name || undefined;
        }
        return undefined;
    };
    const briefs = await Promise.all(nodeIds.map(async (id: string) => {
        try {
            const item = await literatureDataAccess.literatures.getEnhanced(id as any);
            return {
                id,
                title: item?.literature?.title || id,
                firstAuthor: extractFirstAuthor(item?.literature?.authors),
                year: item?.literature?.year,
                abstract: item?.literature?.abstract
            } as GraphBriefNode;
        } catch {
            return { id, title: id } as GraphBriefNode;
        }
    }));
    const idToTitle: Record<PaperId, string> = Object.fromEntries(briefs.map(b => [b.id, b.title]));
    const edges: GraphBriefEdge[] = Object.values(graph.edges).map(e => ({ id: e.id, from: e.from, to: e.to, relation: e.relation, fromTitle: idToTitle[e.from], toTitle: idToTitle[e.to] }));
    return { nodes: briefs, edges };
}


