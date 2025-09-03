/**
 * 📚 Literature Domain Types - 文献领域类型统一导出
 * 
 * 架构说明: 这是Literature领域的类型定义统一入口
 * 设计原则: 按业务概念组织导出，提供清晰的API界面
 */

// 🏷️ 文献来源相关类型
export type {
    LiteratureSource
} from './literature-source.types';

export {
    LITERATURE_SOURCES,
    SOURCE_METADATA,
    DEFAULT_LITERATURE_SOURCE
} from './literature-source.types';

// 📚 核心文献条目类型
export type {
    LibraryItem,
    ExtendedLibraryItem,
    BackendTask,
    LiteratureStatus,
    ComponentStatus,
    CreateLibraryItemInput,
    UpdateLibraryItemInput,
    LiteratureFilter,
    LiteratureSortField,
    LiteratureSortOrder,
    LiteratureSort
} from './library-item.types';

export {
    LibraryItemSchema,
    ExtendedLibraryItemSchema,
    BackendTaskSchema,
    LiteratureStatusSchema,
    ComponentStatusSchema
} from './library-item.types';

// 👤 用户文献元数据类型
export type {
    UserLiteratureMeta,
    CreateUserLiteratureMetaInput,
    UpdateUserLiteratureMetaInput,
    EnhancedLibraryItem,
    UserLiteratureStats,
    UserMetaFilter
} from './user-literature-meta.types';

export {
    UserLiteratureMetaSchema
} from './user-literature-meta.types';

// 🔗 引文关系类型
export type {
    Citation,
    CitationNode,
    CitationEdge,
    CitationNetwork,
    CreateCitationInput,
    UpdateCitationInput,
    CitationQuery,
    CitationStats
} from './citation.types';

export {
    CitationSchema,
    CitationNodeSchema,
    CitationEdgeSchema,
    CitationNetworkSchema
} from './citation.types';

// 📂 文献集合类型
export type {
    CollectionType,
    Collection,
    SmartCollectionRule,
    CollectionStats,
    CreateCollectionInput,
    UpdateCollectionInput,
    CollectionQuery,
    CollectionSort,
    CollectionOperation,
    SmartCollectionResult
} from './collection.types';

export {
    COLLECTION_TYPES,
    CollectionSchema,
    SmartCollectionRuleSchema,
    CollectionStatsSchema
} from './collection.types';

// 🎯 组合导出 - 常用的复合类型
export type LiteratureWithMeta = {
    literature: LibraryItem;
    userMeta?: UserLiteratureMeta;
    citations?: {
        incoming: Citation[];
        outgoing: Citation[];
    };
};

export type CollectionWithItems = {
    collection: Collection;
    items: LiteratureWithMeta[];
    stats: CollectionStats;
};

// 📊 领域聚合类型 - 用于复杂查询
export type LiteratureDomainData = {
    libraries: LibraryItem[];
    userMetas: UserLiteratureMeta[];
    citations: Citation[];
    collections: Collection[];
};

// 🔍 搜索结果类型
export type LiteratureSearchResult = {
    items: LiteratureWithMeta[];
    total: number;
    page: number;
    pageSize: number;
    facets?: {
        sources: Array<{ value: string; count: number }>;
        years: Array<{ value: number; count: number }>;
        authors: Array<{ value: string; count: number }>;
        tags: Array<{ value: string; count: number }>;
    };
};

// ⚡ 实时更新事件类型
export type LiteratureUpdateEvent = {
    type: 'literature_added' | 'literature_updated' | 'literature_deleted' |
    'citation_added' | 'citation_deleted' |
    'collection_updated' | 'user_meta_updated';
    payload: any;
    timestamp: Date;
    userId?: string;
};

// 🎛️ 领域配置类型
export type LiteratureDomainConfig = {
    // 📊 分页配置
    pagination: {
        defaultPageSize: number;
        maxPageSize: number;
    };

    // 🔍 搜索配置
    search: {
        defaultSortField: LiteratureSortField;
        defaultSortOrder: LiteratureSortOrder;
        enableFacets: boolean;
        maxSearchResults: number;
    };

    // 🤖 智能功能配置
    smartFeatures: {
        enableAutoTagging: boolean;
        enableSmartCollections: boolean;
        enableCitationLinking: boolean;
        confidenceThreshold: number;
    };

    // 💾 缓存配置
    cache: {
        enableResultCaching: boolean;
        cacheExpirySeconds: number;
        maxCacheSize: number;
    };
};
