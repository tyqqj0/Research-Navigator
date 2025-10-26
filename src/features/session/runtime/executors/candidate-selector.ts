/**
 * Candidate Selection Executor
 * 
 * Post-search filtering and ranking of paper candidates using quality metrics or random sampling.
 * Supports age-normalized scoring to avoid bias towards older papers.
 */

import { backendApiService } from '@/features/literature/data-access/services/backend-api-service';
import { calculateVenueScore } from './venue-scorer';

export type CandidateSelectionStrategy = 'random' | 'quality';
export type QualityMode = 'balanced' | 'classic' | 'emerging';

export interface QualityWeights {
    influentialPerYear: number;  // w1: weight for citation impact per year
    recency: number;             // w2: weight for recency boost
    velocity?: number;           // w3: optional weight for citation velocity
    venue?: number;              // w4: weight for venue quality (CCF ranking)
    alpha?: number;              // age exponent for normalization (≈0.8)
    tau?: number;                // recency half-life in years (≈5)
    epsilon?: number;            // exploration rate for ε-greedy (≈0.2)
}

/**
 * Predefined quality presets for different research scenarios
 */
export const QUALITY_PRESETS: Record<QualityMode, Required<QualityWeights>> = {
    // Balanced: 平衡经典与新作，适合大多数场景
    balanced: {
        influentialPerYear: 1.5,
        recency: 0.4,
        velocity: 0.0,
        venue: 0.0,                // 不考虑发表质量
        alpha: 0.6,
        tau: 8,
        epsilon: 0.25
    },
    
    // Classic: 重视高引经典论文，适合文献综述、领域全景
    classic: {
        influentialPerYear: 2.0,   // 大幅提高引用权重
        recency: 0.3,              // 降低新近性要求
        velocity: 0.0,
        venue: 0.2,                // 考虑发表质量 
        alpha: 0.5,                // 很低的年龄惩罚
        tau: 10,                   // 长半衰期
        epsilon: 0.3               // 多探索，确保不漏经典
    },
    
    // Emerging: 重视新兴潜力论文，适合前沿追踪、趋势分析
    emerging: {
        influentialPerYear: 1.0,   // 适中的引用权重
        recency: 1.2,              // 大幅提高新近性
        velocity: 0.0,
        venue: 0.0,                // 不考虑发表质量（新兴论文可能在arXiv）
        alpha: 0.9,                // 较强的年龄惩罚
        tau: 3,                    // 短半衰期
        epsilon: 0.3               // 多探索，发现新星
    }
};

interface CandidateWithScore {
    candidate: { title?: string; bestIdentifier?: string; sourceUrl: string; [key: string]: any };
    score: number;
    metadata?: PaperMetadata;
}

interface PaperMetadata {
    paperId: string;
    title?: string;
    year?: number;
    publicationDate?: string;
    citationCount?: number;
    influentialCitationCount?: number;
    isOpenAccess?: boolean;
    venue?: string;
}

const DEFAULT_WEIGHTS: Required<QualityWeights> = {
    influentialPerYear: 1.0,
    recency: 0.7,
    velocity: 0.0,  // not yet available from backend
    venue: 0.2,     // venue quality (CCF ranking)
    alpha: 0.8,
    tau: 5,
    epsilon: 0.2
};

/**
 * Fetch metadata for candidates using backendApiService
 */
