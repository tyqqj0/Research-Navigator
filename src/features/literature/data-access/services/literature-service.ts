/**
 * 📚 Literature Service - 核心文献业务服务
 * 
 * 职责:
 * 1. 文献的基础CRUD操作
 * 2. 用户元数据管理
 * 3. 业务规则验证
 * 4. 批量操作协调
 * 
 * 设计原则:
 * - 单一职责：只处理文献相关的核心业务逻辑
 * - 依赖注入：通过构造函数注入仓储层依赖
 * - 错误处理：统一的错误处理和日志记录
 * - 类型安全：完整的TypeScript类型支持
 */

import {
    enhancedLiteratureRepository,
    userMetaRepository,
    type LiteratureOperationResult,
    type BulkLiteratureResult,
} from '../repositories';
import {
    LibraryItemCore,
    UserLiteratureMetaCore,
    EnhancedLiteratureItem,
    CreateLiteratureInput,
    UpdateLiteratureInput,
    LiteratureFilter,
    LiteratureSort,
    PaginatedResult,
    ModelFactory,
    ModelValidators,
    ErrorHandler,
    BusinessLogicError,
    NotFoundError,
    withErrorBoundary,
    LITERATURE_CONSTANTS,
} from '../models';

/**
 * 🔧 文献创建选项
 */
export interface LiteratureCreateOptions {
    /** 自动提取标签 */
    autoTag?: boolean;
    /** 自动提取关键词 */
    autoExtractKeywords?: boolean;
    /** 自动检测重复 */
    checkDuplicates?: boolean;
    /** 验证数据完整性 */
    validateData?: boolean;
}

/**
 * 📊 文献操作统计
 */
export interface LiteratureServiceStats {
    totalOperations: number;
    averageResponseTime: number;
    errorRate: number;
    lastOperationAt: Date;
}

/**
 * 📚 Literature Service 类
 */
export class LiteratureService {
    private stats: LiteratureServiceStats = {
        totalOperations: 0,
        averageResponseTime: 0,
        errorRate: 0,
        lastOperationAt: new Date(),
    };

    constructor(
        private readonly literatureRepo = enhancedLiteratureRepository,
        private readonly userMetaRepo = userMetaRepository
    ) { }

    // ==================== 基础CRUD操作 ====================

    /**
     * 📖 获取文献详情
     */
    @withErrorBoundary('getLiterature', 'service')
    async getLiterature(
        literatureId: string,
        userId?: string
    ): Promise<EnhancedLiteratureItem | null> {
        const startTime = Date.now();

        try {
            // 1. 获取基础文献信息
            const literature = await this.literatureRepo.findByLid(literatureId);
            if (!literature) {
                return null;
            }

            // 2. 获取用户元数据
            let userMeta: UserLiteratureMetaCore | null = null;
            if (userId) {
                userMeta = await this.userMetaRepo.findByUserAndLiterature(userId, literatureId);

                // 更新访问时间
                if (userMeta) {
                    await this.userMetaRepo.updateLastAccessed(userId, literatureId);
                }
            }

            // 3. 构建增强版文献项
            const enhancedItem: EnhancedLiteratureItem = {
                ...literature,
                userMeta,
                citationStats: {
                    totalCitations: 0,
                    incomingCitations: 0,
                    outgoingCitations: 0,
                },
                relatedItems: [],
                lastAccessedAt: userMeta?.lastAccessedAt || literature.updatedAt,
            };

            this.updateStats(Date.now() - startTime, true);
            return enhancedItem;
        } catch (error) {
            this.updateStats(Date.now() - startTime, false);
            throw ErrorHandler.handle(error, {
                operation: 'service.getLiterature',
                layer: 'service',
                entityType: 'LibraryItem',
                entityId: literatureId,
                userId,
            });
        }
    }

