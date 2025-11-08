import { literatureRepository, collectionRepository } from '@/features/literature/data-access/repositories';
import type {
    ImportanceEvaluator,
    PaperMetadata,
    QualityWeights,
    RankOptions,
    RankedScore,
    ThresholdMethod,
    ThresholdParams,
    ThresholdResult,
    MainlineStrategy
} from '../ports/types';
import { getQualityWeights } from '../core/presets';
import { calculateQualityScore } from '../core/score';
import { computeThreshold } from '../core/thresholds';

type MinimalLibraryItem = {
    paperId: string;
    title: string;
    year?: number;
    publication?: string | null;
    publicationDate?: string | null;
    venue?: string | null;
    citationCount?: number | null;
    influentialCitationCount?: number | null;
};

function toMetadata(item: any): PaperMetadata {
    return {
        year: typeof item?.year === 'number' ? item.year : undefined,
        publicationDate: (item?.publicationDate as string | undefined) ?? undefined,
        venue: (item?.publication as string | undefined) ?? (item?.venue as string | undefined) ?? undefined,
        citationCount: typeof item?.citationCount === 'number' ? item.citationCount : undefined,
        influentialCitationCount: typeof item?.influentialCitationCount === 'number' ? item.influentialCitationCount : undefined
    } as PaperMetadata;
}

export class LocalImportanceAdapter implements ImportanceEvaluator {
    private cache = new Map<string, RankedScore[]>();

    async scoreForPaperIds(paperIds: string[], opts?: RankOptions): Promise<RankedScore[]> {
        const key = this.buildCacheKey('score', paperIds, opts);
        const cached = this.cache.get(key);
        if (cached) return cached;

        const items = await literatureRepository.findByPaperIds(paperIds);
        const weights = getQualityWeights(opts?.mode, opts?.weights as Partial<QualityWeights> | undefined);
        const minCitations = Math.max(0, opts?.minCitationCount || 0);

        const scores: RankedScore[] = items.map((item: MinimalLibraryItem) => {
            const metadata = toMetadata(item);
            const hasEnoughCitations = (metadata.citationCount || 0) >= minCitations;
            const { score, components } = calculateQualityScore(metadata, weights);
            return {
                paperId: item.paperId,
                score: hasEnoughCitations ? score : 0,
                components,
                metadata
            };
        });

        this.cache.set(key, scores);
        return scores;
    }

    async rankPaperIds(paperIds: string[], opts?: RankOptions): Promise<RankedScore[]> {
        const scored = await this.scoreForPaperIds(paperIds, opts);
        const sorted = [...scored].sort((a, b) => b.score - a.score);
        if (opts?.paginate) {
            const { offset, limit } = opts.paginate;
            return sorted.slice(offset, offset + limit);
        }
        return sorted;
    }

    async rankCollection(collectionId: string, opts?: RankOptions): Promise<RankedScore[]> {
        const collection = await collectionRepository.findById(collectionId);
        const paperIds = collection?.paperIds || [];
        return await this.rankPaperIds(paperIds, opts);
    }

    computeThreshold(scores: number[], method?: ThresholdMethod, params?: ThresholdParams): ThresholdResult {
        return computeThreshold(scores, method, params);
    }

    async selectMainlineFromPaperIds(paperIds: string[], strategy?: MainlineStrategy): Promise<string[]> {
        const ranked = await this.rankPaperIds(paperIds, undefined);
        const threshold = computeThreshold(ranked.map(r => r.score), strategy?.method, strategy?.params);
        const selected = ranked.filter(r => r.score >= threshold.value);

        const limit = strategy?.limit && strategy.limit > 0 ? strategy.limit : undefined;
        const ordering = strategy?.ordering || 'chronological';

        let ordered = selected;
        if (ordering === 'chronological') {
            ordered = [...selected].sort((a, b) => {
                const ay = a.metadata?.year || 0;
                const by = b.metadata?.year || 0;
                if (ay !== by) return ay - by;
                return b.score - a.score; // tie-breaker
            });
        }
        // TODO: dependency or hybrid ordering can be added later

        const ids = ordered.map(r => r.paperId);
        return typeof limit === 'number' ? ids.slice(0, limit) : ids;
    }

    async selectMainlineFromCollection(collectionId: string, strategy?: MainlineStrategy): Promise<string[]> {
        const collection = await collectionRepository.findById(collectionId);
        const paperIds = collection?.paperIds || [];
        return await this.selectMainlineFromPaperIds(paperIds, strategy);
    }

    private buildCacheKey(prefix: string, paperIds: string[], opts?: RankOptions): string {
        const idHash = paperIds.slice().sort().join('|');
        const w = opts?.weights ? JSON.stringify(opts.weights) : '';
        const m = opts?.mode || '';
        const c = opts?.minCitationCount || 0;
        return `${prefix}:${idHash}:${m}:${w}:${c}`;
    }
}




