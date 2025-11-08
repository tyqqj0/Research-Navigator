/**
 * Candidate Selection Executor V2
 * 
 * 使用新的 importance 模块替换旧的排序逻辑
 * 支持从本地数据库或 backend API 获取元数据并评分
 */

import { backendApiService } from '@/features/literature/data-access/services/backend-api-service';
import { literatureRepository } from '@/features/literature/data-access/repositories';
import { importanceService } from '@/features/literature/importance';
import { calculateQualityScore } from '@/features/literature/importance/core/score';
import { getQualityWeights } from '@/features/literature/importance/core/presets';
import type { QualityMode, QualityWeights, PaperMetadata } from '@/features/literature/importance/ports/types';

export type CandidateSelectionStrategy = 'random' | 'quality';
export type { QualityMode, QualityWeights };

interface Candidate {
    title?: string;
    bestIdentifier?: string;
    sourceUrl: string;
    [key: string]: any;
}

interface CandidateWithScore {
    candidate: Candidate;
    score: number;
    paperId?: string;
    metadata?: PaperMetadata;
}

/**
 * 从 bestIdentifier 尝试查找本地数据库中的 paperId
 */
async function resolvePaperIdFromIdentifier(identifier: string): Promise<string | null> {
    if (!identifier || /^URL:/i.test(identifier)) {
        return null;
    }

    try {
        // 尝试直接使用 identifier 作为 paperId 查找
        const item = await literatureRepository.findByLid(identifier);
        if (item) {
            return item.paperId;
        }

        // 如果 identifier 是 S2:xxx 格式，提取 xxx 部分
        const s2Match = identifier.match(/^S2:(.+)$/i);
        if (s2Match) {
            const s2Id = s2Match[1];
            const item2 = await literatureRepository.findByLid(s2Id);
            if (item2) {
                return item2.paperId;
            }
        }

        // 如果 identifier 是 DOI:xxx 或 ARXIV:xxx，尝试在数据库中搜索
        // 这里简化处理，实际可能需要更复杂的匹配逻辑
        return null;
    } catch {
        return null;
    }
}

/**
 * 从 backend API 获取元数据
 */
async function fetchMetadataFromBackend(identifier: string): Promise<PaperMetadata | null> {
    if (!identifier || /^URL:/i.test(identifier)) {
        return null;
    }

    try {
        const paper = await backendApiService.getPaper(identifier);
        if (!paper) {
            return null;
        }

        return {
            year: paper.year ?? undefined,
            publicationDate: paper.publicationDate ?? undefined,
            venue: paper.publication ?? undefined,
            citationCount: paper.citationCount ?? undefined,
            influentialCitationCount: paper.influentialCitationCount ?? undefined,
        };
    } catch {
        return null;
    }
}

/**
 * 批量从 backend API 获取元数据
 */