    /**
     * ➕ 创建文献
     */
    @withErrorBoundary('createLiterature', 'service')
    async createLiterature(
        input: CreateLiteratureInput,
        userId?: string,
        options: LiteratureCreateOptions = {}
    ): Promise<LiteratureOperationResult> {
        const startTime = Date.now();

        try {
            // 1. 数据验证
            if (options.validateData) {
                const validationResult = ModelValidators.CreateLiteratureInput.safeParse(input);
                if (!validationResult.success) {
                    throw new BusinessLogicError(
                        'Invalid literature input data',
                        'VALIDATION_ERROR',
                        { validationErrors: validationResult.error.errors }
                    );
                }
            }

            // 2. 预处理输入数据
            const processedInput = await this.preprocessInput(input, options);

            // 3. 检查重复（如果启用）
            if (options.checkDuplicates) {
                const duplicates = await this.literatureRepo.findSimilar(processedInput, 5);
                if (duplicates.some(d => d.confidence === 'high')) {
                    throw new BusinessLogicError(
                        'Potential duplicate literature detected',
                        'DUPLICATE_DETECTED',
                        { duplicates: duplicates.filter(d => d.confidence === 'high') }
                    );
                }
            }

            // 4. 创建文献记录
            const result = await this.literatureRepo.createOrUpdate(processedInput);

            // 5. 创建用户元数据（如果提供了用户ID）
            if (userId && processedInput.initialUserMeta) {
                await this.userMetaRepo.createOrUpdate(userId, result.id, processedInput.initialUserMeta);
            }

            this.updateStats(Date.now() - startTime, true);
            return result;
        } catch (error) {
            this.updateStats(Date.now() - startTime, false);
            throw ErrorHandler.handle(error, {
                operation: 'service.createLiterature',
                layer: 'service',
                inputData: input,
                userId,
            });
        }
    }

    /**
     * ✏️ 更新文献
     */
    @withErrorBoundary('updateLiterature', 'service')
    async updateLiterature(
        literatureId: string,
        updates: UpdateLiteratureInput,
        userId?: string
    ): Promise<LiteratureOperationResult> {
        const startTime = Date.now();

        try {
            // 1. 检查文献是否存在
            const existing = await this.literatureRepo.findByLid(literatureId);
            if (!existing) {
                throw new NotFoundError('LibraryItem', literatureId, {
                    operation: 'updateLiterature',
                    layer: 'service',
                });
            }

            // 2. 数据验证
            const validationResult = ModelValidators.UpdateLiteratureInput.safeParse(updates);
            if (!validationResult.success) {
                throw new BusinessLogicError(
                    'Invalid literature update data',
                    'VALIDATION_ERROR',
                    { validationErrors: validationResult.error.errors }
                );
            }

            // 3. 执行更新
            const result = await this.literatureRepo.update(literatureId, updates);

            this.updateStats(Date.now() - startTime, true);
            return result;
        } catch (error) {
            this.updateStats(Date.now() - startTime, false);
            throw ErrorHandler.handle(error, {
                operation: 'service.updateLiterature',
                layer: 'service',
                entityId: literatureId,
                inputData: updates,
                userId,
            });
        }
    }

    /**
     * 🗑️ 删除文献
     */
    @withErrorBoundary('deleteLiterature', 'service')
    async deleteLiterature(
        literatureId: string,
        userId?: string,
        options: { cascadeDelete?: boolean } = {}
    ): Promise<{ success: boolean; deletedCount: number }> {
        const startTime = Date.now();

        try {
            // 1. 检查文献是否存在
            const existing = await this.literatureRepo.findByLid(literatureId);
            if (!existing) {
                throw new NotFoundError('LibraryItem', literatureId, {
                    operation: 'deleteLiterature',
                    layer: 'service',
                });
            }

            let deletedCount = 0;

            // 2. 删除用户元数据（如果启用级联删除）
            if (options.cascadeDelete && userId) {
                const userMeta = await this.userMetaRepo.findByUserAndLiterature(userId, literatureId);
                if (userMeta) {
                    await this.userMetaRepo.delete(userMeta.id);
                    deletedCount++;
                }
            }

            // 3. 删除文献记录
            await this.literatureRepo.delete(literatureId);
            deletedCount++;

            this.updateStats(Date.now() - startTime, true);
            return { success: true, deletedCount };
        } catch (error) {
            this.updateStats(Date.now() - startTime, false);
            throw ErrorHandler.handle(error, {
                operation: 'service.deleteLiterature',
                layer: 'service',
                entityId: literatureId,
                userId,
            });
        }
    }

