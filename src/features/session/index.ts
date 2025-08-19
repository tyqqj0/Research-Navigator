// Session Domain - Main Export
// 会话领域主导出

// Core Session Management
export * from './core';

// Integration Layers (when implemented)
// export * from './integrations/literature-in-session';
// export * from './integrations/research-in-session';

// Layout Components
export * from './layout';

// Re-export commonly used types and utilities
export type {
    ResearchSession,
    DialogueMessage,
    SessionPreferences,
    SessionSummary,
    SessionEvent,
    ResearchPhase
} from './core/session-types';

export { useSessionStore } from './core/session-store';

// Layout components
export { MainLayout } from './layout/MainLayout';
export { Header } from './layout/Header';
export { Sidebar } from './layout/Sidebar';
