import type { QualityWeights, CandidateSelectionStrategy, QualityMode } from './executors/candidate-selector';

export const runtimeConfig = {
    // Collection expansion
    EXPANSION_MAX_ROUNDS: 4,
    EXPANSION_ROUND_SIZE: 8,
    COLLECTION_UPPER_BOUND: 50,
    PRUNE_TARGET_MAX: 50,
    // Number of consecutive zero-add rounds allowed before stopping (0 = stop immediately)
    EXPANSION_ZERO_TOLERANCE_ROUNDS: 0,

    // Candidate selection strategy
    CANDIDATE_SELECTION_STRATEGY: 'quality' as CandidateSelectionStrategy,
    
    // Candidate pool size: how many candidates to fetch from search
    // Larger pool = more choices for quality filter, but slower
    // Recommended: 50-100
    CANDIDATE_POOL_SIZE: 70,
    
    // Quality mode preset: 'balanced' | 'classic' | 'emerging'
    // - balanced: 平衡经典与新作（推荐）
    // - classic: 重视高引经典论文
    // - emerging: 重视新兴潜力论文
    CANDIDATE_QUALITY_MODE: 'balanced' as QualityMode,
    
    // Minimum citation count filter (0 = no filter)
    CANDIDATE_MIN_CITATION_COUNT: 10,
    
    // Optional: custom weights override (leave undefined to use preset)
    CANDIDATE_QUALITY_WEIGHTS: undefined as Partial<QualityWeights> | undefined,

    // Graph building
    GRAPH_WINDOW_SIZE: 50,
    // JSONL parsing limits
    GRAPH_JSONL_MAX_LINES: 200,
    GRAPH_JSONL_MAX_EDGES: 300,
    GRAPH_JSONL_MAX_TAGS: 4,
    // Title generation
    TITLE_GEN_LOCALE: 'zh-CN',
} as const;