    // ==================== 批量操作 ====================

    /**
     * 📦 批量创建文献
     */
    @withErrorBoundary('bulkCreateLiterature', 'service')
    async bulkCreateLiterature(
        inputs: CreateLiteratureInput[],
        userId?: string,
        options: LiteratureCreateOptions & { batchSize?: number } = {}
    ): Promise<BulkLiteratureResult> {
        const startTime = Date.now();

        try {
            // 1. 预处理所有输入
            const processedInputs = await Promise.all(
                inputs.map(input => this.preprocessInput(input, options))
            );

            // 2. 执行批量导入
            const result = await this.literatureRepo.bulkImport(processedInputs, {
                batchSize: options.batchSize || LITERATURE_CONSTANTS.DEFAULT_BATCH_SIZE,
            });

            // 3. 批量创建用户元数据（如果需要）
            if (userId) {
                await this.batchCreateUserMetas(userId, result.results);
            }

            this.updateStats(Date.now() - startTime, true);
            return result;
        } catch (error) {
            this.updateStats(Date.now() - startTime, false);
            throw ErrorHandler.handle(error, {
                operation: 'service.bulkCreateLiterature',
                layer: 'service',
                additionalInfo: { inputCount: inputs.length },
                userId,
            });
        }
    }

    // ==================== 用户元数据管理 ====================

    /**
     * 🏷️ 更新用户元数据
     */
    @withErrorBoundary('updateUserMeta', 'service')
    async updateUserMeta(
        userId: string,
        literatureId: string,
        updates: Partial<UserLiteratureMetaCore>
    ): Promise<UserLiteratureMetaCore> {
        const startTime = Date.now();

        try {
            // 1. 检查文献是否存在
            const literature = await this.literatureRepo.findByLid(literatureId);
            if (!literature) {
                throw new NotFoundError('LibraryItem', literatureId, {
                    operation: 'updateUserMeta',
                    layer: 'service',
                });
            }

            // 2. 更新或创建用户元数据
            const result = await this.userMetaRepo.createOrUpdate(userId, literatureId, updates);

            this.updateStats(Date.now() - startTime, true);
            return result;
        } catch (error) {
            this.updateStats(Date.now() - startTime, false);
            throw ErrorHandler.handle(error, {
                operation: 'service.updateUserMeta',
                layer: 'service',
                entityId: literatureId,
                userId,
                inputData: updates,
            });
        }
    }

