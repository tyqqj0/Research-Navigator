/**
 * 🎯 Literature Domain - 核心数据模型
 * 
 * 设计原则:
 * 1. 统一的数据验证 - Zod Schema + 运行时验证
 * 2. 类型安全 - TypeScript + 严格类型检查
 * 3. 可扩展性 - 支持未来字段扩展
 * 4. 性能优化 - 预编译验证器
 */

import { z } from 'zod';

// ==================== 基础类型定义 ====================

/**
 * 🏷️ 基础实体接口
 */
export const BaseEntitySchema = z.object({
    id: z.string().uuid('Invalid UUID format'),
    createdAt: z.date(),
    updatedAt: z.date().optional(),
});

export type BaseEntity = z.infer<typeof BaseEntitySchema>;

/**
 * 📊 操作结果类型
 */
export const OperationResultSchema = z.object({
    success: z.boolean(),
    message: z.string(),
    data: z.any().optional(),
    error: z.string().optional(),
    timestamp: z.date().default(() => new Date()),
});

export type OperationResult<T = any> = {
    success: boolean;
    message: string;
    data?: T;
    error?: string;
    timestamp: Date;
};

/**
 * 📄 分页结果类型
 */
export const PaginationSchema = z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive().max(100),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
});

export type Pagination = z.infer<typeof PaginationSchema>;

export const createPaginatedResultSchema = <T>(itemSchema: z.ZodType<T>) => z.object({
    items: z.array(itemSchema),
    pagination: PaginationSchema,
});

export type PaginatedResult<T> = {
    items: T[];
    pagination: Pagination;
};

// ==================== 文献核心模型 ====================

/**
 * 📚 文献条目核心模型
 */
export const LibraryItemCoreSchema = z.object({
    lid: z.string().uuid('Literature ID must be UUID'),
    title: z.string().min(1, 'Title is required').max(1000, 'Title too long'),
    authors: z.array(z.string().min(1, 'Author name cannot be empty')).default([]),
    year: z.number().int().min(1900).max(new Date().getFullYear() + 10).optional(),
    source: z.enum(['manual', 'arxiv', 'pubmed', 'crossref', 'semantic_scholar', 'imported']).default('manual'),
    publication: z.string().max(500, 'Publication name too long').optional(),
    doi: z.string().regex(/^10\.\d{4,}\/[^\s]+$/, 'Invalid DOI format').optional(),
    url: z.string().url('Invalid URL format').optional(),
    abstract: z.string().max(10000, 'Abstract too long').optional(),
    keywords: z.array(z.string().min(1)).default([]),
    pdfPath: z.string().optional(),
    language: z.string().length(2, 'Language must be 2-letter code').default('en'),
    status: z.enum(['active', 'archived', 'deleted']).default('active'),
}).extend(BaseEntitySchema.shape);

export type LibraryItemCore = z.infer<typeof LibraryItemCoreSchema>;

/**
 * 👤 用户文献元数据模型
 */
export const UserLiteratureMetaCoreSchema = z.object({
    userId: z.string().uuid('User ID must be UUID'),
    literatureId: z.string().uuid('Literature ID must be UUID'),
    tags: z.array(z.string().min(1).max(50)).default([]),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
    readingStatus: z.enum(['unread', 'reading', 'completed', 'referenced', 'abandoned']).default('unread'),
    isFavorite: z.boolean().default(false),
    notes: z.string().max(50000, 'Notes too long').optional(),
    rating: z.number().int().min(1).max(5).optional(),
    readingProgress: z.number().min(0).max(1).default(0),
    lastAccessedAt: z.date().optional(),
    associatedSessions: z.array(z.string().uuid()).default([]),
    associatedProjects: z.array(z.string().uuid()).default([]),
    customCategories: z.array(z.string().min(1).max(50)).default([]),
}).extend(BaseEntitySchema.shape);

export type UserLiteratureMetaCore = z.infer<typeof UserLiteratureMetaCoreSchema>;

/**
 * 🔗 引文关系核心模型
 */