async function fetchCandidateMetadata(
    candidates: Array<{ title?: string; bestIdentifier?: string; sourceUrl: string; [key: string]: any }>
): Promise<Map<number, PaperMetadata>> {
    const metadataMap = new Map<number, PaperMetadata>();
    
    // Try to fetch metadata for each candidate
    await Promise.allSettled(
        candidates.map(async (candidate, idx) => {
            try {
                const id = candidate.bestIdentifier;
                if (!id || /^URL:/i.test(id)) {
                    // Fallback: search by title
                    if (candidate.title) {
                        const searchRes = await backendApiService.searchPapers({
                            query: candidate.title,
                            limit: 1,
                            fields: ['paperId', 'title', 'year', 'publicationDate', 'citationCount', 'influentialCitationCount', 'isOpenAccess', 'venue']
                        });
                        if (searchRes.results && searchRes.results.length > 0) {
                            const paper = searchRes.results[0];
                            metadataMap.set(idx, extractMetadata(paper));
                        }
                    }
                    return;
                }

                // Fetch paper details by identifier
                const paper = await backendApiService.getPaper(id);
                if (paper) {
                    metadataMap.set(idx, extractMetadata(paper));
                }
            } catch (err) {
                // Silently skip metadata fetch failures
                try {
                    console.debug('[candidateSelector] Failed to fetch metadata for candidate', { idx, error: String(err) });
                } catch { /* noop */ }
            }
        })
    );

    return metadataMap;
}

/**
 * Extract metadata from backend paper response
 */
function extractMetadata(paper: any): PaperMetadata {
    return {
        paperId: paper.paperId || paper.paper_id || paper.id || '',
        title: paper.title,
        year: paper.year,
        publicationDate: paper.publicationDate || paper.publication_date,
        citationCount: paper.citationCount || paper.citation_count || 0,
        influentialCitationCount: paper.influentialCitationCount || paper.influential_citation_count || 0,
        isOpenAccess: paper.isOpenAccess || paper.is_open_access || paper.openAccessPdf?.url != null,
        venue: paper.publication || paper.venue
    };
}

/**
 * Calculate quality score for a paper based on metadata
 */
function calculateQualityScore(metadata: PaperMetadata, weights: Required<QualityWeights>): number {
    const currentYear = new Date().getFullYear();
    
    // Compute age in years (minimum 1 year to avoid division by zero)
    let ageYears = 1;
    if (metadata.year) {
        ageYears = Math.max(1, currentYear - metadata.year + 1);
    } else if (metadata.publicationDate) {
        try {
            const pubDate = new Date(metadata.publicationDate);
            const ageMs = Date.now() - pubDate.getTime();
            ageYears = Math.max(1, ageMs / (365.25 * 24 * 60 * 60 * 1000));
        } catch {
            ageYears = 1;
        }
    }

    // S1: Age-normalized influential citation score
    const influential = metadata.influentialCitationCount || metadata.citationCount || 0;
    const s1 = Math.log(1 + influential) / Math.pow(ageYears, weights.alpha);

    // S2: Recency boost (exponential decay)
    const s2 = Math.exp(-ageYears / weights.tau);

    // S3: Velocity (optional, not yet available)
    const s3 = 0; // TODO: implement when backend provides citationVelocity

    // S4: Venue quality score (CCF ranking)
    const s4 = calculateVenueScore(metadata.venue);

    // Combined score
    const score = weights.influentialPerYear * s1 + 
                  weights.recency * s2 + 
                  weights.velocity * s3 + 
                  weights.venue * s4;

    return score;
}

/**
 * Get quality weights from preset or custom config
 */
export function getQualityWeights(
    mode?: QualityMode,
    customWeights?: Partial<QualityWeights>
): Required<QualityWeights> {
    // Priority: custom weights > preset mode > default
    if (mode && QUALITY_PRESETS[mode]) {
        return { ...QUALITY_PRESETS[mode], ...customWeights };
    }
    return { ...DEFAULT_WEIGHTS, ...customWeights };
}

/**
 * Rank and pick top candidates using specified strategy
 */