async function fetchMetadataBatchFromBackend(
    identifiers: string[]
): Promise<Map<string, PaperMetadata>> {
    const metadataMap = new Map<string, PaperMetadata>();
    const nonUrl = identifiers.filter(id => id && !/^URL:/i.test(id));

    if (nonUrl.length === 0) {
        return metadataMap;
    }

    try {
        const batch = await backendApiService.getPapersBatch(nonUrl);
        const byPaperId = new Map<string, any>();
        const byDoi = new Map<string, any>();
        const byArxiv = new Map<string, any>();

        const normDoi = (s: string) => String(s || '').trim().toLowerCase();
        const normArxiv = (s: string) => String(s || '').trim().toLowerCase();

        for (const it of batch || []) {
            if (!it) continue;
            if (it.paperId) byPaperId.set(String(it.paperId), it);
            const d = (it as any).doi as string | undefined;
            if (d) {
                const v = d.trim();
                if (/^10\./i.test(v)) byDoi.set(normDoi(v), it);
                else if (/^\d{4}\.\d{4,5}(v\d+)?$/i.test(v) || /^arxiv:/i.test(v)) {
                    byArxiv.set(normArxiv(v.replace(/^arxiv:/i, '')), it);
                }
            }
        }

        const resolve = (identifier: string): any | undefined => {
            const s = String(identifier);
            if (byPaperId.has(s)) return byPaperId.get(s);
            const mD = s.match(/^DOI:(.+)$/i);
            if (mD) {
                const k = normDoi(mD[1]);
                if (byDoi.has(k)) return byDoi.get(k);
            }
            const mA = s.match(/^ARXIV:(.+)$/i);
            if (mA) {
                const k = normArxiv(mA[1]);
                if (byArxiv.has(k)) return byArxiv.get(k);
            }
            return undefined;
        };

        for (const id of nonUrl) {
            const hit = resolve(id);
            if (hit) {
                metadataMap.set(id, {
                    year: hit.year ?? undefined,
                    publicationDate: hit.publicationDate ?? hit.publication_date ?? undefined,
                    venue: hit.publication ?? hit.venue ?? undefined,
                    citationCount: hit.citationCount ?? hit.citation_count ?? undefined,
                    influentialCitationCount: hit.influentialCitationCount ?? hit.influential_citation_count ?? undefined,
                });
            }
        }
    } catch {
        // 忽略批量获取失败，后续会回退到单个获取
    }

    // 对于批量获取失败的，回退到单个获取
    await Promise.allSettled(
        nonUrl.map(async (id) => {
            if (metadataMap.has(id)) return;
            const metadata = await fetchMetadataFromBackend(id);
            if (metadata) {
                metadataMap.set(id, metadata);
            }
        })
    );

    return metadataMap;
}

/**
 * 使用新的 importance 模块对候选进行排序和选择
 */
