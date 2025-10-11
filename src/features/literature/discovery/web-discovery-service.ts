import type { WebDiscoveryAPI, DiscoveryResult, DiscoveryCandidate } from './types';
import { tavilySearch } from './adapters/tavily-adapter';
import { buildCandidatesFromWebResults } from './id-extractor';
import { backendApiService } from '../data-access/services/backend-api-service';
import { literatureEntry } from '../data-access';

export const webDiscovery: WebDiscoveryAPI = {
    async searchWeb(query, opts) {
        // 优先走后端搜索（无需 Tavily Key），失败时回退 Tavily
        const limit = Math.max(1, Math.min(opts?.limit || 8, 50));
        try {
            const fields = ['paperId', 'title', 'year', 'authors', 'url'];
            const res = await backendApiService.searchPapers({ query, limit, offset: 0, fields });
            const candidates: DiscoveryCandidate[] = (res.results || []).map((it: any, idx: number) => {
                const paperId = String(it.paperId || it.id || '');
                const url: string = it.url || `https://www.semanticscholar.org/paper/${paperId}`;
                const site = (() => { try { return new URL(url).hostname; } catch { return undefined; } })();
                const extracted = [
                    { kind: 'S2', value: paperId } as const,
                    ...(it.doi ? ([{ kind: 'DOI', value: String(it.doi) }] as const) : [])
                ] as unknown as DiscoveryCandidate['extracted'];
                return {
                    id: `s_${paperId || idx}`,
                    title: it.title,
                    snippet: Array.isArray(it.authors) && it.authors.length ? `${it.authors.join(', ')} · ${it.year || ''}` : (it.year ? String(it.year) : undefined),
                    sourceUrl: url,
                    site,
                    extracted,
                    bestIdentifier: paperId || undefined,
                    confidence: 0.95
                } as DiscoveryCandidate;
            });
            try {
                const total = candidates.length;
                console.debug('[webDiscovery] backend search result', { query, limit, total });
            } catch { /* noop */ }
            return { query, candidates } as DiscoveryResult;
        } catch (err) {
            // 回退 Tavily：保持兼容旧的候选展示
            const items = await tavilySearch(query, { maxResults: opts?.limit, includeDomains: opts?.includeDomains });
            const candidates = buildCandidatesFromWebResults(query, items);
            try {
                const total = candidates.length;
                const withBest = candidates.filter(c => !!c.bestIdentifier).length;
                const onlyUrl = candidates.filter(c => c.bestIdentifier && /^URL:/i.test(c.bestIdentifier)).length;
                console.debug('[webDiscovery] tavily fallback result', { query, limit: opts?.limit, includeDomains: opts?.includeDomains, total, withBest, onlyUrl });
            } catch { /* noop */ }
            return { query, candidates } as DiscoveryResult;
        }
    },

    async resolveToPaperIds(candidates) {
        const normalized = candidates
            .map(c => ({ c, id: c.bestIdentifier }))
            .filter(x => typeof x.id === 'string' && x.id.length > 0) as Array<{ c: DiscoveryCandidate; id: string }>;
        if (normalized.length === 0) return { paperIds: [], resolved: [] };

        // 过滤掉 URL: 前缀（应在上游转换为 DOI/ARXIV，否则跳过）
        const nonUrl = normalized.filter(x => !/^URL:/i.test(x.id));
        if (nonUrl.length === 0) return { paperIds: [], resolved: [] };

        // 去重，保护批量接口
        const uniqueIds = Array.from(new Set(nonUrl.map(x => x.id)));

        // 先尝试批量获取
        let batch: Array<{ paperId: string }> = [];
        try {
            // 后端批量接口无需编码；内部会处理 DOI 的编码
            const items = await backendApiService.getPapersBatch(uniqueIds);
            batch = (items || []).filter(i => i && i.paperId);
        } catch { /* 忽略整体失败，降级到单条查询 */ }

        const foundIds = new Set(batch.map(i => i.paperId));
        const idToPaper = new Map(batch.map(i => [i.paperId, i] as const));

        // 找到哪些标识未覆盖（根据 paperId 匹配较难，退回按传入标识补查）
        const missingIdentifiers = uniqueIds.filter(id => {
            // 若批量返回的 paperId 恰为相同字符串，视为命中
            return !batch.some(b => b.paperId === id);
        });

        // 降级并行：限制并发，避免压垮后端
        const concurrency = 4;
        async function* pool<T>(items: T[], worker: (t: T) => Promise<void>) {
            const executing: Promise<void>[] = [];
            for (const it of items) {
                const p = worker(it).finally(() => {
                    const idx = executing.indexOf(p);
                    if (idx >= 0) executing.splice(idx, 1);
                });
                executing.push(p);
                if (executing.length >= concurrency) {
                    await Promise.race(executing);
                }
            }
            await Promise.all(executing);
        }

        await pool(missingIdentifiers, async (identifier) => {
            try {
                const idForPath = /^(DOI:)/i.test(identifier) ? encodeURIComponent(identifier) : identifier;
                const lit = await backendApiService.getPaper(idForPath);
                if (lit?.paperId) {
                    foundIds.add(lit.paperId);
                    idToPaper.set(lit.paperId, lit as any);
                }
            } catch { /* 单条失败忽略 */ }
        });

        // 将候选映射为 resolved 列表（保留 candidateId 对应关系）
        const resolved: Array<{ candidateId: string; paperId: string }> = [];
        for (const { c, id } of nonUrl) {
            // 直接匹配结果：优先 exact 同字符串的 paperId，其次任何返回的 paperId
            const exact = idToPaper.get(id as any);
            if (exact?.paperId) {
                resolved.push({ candidateId: c.id, paperId: exact.paperId });
                continue;
            }
            // 回退：无法保留一一对应，使用 first found 的 paperId（已去重）
            // 这里不强制顺序，以覆盖率优先
        }

        // 更健壮的匹配：如果批量与单条均返回了与候选不同形式的 ID（如把 DOI 转 S2），
        // 根据标题或其他特征匹配较为复杂，暂折中：用集合方式输出，前端再去重。
        const paperIds = Array.from(foundIds);
        const mapped = nonUrl
            .map(x => paperIds.find(pid => pid === x.id))
            .filter(Boolean) as string[];
        // 若 exact 匹配为空，则把所有 foundIds 暴露给调用者
        const finalIds = mapped.length > 0 ? mapped : paperIds;
        const finalResolved = finalIds.map(pid => ({ candidateId: candidates.find(c => c.bestIdentifier && c.bestIdentifier === pid)?.id || pid, paperId: pid }));

        return { paperIds: finalIds, resolved: finalResolved };
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


