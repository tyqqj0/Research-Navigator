// Features - Main Export
// 所有功能领域的统一导出

// Core Business Domains
export * as Literature from './literature';
export * as ResearchTree from './research-tree';
export * as Session from './session';

// Supporting Domains (when implemented)
// export * as Visualization from './visualization';
// export * as User from './user';

// Cross-domain utilities and types
export type { LiteratureItem } from './literature';
export type { ResearchTreeNode, ResearchTree } from './research-tree';
export type { ResearchSession, DialogueMessage } from './session';
