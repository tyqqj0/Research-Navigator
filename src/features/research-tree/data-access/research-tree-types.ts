// Research Tree Domain Types
// 研究树领域类型定义

export interface ResearchTreeNode {
    id: string;
    parentId?: string;

    // MCTS Algorithm fields
    visits: number;
    wins: number;
    ucb1Score?: number;

    // Research content
    topic: string;
    summary?: string;
    question?: string;

    // Literature references (引用关系，不是copy)
    primaryLiteratureId?: string;  // 主要文献引用
    relatedLiteratureIds: string[]; // 相关文献引用列表

    // Tree structure
    children: string[]; // 子节点ID列表
    depth: number;

    // Status and metadata
    status: 'unexplored' | 'expanding' | 'expanded' | 'terminal';
    expansionReason?: string;

    createdAt: Date;
    updatedAt: Date;
}

export interface ResearchTree {
    id: string;
    sessionId: string; // 关联的会话ID

    // Tree metadata
    title: string;
    description?: string;
    rootNodeId: string;

    // MCTS parameters
    explorationWeight: number; // UCB1 exploration parameter (c)
    maxDepth: number;
    maxNodes: number;

    // Tree statistics
    totalNodes: number;
    totalVisits: number;
    averageDepth: number;

    // Status
    status: 'building' | 'completed' | 'paused';

    createdAt: Date;
    updatedAt: Date;
}

export interface MCTSIteration {
    id: string;
    treeId: string;
    iterationNumber: number;

    // MCTS phases
    selectedNodeId: string;    // Selection phase result
    expandedNodeId?: string;   // Expansion phase result
    simulationResult: number;  // Simulation phase result (0-1)

    // Timing and performance
    duration: number; // milliseconds

    createdAt: Date;
}

export interface ResearchExpansion {
    id: string;
    nodeId: string;

    // AI generation results
    generatedTopics: string[];
    selectedTopic: string;
    generatedQuestion: string;
    generatedSummary: string;

    // Literature search results
    searchQuery: string;
    foundLiteratureIds: string[];
    selectedLiteratureId?: string;

    // Quality metrics
    relevanceScore?: number;   // 0-1
    noveltyScore?: number;     // 0-1
    feasibilityScore?: number; // 0-1

    createdAt: Date;
}

// Tree traversal and analysis types
export interface TreePath {
    nodeIds: string[];
    totalScore: number;
    averageScore: number;
    depth: number;
}

export interface TreeStatistics {
    totalNodes: number;
    maxDepth: number;
    averageDepth: number;
    totalVisits: number;
    averageVisits: number;
    branchingFactor: number;

    // Best paths
    bestPaths: TreePath[];

    // Topic distribution
    topicClusters: {
        topic: string;
        nodeCount: number;
        averageScore: number;
    }[];
}