export async function rankAndPickCandidates(
    candidates: Candidate[],
    opts: {
        strategy: CandidateSelectionStrategy;
        topK: number;
        mode?: QualityMode;
        weights?: Partial<QualityWeights>;
        minCitationCount?: number;
    }
): Promise<Candidate[]> {
    if (!candidates || candidates.length === 0) {
        return [];
    }

    const topK = Math.max(1, Math.min(opts.topK, candidates.length));

    // Random strategy: shuffle and take topK
    if (opts.strategy === 'random') {
        const shuffled = [...candidates];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled.slice(0, topK);
    }

    // Quality strategy: 使用新的 importance 模块
    const fullWeights = getQualityWeights(opts.mode, opts.weights);
    const minCitations = opts.minCitationCount || 0;

    // 1. 尝试从本地数据库解析 paperId
    const candidatePaperIds = new Map<number, string | null>();
    const candidateIdentifiers = candidates.map((c, idx) => ({ idx, id: c.bestIdentifier }))
        .filter(x => x.id && typeof x.id === 'string');

    await Promise.allSettled(
        candidateIdentifiers.map(async ({ idx, id }) => {
            const paperId = await resolvePaperIdFromIdentifier(id!);
            candidatePaperIds.set(idx, paperId);
        })
    );

    // 2. 分离已入库和未入库的候选
    const withPaperId: Array<{ idx: number; candidate: Candidate; paperId: string }> = [];
    const withoutPaperId: Array<{ idx: number; candidate: Candidate; identifier: string }> = [];

    for (const { idx, id } of candidateIdentifiers) {
        const paperId = candidatePaperIds.get(idx);
        if (paperId) {
            withPaperId.push({ idx, candidate: candidates[idx], paperId });
        } else {
            withoutPaperId.push({ idx, candidate: candidates[idx], identifier: id! });
        }
    }

    // 3. 对于已入库的，使用新的 importance 模块
    const scored: CandidateWithScore[] = [];

    if (withPaperId.length > 0) {
        const paperIds = withPaperId.map(x => x.paperId);
        const ranked = await importanceService.rankPaperIds(paperIds, {
            mode: opts.mode,
            weights: opts.weights,
            minCitationCount: minCitations,
        });

        const rankedMap = new Map(ranked.map(r => [r.paperId, r]));
        for (const { idx, candidate, paperId } of withPaperId) {
            const rankedScore = rankedMap.get(paperId);
            if (rankedScore) {
                scored.push({
                    candidate,
                    score: rankedScore.score,
                    paperId,
                    metadata: rankedScore.metadata,
                });
            } else {
                // 如果 importance 模块没有返回结果，给 0 分
                scored.push({
                    candidate,
                    score: 0,
                    paperId,
                });
            }
        }
    }

    // 4. 对于未入库的，使用 backend API 获取元数据，然后使用新的评分函数
    if (withoutPaperId.length > 0) {
        const identifiers = withoutPaperId.map(x => x.identifier);
        const metadataMap = await fetchMetadataBatchFromBackend(identifiers);

        for (const { idx, candidate, identifier } of withoutPaperId) {
            const metadata = metadataMap.get(identifier);
            if (metadata) {
                const hasEnoughCitations = (metadata.citationCount || 0) >= minCitations;
                const { score } = calculateQualityScore(metadata, fullWeights);
                scored.push({
                    candidate,
                    score: hasEnoughCitations ? score : 0,
                    metadata,
                });
            } else {
                // 无法获取元数据，给 0 分
                scored.push({
                    candidate,
                    score: 0,
                });
            }
        }
    }

    // 5. 应用引用数过滤
    let filtered = scored;
    if (minCitations > 0) {
        const passFilter = scored.filter(s =>
            s.metadata && (s.metadata.citationCount || 0) >= minCitations
        );
        // 如果过滤太严格，保留一些低引用论文
        if (passFilter.length < topK) {
            const failed = scored.filter(s =>
                !s.metadata || (s.metadata.citationCount || 0) < minCitations
            ).sort((a, b) => b.score - a.score);
            filtered = [...passFilter, ...failed.slice(0, topK - passFilter.length)];
        } else {
            filtered = passFilter;
        }
    }

    // 6. 按分数排序
    filtered.sort((a, b) => b.score - a.score);

    // 7. ε-greedy 选择
    const epsilon = fullWeights.epsilon || 0.25;
    const numExploit = Math.floor(topK * (1 - epsilon));
    const numExplore = topK - numExploit;

    const selected: Candidate[] = [];

    // Exploitation: 选择高分论文
    for (let i = 0; i < numExploit && i < filtered.length; i++) {
        selected.push(filtered[i].candidate);
    }

    // Exploration: 随机选择剩余候选
    if (numExplore > 0 && filtered.length > numExploit) {
        const remaining = filtered.slice(numExploit);
        const shuffled = [...remaining];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        for (let i = 0; i < numExplore && i < shuffled.length; i++) {
            selected.push(shuffled[i].candidate);
        }
    }

    // 8. 日志统计
    try {
        const withMetadata = scored.filter(s => s.metadata).length;
        const avgScore = scored.reduce((sum, s) => sum + s.score, 0) / scored.length;
        const selectedScores = selected.map(c => scored.find(s => s.candidate === c)?.score || 0);
        const avgSelectedScore = selectedScores.reduce((sum, s) => sum + s, 0) / selectedScores.length;
        console.debug('[candidateSelectorV2] Selection summary', {
            strategy: opts.strategy,
            total: candidates.length,
            withMetadata,
            withPaperId: withPaperId.length,
            withoutPaperId: withoutPaperId.length,
            topK,
            selected: selected.length,
            avgScore: avgScore.toFixed(3),
            avgSelectedScore: avgSelectedScore.toFixed(3),
            epsilon,
        });
    } catch { /* noop */ }

    return selected;
}

/**
 * 获取候选统计信息（用于 UI/事件发射）
 */
export function getCandidateStats(
    candidates: Candidate[],
    metadataMap?: Map<number, PaperMetadata>
): { meanScore: number; ageMix: { recent: number; mid: number; old: number } } {
    if (!metadataMap || metadataMap.size === 0) {
        return { meanScore: 0, ageMix: { recent: 0, mid: 0, old: 0 } };
    }

    const currentYear = new Date().getFullYear();
    let recent = 0, mid = 0, old = 0;

    metadataMap.forEach((metadata) => {
        const age = metadata.year ? currentYear - metadata.year : 0;
        if (age <= 3) recent++;
        else if (age <= 7) mid++;
        else old++;
    });

    return {
        meanScore: 0, // 需要从外部传入分数
        ageMix: { recent, mid, old },
    };
}