export const CitationCoreSchema = z.object({
    sourceItemId: z.string().uuid('Source item ID must be UUID'),
    targetItemId: z.string().uuid('Target item ID must be UUID'),
    citationType: z.enum(['direct', 'indirect', 'self', 'co_author']).default('direct'),
    discoveryMethod: z.enum(['manual', 'auto_extracted', 'ai_inferred', 'user_linked']).default('manual'),
    isVerified: z.boolean().default(false),
    confidence: z.number().min(0).max(1).default(1),
    context: z.string().max(1000).optional(),
    pageNumber: z.string().max(20).optional(),
    section: z.string().max(100).optional(),
}).extend(BaseEntitySchema.shape);

export type CitationCore = z.infer<typeof CitationCoreSchema>;

/**
 * 📂 文献集合核心模型
 */
export const CollectionCoreSchema = z.object({
    collectionId: z.string().uuid('Collection ID must be UUID'),
    userId: z.string().uuid('User ID must be UUID'),
    name: z.string().min(1, 'Collection name is required').max(200, 'Name too long'),
    description: z.string().max(1000, 'Description too long').optional(),
    type: z.enum(['manual', 'smart', 'session_based', 'project_based']).default('manual'),
    isPublic: z.boolean().default(false),
    itemCount: z.number().int().nonnegative().default(0),
    literatureIds: z.array(z.string().uuid()).default([]),
    smartRules: z.array(z.object({
        field: z.string(),
        operator: z.enum(['equals', 'contains', 'starts_with', 'ends_with', 'regex', 'date_range']),
        value: z.any(),
        logic: z.enum(['AND', 'OR']).default('AND'),
    })).optional(),
    tags: z.array(z.string().min(1).max(50)).default([]),
    color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format').optional(),
}).extend(BaseEntitySchema.shape);

export type CollectionCore = z.infer<typeof CollectionCoreSchema>;

// ==================== 组合模型 ====================

/**
 * 🎯 增强版文献条目 (包含用户元数据)
 */
export const EnhancedLiteratureItemSchema = LibraryItemCoreSchema.extend({
    userMeta: UserLiteratureMetaCoreSchema.optional(),
    citationStats: z.object({
        totalCitations: z.number().int().nonnegative(),
        incomingCitations: z.number().int().nonnegative(),
        outgoingCitations: z.number().int().nonnegative(),
    }),
    relatedItems: z.array(z.string().uuid()).default([]),
    lastAccessedAt: z.date().optional(),
});

export type EnhancedLiteratureItem = z.infer<typeof EnhancedLiteratureItemSchema>;

/**
 * 📊 搜索结果模型
 */
export const LiteratureSearchResultSchema = z.object({
    items: z.array(EnhancedLiteratureItemSchema),
    pagination: PaginationSchema,
    appliedFilters: z.record(z.string(), z.any()),
    facets: z.object({
        sources: z.array(z.object({ value: z.string(), count: z.number().int().nonnegative() })),
        years: z.array(z.object({ value: z.number().int(), count: z.number().int().nonnegative() })),
        authors: z.array(z.object({ value: z.string(), count: z.number().int().nonnegative() })),
        tags: z.array(z.object({ value: z.string(), count: z.number().int().nonnegative() })),
    }).optional(),
    executionTime: z.number().nonnegative(),
});

export type LiteratureSearchResult = z.infer<typeof LiteratureSearchResultSchema>;

// ==================== 输入/输出模型 ====================

/**
 * ➕ 创建文献输入模型
 */
export const CreateLiteratureInputSchema = LibraryItemCoreSchema
    .omit({ lid: true, createdAt: true, updatedAt: true, status: true })
    .extend({
        // 允许外部系统提供自定义ID
        lid: z.string().uuid().optional(),
        // 创建时的用户元数据
        initialUserMeta: UserLiteratureMetaCoreSchema
            .omit({ userId: true, literatureId: true, createdAt: true, updatedAt: true })
            .optional(),
    });