export async function rankAndPickCandidates(
    candidates: Array<{ title?: string; bestIdentifier?: string; sourceUrl: string; [key: string]: any }>,
    opts: { 
        strategy: CandidateSelectionStrategy; 
        topK: number; 
        mode?: QualityMode;  // New: quality preset mode
        weights?: Partial<QualityWeights>;
        minCitationCount?: number;  // New: minimum citation count filter
    }
): Promise<typeof candidates> {
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

    // Quality strategy: fetch metadata, score, and ε-greedy select
    const fullWeights = getQualityWeights(opts.mode, opts.weights);
    const metadataMap = await fetchCandidateMetadata(candidates);

    // Compute scores for all candidates
    const scored: CandidateWithScore[] = candidates.map((candidate, idx) => {
        const metadata = metadataMap.get(idx);
        const score = metadata ? calculateQualityScore(metadata, fullWeights) : 0;
        return { candidate, score, metadata };
    });

    // Apply citation count filter if specified
    const minCitations = opts.minCitationCount || 0;
    let filtered = scored;
    if (minCitations > 0) {
        const passFilter = scored.filter(s => 
            s.metadata && (s.metadata.citationCount || 0) >= minCitations
        );
        // If too aggressive (less than topK papers pass), keep some low-citation papers
        if (passFilter.length < topK) {
            try {
                console.debug('[candidateSelector] Citation filter too strict', {
                    minCitations,
                    passedFilter: passFilter.length,
                    topK,
                    action: 'relaxing filter'
                });
            } catch { /* noop */ }
            // Keep papers that passed + fill remaining with best of those that didn't
            const failed = scored.filter(s => 
                !s.metadata || (s.metadata.citationCount || 0) < minCitations
            ).sort((a, b) => b.score - a.score);
            filtered = [...passFilter, ...failed.slice(0, topK - passFilter.length)];
        } else {
            filtered = passFilter;
            try {
                console.debug('[candidateSelector] Applied citation filter', {
                    minCitations,
                    before: scored.length,
                    after: filtered.length
                });
            } catch { /* noop */ }
        }
    }

    // Sort filtered results by score descending
    filtered.sort((a, b) => b.score - a.score);

    // ε-greedy selection: take (1-ε)*topK from top scores, ε*topK randomly from the rest
    const epsilon = fullWeights.epsilon;
    const numExploit = Math.floor(topK * (1 - epsilon));
    const numExplore = topK - numExploit;

    const selected: typeof candidates = [];

    // Exploitation: take top scores
    for (let i = 0; i < numExploit && i < filtered.length; i++) {
        selected.push(filtered[i].candidate);
    }

    // Exploration: randomly sample from remaining candidates
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

    // Log summary stats for debugging
    try {
        const withMetadata = scored.filter(s => s.metadata).length;
        const avgScore = scored.reduce((sum, s) => sum + s.score, 0) / scored.length;
        const selectedScores = selected.map(c => scored.find(s => s.candidate === c)?.score || 0);
        const avgSelectedScore = selectedScores.reduce((sum, s) => sum + s, 0) / selectedScores.length;
        console.debug('[candidateSelector] Selection summary', {
            strategy: opts.strategy,
            total: candidates.length,
            withMetadata,
            topK,
            selected: selected.length,
            avgScore: avgScore.toFixed(3),
            avgSelectedScore: avgSelectedScore.toFixed(3),
            epsilon
        });
    } catch { /* noop */ }

    return selected;
}

/**
 * Get summary statistics for selected candidates (for UI/event emission)
 */
export function getCandidateStats(
    candidates: Array<{ title?: string; bestIdentifier?: string; sourceUrl: string; [key: string]: any }>,
    metadataMap?: Map<number, PaperMetadata>
): { meanScore: number; ageMix: { recent: number; mid: number; old: number } } {
    if (!metadataMap || metadataMap.size === 0) {
        return { meanScore: 0, ageMix: { recent: 0, mid: 0, old: 0 } };
    }

    const currentYear = new Date().getFullYear();
    let totalScore = 0;
    let count = 0;
    let recent = 0, mid = 0, old = 0;

    metadataMap.forEach((metadata) => {
        const age = metadata.year ? currentYear - metadata.year : 0;
        if (age <= 3) recent++;
        else if (age <= 7) mid++;
        else old++;
        count++;
    });

    const meanScore = count > 0 ? totalScore / count : 0;
    return {
        meanScore,
        ageMix: { recent, mid, old }
    };
}


