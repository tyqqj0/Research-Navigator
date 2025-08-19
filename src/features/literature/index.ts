// Literature Domain - Main Export
// 文献领域主导出

// Data Access Layer
export * from './data-access';

// Management Layer (when implemented)
// export * from './management';

// Details Layer (when implemented) 
// export * from './details';

// Visualization Layer (when implemented)
// export * from './visualization';

// Re-export commonly used types and utilities
export type {
    LiteratureItem,
    LiteratureCollection,
    CitationRelation,
    LiteratureNote,
    LiteratureSearchQuery,
    LiteratureSearchResult
} from './data-access/literature-types';

export { useLiteratureStore } from './data-access/literature-store';
export { literatureRepository } from './data-access/literature-repository';
