/**
 * Importance domain - public types and ports
 */

export type QualityMode = 'balanced' | 'classic' | 'emerging';

export type QualityWeights = {
    influentialPerYear: number;
    recency: number;
    velocity: number;
    venue: number;
    alpha: number;
    tau: number;
    /**
     * Exploration ratio for stochastic selectors. Deterministic ranking ignores it.
     */
    epsilon?: number;
};

export type PaperMetadata = {
    year?: number | null;
    publicationDate?: string | null;
    venue?: string | null;
    citationCount?: number | null;
    influentialCitationCount?: number | null;
};

export type ScoreComponents = {
    influentialPerYear: number; // S1
    recency: number;            // S2
    velocity: number;           // S3 (placeholder)
    venue: number;              // S4
};

export type RankedScore = {
    paperId: string;
    score: number;
    components: ScoreComponents;
    metadata?: PaperMetadata;
};

export type RankOptions = {
    mode?: QualityMode;
    weights?: Partial<QualityWeights>;
    minCitationCount?: number;
    paginate?: { offset: number; limit: number };
};

export type ThresholdMethod = 'quantile' | 'kneedle' | 'pareto' | 'zscore';

export type ThresholdParams = {
    // quantile method
    q?: number; // 0..1, default 0.8
    // zscore method
    z?: number; // default 1.0
    // pareto method
    topRatio?: number; // default 0.2
};

export type ThresholdResult = {
    method: ThresholdMethod;
    value: number;
    selectedCount: number;
    diagnostics?: Record<string, unknown>;
};

export type MainlineStrategy = {
    method?: ThresholdMethod;
    params?: ThresholdParams;
    ordering?: 'chronological' | 'dependency' | 'hybrid';
    limit?: number;
};

export interface ImportanceEvaluator {
    scoreForPaperIds(paperIds: string[], opts?: RankOptions): Promise<RankedScore[]>;
    rankPaperIds(paperIds: string[], opts?: RankOptions): Promise<RankedScore[]>;
    rankCollection(collectionId: string, opts?: RankOptions): Promise<RankedScore[]>;
    computeThreshold(scores: number[], method?: ThresholdMethod, params?: ThresholdParams): ThresholdResult;
    selectMainlineFromPaperIds(paperIds: string[], strategy?: MainlineStrategy): Promise<string[]>;
    selectMainlineFromCollection(collectionId: string, strategy?: MainlineStrategy): Promise<string[]>;
}



