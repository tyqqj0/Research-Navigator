// Research Tree Domain - Main Export
// 研究树领域主导出

// Data Access Layer
export * from './data-access';

// Tree Management Layer (when implemented)
// export * from './tree-management';

// MCTS Engine Layer (when implemented)
// export * from './mcts-engine';

// Visualization Layer (when implemented)
// export * from './visualization';

// Re-export commonly used types and utilities
export type {
    ResearchTree,
    ResearchTreeNode,
    MCTSIteration,
    ResearchExpansion,
    TreeStatistics,
    TreePath
} from './data-access/research-tree-types';

export { useResearchTreeStore } from './data-access/research-tree-store';
export { researchTreeRepository } from './data-access/research-tree-repository';
