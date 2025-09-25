export const runtimeConfig = {
    // Collection expansion
    EXPANSION_MAX_ROUNDS: 4,
    EXPANSION_ROUND_SIZE: 8,
    COLLECTION_UPPER_BOUND: 50,
    PRUNE_TARGET_MAX: 50,
    // Number of consecutive zero-add rounds allowed before stopping (0 = stop immediately)
    EXPANSION_ZERO_TOLERANCE_ROUNDS: 0,

    // Graph building
    GRAPH_WINDOW_SIZE: 50,
    // JSONL parsing limits
    GRAPH_JSONL_MAX_LINES: 200,
    GRAPH_JSONL_MAX_EDGES: 300,
    GRAPH_JSONL_MAX_TAGS: 4,
    // Title generation
    TITLE_GEN_LOCALE: 'zh-CN',
} as const;


