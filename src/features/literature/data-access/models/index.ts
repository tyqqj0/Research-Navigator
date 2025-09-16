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
    LiteratureSort,
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
    UserLiteratureStats,
    UserMetaFilter
} from './user-literature-meta.types';

export {
    UserLiteratureMetaSchema
} from './user-literature-meta.types';

// 🔗 引文关系类型 (简化版本)
export type {
    Citation,
    CitationDegree,
    CitationOverview,
    CreateCitationInput,
    UpdateCitationInput,
    CitationQuery,
    CitationRelationship,
    CitationSearchResult
} from './citation.types';

export {
    CitationSchema,
    CitationDegreeSchema,
    CitationOverviewSchema
} from './citation.types';

// 📂 文献集合类型
export type {
    CollectionType,
    Collection,
    CollectionUIConfig,
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

// 🔄 文献组合类型 - 文献数据组合结构
export type {
    EnhancedLibraryItem,
    EnhancedLibraryItemWithStats,
    CompositionOptions,
    CreateComposedLiteratureInput,
    UpdateComposedLiteratureInput,
    BatchCompositionResult,
    BatchByIdsOptions,
    CompositionByIdMap,
} from './composition.types';

// 🎯 组合导出 - 常用的复合类型
import type { CreateLibraryItemInput, LibraryItem, UpdateLibraryItemInput } from './library-item.types';
import type { UserLiteratureMeta } from './user-literature-meta.types';
import type { Citation } from './citation.types';
import type { Collection, CollectionStats } from './collection.types';

// 🔄 向后兼容的类型别名
export type CreateLiteratureInput = CreateLibraryItemInput;
export type UpdateLiteratureInput = UpdateLibraryItemInput;
export type UserLiteratureMetaCore = UserLiteratureMeta;
import type { LiteratureSortField, LiteratureSortOrder } from './library-item.types';

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

// 📄 分页结果类型
export type PaginatedResult<T> = {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
};

// 🏭 模型工厂类
export class LibraryItemFactory {
    static createLibraryItem(input: CreateLibraryItemInput): LibraryItem {
        return {
            paperId: input.paperId,
            title: input.title,
            authors: input.authors || [],
            year: input.year,
            publication: input.publication,
            abstract: input.abstract,
            summary: input.summary,
            doi: input.doi,
            url: input.url,
            parsedContent: input.parsedContent,
            // keywords: input.keywords || [],
            // language: input.language || 'en',
            // status: input.status || 'active',
            source: input.source || 'manual',
            pdfPath: input.pdfPath,
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }
}

// 🔍 模型验证器
export class ModelValidators {
    static createInput(input: CreateLibraryItemInput): void {
        // paperId 仅做最小长度检查（例如S2：40字符；CorpusId：短数字；DOI更短，但非空即可）
        // 如果有前缀，则提取
        if (input.paperId && input.paperId.trim().startsWith('S2: ')) {
            input.paperId = input.paperId.trim().substring(4);
        } else if (input.paperId && input.paperId.trim().startsWith('S2:')) {
            input.paperId = input.paperId.trim().substring(3);
        }
        if (!input.paperId || input.paperId.trim().length !== 40) {
            throw new Error('paperId is required and should be 40 characters');
        }
        if (!input.title || input.title.trim() === '') {
            throw new Error('Title is required');
        }
        if (input.year && (input.year < 1000 || input.year > new Date().getFullYear() + 10)) {
            throw new Error('Invalid year');
        }
    }

    static updateInput(input: UpdateLibraryItemInput): void {
        if (input.title !== undefined && (!input.title || input.title.trim() === '')) {
            throw new Error('Title cannot be empty');
        }
        if (input.year && (input.year < 1000 || input.year > new Date().getFullYear() + 10)) {
            throw new Error('Invalid year');
        }
    }
}

// 📊 文献常量
export const LITERATURE_CONSTANTS = {
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
    MAX_BULK_SIZE: 1000,
    MAX_TITLE_LENGTH: 500,
    MAX_ABSTRACT_LENGTH: 5000,
    SUPPORTED_LANGUAGES: ['en', 'zh', 'es', 'fr', 'de', 'ja', 'ko'],
    DEFAULT_LANGUAGE: 'en'
};
