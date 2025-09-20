import type { Artifact } from '../../data-access/types';
import { webDiscovery } from '@/features/literature/discovery/web-discovery-service';

export type SearchCandidates = {
    query: string;
    candidates: Array<{
        id: string;
        title?: string;
        snippet?: string;
        sourceUrl: string;
        site?: string;
        bestIdentifier?: string;
        confidence: number;
    }>;
};

export const searchExecutor = {
    // Return candidate links first (for the UI card), caller can decide ingestion policy
    async searchCandidates(query: string, limit: number = 8): Promise<Artifact<SearchCandidates>> {
        const res = await webDiscovery.searchWeb(query, { limit });
        return { id: crypto.randomUUID(), kind: 'search_candidates', version: 1, data: { query, candidates: res.candidates }, createdAt: Date.now() };
    },

    // Resolve candidates to paperIds and return a search_batch for merging
    async execute(query: string, size: number = 12): Promise<Artifact<{ paperIds: string[]; query: string }>> {
        const cands = await webDiscovery.searchWeb(query, { limit: size });
        const resolved = await webDiscovery.resolveToPaperIds(cands.candidates);
        return { id: crypto.randomUUID(), kind: 'search_batch', version: 1, data: { paperIds: resolved.paperIds, query }, createdAt: Date.now() };
    }
};


