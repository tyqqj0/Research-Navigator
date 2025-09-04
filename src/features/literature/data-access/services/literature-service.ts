/**
 * 📚 Literature Service - 核心文献业务服务
 * 
 * 职责:
 * 1. 文献的基础CRUD操作
 * 2. 业务规则验证
 * 3. 批量操作协调
 * 
 * 设计原则:
 * - 单一职责：只处理文献相关的核心业务逻辑
 * - 依赖注入：通过构造函数注入仓储层依赖
 * - 错误处理：统一的错误处理和日志记录
 * - 类型安全：完整的TypeScript类型支持
 */

import {
    literatureRepository,
    type LiteratureOperationResult,
    type BulkLiteratureResult,
} from '../repositories';
import {
    LibraryItem,
    CreateLibraryItemInput,
    UpdateLibraryItemInput,
    LiteratureFilter,
    LiteratureSort,
    PaginatedResult,
    LibraryItemFactory,
    ModelValidators,
    LITERATURE_CONSTANTS,
} from '../models';
import { AppError, ErrorType, ErrorSeverity, handleError } from '../../../../lib/errors';

// 错误处理器别名
const ErrorHandler = { handle: handleError };

/**
 * 🔧 文献创建选项
 */
export interface LiteratureCreateOptions {
    /** 自动提取关键词 */
    autoExtractKeywords?: boolean;
    /** 自动检测重复 */
    checkDuplicates?: boolean;
    /** 验证数据完整性 */
    validateData?: boolean;
}

/**
 * 🗑️ 文献删除选项
 */
