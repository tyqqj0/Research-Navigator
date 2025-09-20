import type { WebDiscoveryAPI, DiscoveryResult, DiscoveryCandidate } from './types';
import { tavilySearch } from './adapters/tavily-adapter';
import { buildCandidatesFromWebResults } from './id-extractor';
import { backendApiService } from '../data-access/services/backend-api-service';
import { literatureEntry } from '../data-access';

export const webDiscovery: WebDiscoveryAPI = {
    async searchWeb(query, opts) {
        const items = await tavilySearch(query, { maxResults: opts?.limit, includeDomains: opts?.includeDomains });
        const candidates = buildCandidatesFromWebResults(query, items);
        return { query, candidates } as DiscoveryResult;
    },

    async resolveToPaperIds(candidates) {
        const ids = candidates
            .map(c => c.bestIdentifier)
            .filter(Boolean) as string[];
        if (ids.length === 0) return { paperIds: [], resolved: [] };

        // 批量解析：尽可能用批量接口，但后端当前暴露 getPapersBatch 仅接受统一 paperIds
        // 这里逐条调用 getPaper；不再直接解析 URL，优先 DOI，其次 ARXIV
        const resolved: Array<{ candidateId: string; paperId: string }> = [];
        for (const c of candidates) {
            if (!c.bestIdentifier) continue;
            try {
                // 只接受 S2 / DOI / ARXIV 三种；URL 将在更早阶段转换，否则跳过
                let identifier = c.bestIdentifier;
                if (/^URL:/i.test(identifier)) {
                    // 跳过 URL，统一改由前置阶段抽取 DOI 或 ARXIV
                    continue;
                }
                const idForPath = /^(DOI:)/i.test(identifier)
                    ? encodeURIComponent(identifier)
                    : identifier;
                const lit = await backendApiService.getPaper(idForPath);
                if (lit?.paperId) resolved.push({ candidateId: c.id, paperId: lit.paperId });
            } catch { /* ignore single failure */ }
        }
        return { paperIds: resolved.map(r => r.paperId), resolved };
    },

    async addCandidateToLibrary(candidate, options) {
        if (!candidate.bestIdentifier) throw new Error('该候选缺少可用标识');
        const item = await literatureEntry.addByIdentifier(candidate.bestIdentifier, options);
        return { paperId: item.paperId };
    },

    async addIdentifierToLibrary(identifier, options) {
        const item = await literatureEntry.addByIdentifier(identifier, options);
        return { paperId: item.paperId };
    }
};

export default webDiscovery;


