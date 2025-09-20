import type { Artifact } from '../../data-access/types';

export interface Edge { sourceId: string; targetId: string; relation: string; confidence: number; rationale?: string }

export const graphBuilderExecutor = {
    async proposeRelationsText(papers: Array<{ id: string; title: string; abstract?: string }>): Promise<Artifact<string>> {
        const lines = papers.slice(0, 20).map(p => `Paper ${p.id} may extend methods in other related works.`);
        return { id: crypto.randomUUID(), kind: 'relation_text', version: 1, data: lines.join('\n'), createdAt: Date.now() };
    },
    async structureEdgesFromText(text: string, idMap: Record<string, string>): Promise<Artifact<Edge[]>> {
        const edges: Edge[] = Object.keys(idMap).slice(0, 5).map((k, i, arr) => {
            const next = arr[(i + 1) % arr.length];
            return { sourceId: idMap[k], targetId: idMap[next], relation: 'influences', confidence: 0.6 };
        });
        return { id: crypto.randomUUID(), kind: 'graph_edges', version: 1, data: edges, createdAt: Date.now() };
    }
};