export interface LiteratureDeleteOptions {
    /** 级联删除相关数据 */
    cascadeDelete?: boolean;
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
        private readonly literatureRepo = literatureRepository
    ) { }

    // ==================== 基础CRUD操作 ====================

    /**
     * 📖 获取文献详情
     */
    async getLiterature(lid: string): Promise<LibraryItem | null> {
        const startTime = Date.now();

        try {
            const literature = await this.literatureRepo.findByLid(lid);

            this.updateStats(Date.now() - startTime, true);
            return literature;

        } catch (error) {
            this.updateStats(Date.now() - startTime, false);
            throw ErrorHandler.handle(error, {
                operation: 'service.getLiterature',
                layer: 'service',
                additionalInfo: { lid },
            });
        }
    }

    /**
     * ➕ 创建文献
     */
    async createLiterature(
        input: CreateLibraryItemInput,
        options: LiteratureCreateOptions = {}
    ): Promise<LiteratureOperationResult> {
        const startTime = Date.now();

        try {
            // 1. 数据验证
            if (options.validateData) {
                try {
                    ModelValidators.createInput(input);
                } catch (validationError) {
                    throw new AppError(
                        'Invalid literature input data',
                        ErrorType.VALIDATION_ERROR,
                        ErrorSeverity.HIGH,
                        { additionalInfo: { validationError } }
                    );
                }
            }

            // 2. 预处理输入数据
            const processedInput = await this.preprocessInput(input, options);

            // 3. 检查重复（如果启用）
            if (options.checkDuplicates) {
                const duplicates = await this.literatureRepo.findSimilar(processedInput, 5);
                if (duplicates.some((d: any) => d.confidence === 'high')) {
                    throw new AppError(
                        'Potential duplicate literature detected',
                        ErrorType.DUPLICATE_ERROR,
                        ErrorSeverity.HIGH,
                        { additionalInfo: { duplicates: duplicates.filter((d: any) => d.confidence === 'high') } }
                    );
                }
            }

            // 4. 创建文献记录
            const result = await this.literatureRepo.createOrUpdate(processedInput);

            this.updateStats(Date.now() - startTime, true);
            return result;
        } catch (error) {
            this.updateStats(Date.now() - startTime, false);
            throw ErrorHandler.handle(error, {
                operation: 'service.createLiterature',
                layer: 'service',
                additionalInfo: { input },
            });
        }
    }

    /**
     * ✏️ 更新文献
     */
    async updateLiterature(
        lid: string,
        updates: UpdateLibraryItemInput
    ): Promise<LiteratureOperationResult> {
        const startTime = Date.now();

        try {
            // 1. 检查文献是否存在
            const existing = await this.literatureRepo.findByLid(lid);
            if (!existing) {
                throw new AppError('LibraryItem not found', ErrorType.NOT_FOUND_ERROR, ErrorSeverity.HIGH, {
                    operation: 'updateLiterature',
                    layer: 'service',
                });
            }

            // 2. 数据验证
            try {
                ModelValidators.updateInput(updates);
            } catch (validationError) {
                throw new AppError(
                    'Invalid literature update data',
                    ErrorType.VALIDATION_ERROR,
                    ErrorSeverity.HIGH,
                    { additionalInfo: { validationError } }
                );
            }

            // 3. 执行更新
            await this.literatureRepo.update(lid, updates);

            // 返回操作结果
            const result: LiteratureOperationResult = {
                lid: lid,
                isNew: false,
                operation: 'updated',
                message: 'Literature updated successfully'
            };

            this.updateStats(Date.now() - startTime, true);
            return result;
        } catch (error) {
            this.updateStats(Date.now() - startTime, false);
            throw ErrorHandler.handle(error, {
                operation: 'service.updateLiterature',
                layer: 'service',
                additionalInfo: { lid, updates },
            });
        }
    }

    /**
     * 🗑️ 删除文献
     */
    async deleteLiterature(
        lid: string,
        options: LiteratureDeleteOptions = {}
    ): Promise<{ success: boolean; deletedCount: number }> {
        const startTime = Date.now();

        try {
            // 1. 检查文献是否存在
            const existing = await this.literatureRepo.findByLid(lid);
            if (!existing) {
                throw new AppError('LibraryItem not found', ErrorType.NOT_FOUND_ERROR, ErrorSeverity.HIGH, {
                    operation: 'deleteLiterature',
                    layer: 'service',
                });
            }

            // 2. 删除文献记录
            await this.literatureRepo.delete(lid);

            this.updateStats(Date.now() - startTime, true);
            return { success: true, deletedCount: 1 };
        } catch (error) {
            this.updateStats(Date.now() - startTime, false);
            throw ErrorHandler.handle(error, {
                operation: 'service.deleteLiterature',
                layer: 'service',
                additionalInfo: { lid },
            });
        }
    }

    // ==================== 搜索和查询 ====================

    /**
     * 🔍 搜索文献
     */
    async searchLiterature(
        filter: Partial<LiteratureFilter> = {},
        sort: LiteratureSort = { field: 'createdAt', order: 'desc' },
        page: number = 1,
        pageSize: number = LITERATURE_CONSTANTS.DEFAULT_PAGE_SIZE
    ): Promise<PaginatedResult<LibraryItem>> {
        const startTime = Date.now();

        try {
            const result = await this.literatureRepo.searchWithFilters(
                filter,
                sort,
                page,
                pageSize
            );

            this.updateStats(Date.now() - startTime, true);
            return result;
        } catch (error) {
            this.updateStats(Date.now() - startTime, false);
            throw ErrorHandler.handle(error, {
                operation: 'service.searchLiterature',
                layer: 'service',
                additionalInfo: { filter, sort, page, pageSize },
            });
        }
    }

    // ==================== 批量操作 ====================

    /**
     * 📦 批量创建文献
     */
    async bulkCreateLiterature(
        inputs: CreateLibraryItemInput[],
        options: LiteratureCreateOptions & { batchSize?: number } = {}
    ): Promise<BulkLiteratureResult> {
        const startTime = Date.now();

        try {
            // 1. 预处理所有输入
            const processedInputs = await Promise.all(
                inputs.map(input => this.preprocessInput(input, options))
            );

            // 2. 执行批量导入
            const result = await this.literatureRepo.bulkImport(processedInputs);

            this.updateStats(Date.now() - startTime, true);
            return result;
        } catch (error) {
            this.updateStats(Date.now() - startTime, false);
            throw ErrorHandler.handle(error, {
                operation: 'service.bulkCreateLiterature',
                layer: 'service',
                additionalInfo: { inputCount: inputs.length, options },
            });
        }
    }

    /**
     * 🗑️ 批量删除文献
     */
    async bulkDeleteLiterature(
        lids: string[],
        options: LiteratureDeleteOptions = {}
    ): Promise<{ success: boolean; deletedCount: number }> {
        const startTime = Date.now();

        try {
            let deletedCount = 0;

            // 批量删除文献
            for (const lid of lids) {
                try {
                    await this.deleteLiterature(lid, options);
                    deletedCount++;
                } catch (error) {
                    // 记录错误但继续处理其他项目
                    console.warn(`Failed to delete literature ${lid}:`, error);
                }
            }

            this.updateStats(Date.now() - startTime, true);
            return { success: true, deletedCount };
        } catch (error) {
            this.updateStats(Date.now() - startTime, false);
            throw ErrorHandler.handle(error, {
                operation: 'service.bulkDeleteLiterature',
                layer: 'service',
                additionalInfo: { lids, options },
            });
        }
    }

    // ==================== 辅助方法 ====================

    /**
     * 🔧 预处理输入数据
     */
    private async preprocessInput(
        input: CreateLibraryItemInput,
        options: LiteratureCreateOptions
    ): Promise<CreateLibraryItemInput> {
        const processed = { ...input };

        // 自动提取关键词
        if (options.autoExtractKeywords && input.abstract) {
            const extractedKeywords = await this.extractKeywords(input.abstract);
            // Note: keywords field is not available in current LibraryItem schema
            // This is a placeholder for future implementation
        }

        return processed;
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
}

// 🏪 服务实例
export const literatureService = new LiteratureService();

export default literatureService;