export type CreateLiteratureInput = z.infer<typeof CreateLiteratureInputSchema>;

/**
 * 📝 更新文献输入模型
 */
export const UpdateLiteratureInputSchema = LibraryItemCoreSchema
    .omit({ lid: true, createdAt: true })
    .partial()
    .extend({
        updatedAt: z.date().default(() => new Date()),
    });

export type UpdateLiteratureInput = z.infer<typeof UpdateLiteratureInputSchema>;

/**
 * 🔍 文献过滤器模型
 */
export const LiteratureFilterSchema = z.object({
    // 基本过滤
    sources: z.array(z.string()).optional(),
    years: z.array(z.number().int()).optional(),
    authors: z.array(z.string()).optional(),
    keywords: z.array(z.string()).optional(),

    // 用户相关过滤
    tags: z.array(z.string()).optional(),
    readingStatus: z.array(z.enum(['unread', 'reading', 'completed', 'referenced', 'abandoned'])).optional(),
    priority: z.array(z.enum(['low', 'medium', 'high', 'urgent'])).optional(),
    isFavorite: z.boolean().optional(),

    // 时间范围过滤
    createdAfter: z.date().optional(),
    createdBefore: z.date().optional(),
    lastAccessedAfter: z.date().optional(),
    lastAccessedBefore: z.date().optional(),

    // 全文搜索
    searchQuery: z.string().max(500).optional(),
    searchFields: z.array(z.enum(['title', 'authors', 'abstract', 'keywords', 'notes'])).default(['title', 'authors']),

    // 关联过滤
    associatedSessions: z.array(z.string().uuid()).optional(),
    associatedProjects: z.array(z.string().uuid()).optional(),

    // 高级过滤
    hasAbstract: z.boolean().optional(),
    hasPdf: z.boolean().optional(),
    hasDoi: z.boolean().optional(),
    minCitations: z.number().int().nonnegative().optional(),
    maxCitations: z.number().int().nonnegative().optional(),
}).strict();

export type LiteratureFilter = z.infer<typeof LiteratureFilterSchema>;

/**
 * 📈 排序模型
 */
export const LiteratureSortSchema = z.object({
    field: z.enum(['title', 'authors', 'year', 'createdAt', 'updatedAt', 'lastAccessedAt', 'priority', 'citationCount']),
    order: z.enum(['asc', 'desc']).default('desc'),
});

export type LiteratureSort = z.infer<typeof LiteratureSortSchema>;

// ==================== 验证器工厂 ====================

/**
 * 🏭 预编译验证器 - 提高运行时性能
 */
export class ModelValidators {
    // 核心模型验证器
    static readonly libraryItem = LibraryItemCoreSchema.parse.bind(LibraryItemCoreSchema);
    static readonly userMeta = UserLiteratureMetaCoreSchema.parse.bind(UserLiteratureMetaCoreSchema);
    static readonly citation = CitationCoreSchema.parse.bind(CitationCoreSchema);
    static readonly collection = CollectionCoreSchema.parse.bind(CollectionCoreSchema);

    // 输入验证器
    static readonly createInput = CreateLiteratureInputSchema.parse.bind(CreateLiteratureInputSchema);
    static readonly updateInput = UpdateLiteratureInputSchema.parse.bind(UpdateLiteratureInputSchema);
    static readonly filter = LiteratureFilterSchema.parse.bind(LiteratureFilterSchema);
    static readonly sort = LiteratureSortSchema.parse.bind(LiteratureSortSchema);

    // 安全验证器 (不抛出异常)
    static safeValidate<T>(schema: z.ZodType<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
        const result = schema.safeParse(data);
        if (result.success) {
            return { success: true, data: result.data };
        } else {
            return { success: false, error: result.error.message };
        }
    }
}

// ==================== 常量定义 ====================