    /**
     * 📊 获取用户文献列表
     */
    @withErrorBoundary('getUserLiterature', 'service')
    async getUserLiterature(
        userId: string,
        filter: Partial<LiteratureFilter> = {},
        sort: LiteratureSort = { field: 'lastAccessedAt', order: 'desc' },
        page: number = 1,
        pageSize: number = LITERATURE_CONSTANTS.DEFAULT_PAGE_SIZE
    ): Promise<PaginatedResult<EnhancedLiteratureItem>> {
        const startTime = Date.now();

        try {
            // 1. 获取用户的所有文献元数据
            const userMetas = await this.userMetaRepo.findByUserId(userId);
            const literatureIds = userMetas.map(meta => meta.literatureId);

            if (literatureIds.length === 0) {
                return {
                    items: [],
                    pagination: {
                        page,
                        pageSize,
                        totalItems: 0,
                        totalPages: 0,
                        hasNextPage: false,
                        hasPreviousPage: false,
                    },
                };
            }

            // 2. 构建过滤条件
            const enhancedFilter: LiteratureFilter = {
                ...filter,
                ids: literatureIds,
            };

            // 3. 搜索文献
            const searchResult = await this.literatureRepo.searchWithFilters(
                enhancedFilter,
                sort,
                page,
                pageSize
            );

            // 4. 增强搜索结果
            const enhancedItems = await Promise.all(
                searchResult.items.map(async (item) => {
                    const userMeta = userMetas.find(meta => meta.literatureId === item.lid);
                    return {
                        ...item,
                        userMeta: userMeta || null,
                        citationStats: {
                            totalCitations: 0,
                            incomingCitations: 0,
                            outgoingCitations: 0,
                        },
                        relatedItems: [],
                        lastAccessedAt: userMeta?.lastAccessedAt || item.updatedAt,
                    } as EnhancedLiteratureItem;
                })
            );

            this.updateStats(Date.now() - startTime, true);
            return {
                items: enhancedItems,
                pagination: searchResult.pagination,
            };
        } catch (error) {
            this.updateStats(Date.now() - startTime, false);
            throw ErrorHandler.handle(error, {
                operation: 'service.getUserLiterature',
                layer: 'service',
                userId,
                additionalInfo: { filter, sort, page, pageSize },
            });
        }
    }

    // ==================== 辅助方法 ====================

    /**
     * 🔧 预处理输入数据
     */
    private async preprocessInput(
        input: CreateLiteratureInput,
        options: LiteratureCreateOptions
    ): Promise<CreateLiteratureInput> {
        const processed = { ...input };

        // 自动提取关键词
        if (options.autoExtractKeywords && input.abstract) {
            const extractedKeywords = await this.extractKeywords(input.abstract);
            processed.keywords = [...(input.keywords || []), ...extractedKeywords];
        }

        // 自动标签化
        if (options.autoTag) {
            const autoTags = await this.generateAutoTags(input);
            if (processed.initialUserMeta) {
                processed.initialUserMeta.tags = [
                    ...(processed.initialUserMeta.tags || []),
                    ...autoTags,
                ];
            } else {
                processed.initialUserMeta = { tags: autoTags };
            }
        }

        return processed;
    }

    /**
     * 📦 批量创建用户元数据
     */
    private async batchCreateUserMetas(
        userId: string,
        results: LiteratureOperationResult[]
    ): Promise<void> {
        const createPromises = results
            .filter(result => result.isNew)
            .map(result =>
                this.userMetaRepo.createOrUpdate(userId, result.id, {
                    tags: [],
                    readingStatus: 'unread',
                    priority: 'medium',
                })
            );

        await Promise.all(createPromises);
    }

    /**
     * 📊 更新统计信息
     */
    private updateStats(responseTime: number, success: boolean): void {
        this.stats.totalOperations++;
        this.stats.lastOperationAt = new Date();

        // 更新平均响应时间
        this.stats.averageResponseTime =
            (this.stats.averageResponseTime * (this.stats.totalOperations - 1) + responseTime) /
            this.stats.totalOperations;

        // 更新错误率
        if (!success) {
            this.stats.errorRate =
                (this.stats.errorRate * (this.stats.totalOperations - 1) + 1) /
                this.stats.totalOperations;
        } else {
            this.stats.errorRate =
                (this.stats.errorRate * (this.stats.totalOperations - 1)) /
                this.stats.totalOperations;
        }
    }

    /**
     * 📊 获取服务统计
     */
    public getServiceStats(): LiteratureServiceStats {
        return { ...this.stats };
    }

    // ==================== 占位符方法（需要具体实现） ====================

    private async extractKeywords(text: string): Promise<string[]> {
        // TODO: 实现关键词提取逻辑
        return [];
    }

    private async generateAutoTags(input: CreateLiteratureInput): Promise<string[]> {
        // TODO: 实现自动标签生成
        return [];
    }
}

// 🏪 服务实例
export const literatureService = new LiteratureService();

export default literatureService;