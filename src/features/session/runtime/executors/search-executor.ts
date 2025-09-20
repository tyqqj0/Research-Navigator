import type { Artifact } from '../../data-access/types';
import { webDiscovery } from '@/features/literature/discovery/web-discovery-service';
import { useSettingsStore } from '@/features/user/settings/data-access/settings-store';

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
        const dom = (useSettingsStore.getState().search.searchDomainStrategy?.tavily?.domains) || { predefined: [], custom: [] };
        const includeDomains = [...(dom.predefined || []), ...(dom.custom || [])].filter(Boolean);
        const res = await webDiscovery.searchWeb(query, { limit, includeDomains: includeDomains.length ? includeDomains : undefined });
        return { id: crypto.randomUUID(), kind: 'search_candidates', version: 1, data: { query, candidates: res.candidates }, createdAt: Date.now() };
    },

    // Resolve candidates to paperIds and return a search_batch for merging
    async execute(query: string, size: number = 12): Promise<Artifact<{ paperIds: string[]; query: string }>> {
        const dom = (useSettingsStore.getState().search.searchDomainStrategy?.tavily?.domains) || { predefined: [], custom: [] };
        const includeDomains = [...(dom.predefined || []), ...(dom.custom || [])].filter(Boolean);
        const cands = await webDiscovery.searchWeb(query, { limit: size, includeDomains: includeDomains.length ? includeDomains : undefined });
        const resolved = await webDiscovery.resolveToPaperIds(cands.candidates);
        return { id: crypto.randomUUID(), kind: 'search_batch', version: 1, data: { paperIds: resolved.paperIds, query }, createdAt: Date.now() };
    }
};