export const LITERATURE_CONSTANTS = {
    // 分页限制
    MAX_PAGE_SIZE: 100,
    DEFAULT_PAGE_SIZE: 20,

    // 字段长度限制
    MAX_TITLE_LENGTH: 1000,
    MAX_ABSTRACT_LENGTH: 10000,
    MAX_NOTES_LENGTH: 50000,
    MAX_TAG_LENGTH: 50,
    MAX_TAGS_COUNT: 20,

    // 搜索限制
    MAX_SEARCH_QUERY_LENGTH: 500,
    MAX_SEARCH_RESULTS: 1000,

    // 缓存配置
    DEFAULT_CACHE_TTL: 300, // 5分钟
    MAX_CACHE_SIZE: 1000,

    // 批量操作限制
    MAX_BULK_SIZE: 500,

    // 文件大小限制
    MAX_PDF_SIZE: 50 * 1024 * 1024, // 50MB
} as const;

/**
 * 🎯 模型工厂类 - 创建标准化的数据模型实例
 */
export class ModelFactory {
    /**
     * 创建新的文献条目
     */
    static createLiteratureItem(input: CreateLiteratureInput): LibraryItemCore {
        const now = new Date();
        return {
            lid: input.lid || crypto.randomUUID(),
            title: input.title,
            authors: input.authors || [],
            year: input.year,
            source: input.source || 'manual',
            publication: input.publication,
            doi: input.doi,
            url: input.url,
            abstract: input.abstract,
            keywords: input.keywords || [],
            pdfPath: input.pdfPath,
            language: input.language || 'en',
            status: 'active',
            id: crypto.randomUUID(),
            createdAt: now,
            updatedAt: now,
        };
    }

    /**
     * 创建用户元数据
     */
    static createUserMeta(
        userId: string,
        literatureId: string,
        initial?: Partial<UserLiteratureMetaCore>
    ): UserLiteratureMetaCore {
        const now = new Date();
        return {
            id: crypto.randomUUID(),
            userId,
            literatureId,
            tags: initial?.tags || [],
            priority: initial?.priority || 'medium',
            readingStatus: initial?.readingStatus || 'unread',
            isFavorite: initial?.isFavorite || false,
            notes: initial?.notes,
            rating: initial?.rating,
            readingProgress: initial?.readingProgress || 0,
            lastAccessedAt: initial?.lastAccessedAt,
            associatedSessions: initial?.associatedSessions || [],
            associatedProjects: initial?.associatedProjects || [],
            customCategories: initial?.customCategories || [],
            createdAt: now,
            updatedAt: now,
        };
    }

    /**
     * 创建引文关系
     */
    static createCitation(
        sourceItemId: string,
        targetItemId: string,
        options?: Partial<CitationCore>
    ): CitationCore {
        const now = new Date();
        return {
            id: crypto.randomUUID(),
            sourceItemId,
            targetItemId,
            citationType: options?.citationType || 'direct',
            discoveryMethod: options?.discoveryMethod || 'manual',
            isVerified: options?.isVerified || false,
            confidence: options?.confidence || 1,
            context: options?.context,
            pageNumber: options?.pageNumber,
            section: options?.section,
            createdAt: now,
            updatedAt: now,
        };
    }

    /**
     * 创建空的搜索结果
     */
    static createEmptySearchResult(): LiteratureSearchResult {
        return {
            items: [],
            pagination: {
                page: 1,
                pageSize: LITERATURE_CONSTANTS.DEFAULT_PAGE_SIZE,
                total: 0,
                totalPages: 0,
            },
            appliedFilters: {},
            executionTime: 0,
        };
    }
}

export default {
    // Schemas
    LibraryItemCoreSchema,
    UserLiteratureMetaCoreSchema,
    CitationCoreSchema,
    CollectionCoreSchema,
    EnhancedLiteratureItemSchema,
    LiteratureSearchResultSchema,
    CreateLiteratureInputSchema,
    UpdateLiteratureInputSchema,
    LiteratureFilterSchema,
    LiteratureSortSchema,

    // Validators
    ModelValidators,

    // Factory
    ModelFactory,

    // Constants
    LITERATURE_CONSTANTS,
};
