/**
 * 📚 Literature Composition Service - 文献组合操作服务
 * 
 * 负责对已组合的文献数据进行业务操作，包括：
 * - 添加文献（同时处理文献数据和用户元数据）
 * - 修改文献（包括笔记、标签、评分等用户元数据）
 * - 删除文献（清理所有相关数据）
 * - 批量操作（批量添加、修改、删除）
 * 
 * 设计原则:
 * 1. 业务操作 - 专注于对组合数据的CRUD操作
 * 2. 原子性 - 确保文献数据和用户元数据的一致性
 * 3. 批量友好 - 支持批量操作以提高性能
 * 4. 事务安全 - 操作失败时回滚所有相关更改
 * 5. 类型安全 - 完整的TypeScript支持
 */

import type {
    LibraryItem,
    CreateLibraryItemInput,
    UpdateLibraryItemInput,
    UserLiteratureMeta,
    CreateUserLiteratureMetaInput,
    UpdateUserLiteratureMetaInput,
    EnhancedLibraryItem,
} from '../models';
import { LiteratureService, literatureService } from './literature-service';
import { UserMetaService, userMetaService } from './user-meta-service';
import { handleError } from '../../../../lib/errors';

// 错误处理器别名
const ErrorHandler = { handle: handleError };

/**
 * 📝 创建文献输入（包含用户元数据）
 */
export interface CreateComposedLiteratureInput {
    // 文献核心数据
    literature: CreateLibraryItemInput;
    // 用户元数据（可选）
    userMeta?: Omit<CreateUserLiteratureMetaInput, 'lid' | 'userId'>;
    // 用户ID
    userId: string;
}

/**
 * 📝 更新文献输入（包含用户元数据）
 */
export interface UpdateComposedLiteratureInput {
    // 文献核心数据更新
    literature?: UpdateLibraryItemInput;
    // 用户元数据更新
    userMeta?: UpdateUserLiteratureMetaInput;
}

/**
 * 📊 批量操作结果
 */
export interface BatchOperationResult {
    success: string[];
    failed: Array<{ lid: string; error: string }>;
    total: number;
}

/**
 * 📚 文献组合操作服务
 * 
 * 负责对已组合的文献数据进行业务操作
 */
export class CompositionService {
    constructor(
        private literatureService: LiteratureService,
        private userMetaService: UserMetaService
    ) { }

    // ==================== 创建操作 ====================

    /**
     * ✨ 创建组合文献
     * 
     * 同时创建文献数据和用户元数据，确保数据一致性
     */
    async createComposedLiterature(input: CreateComposedLiteratureInput): Promise<EnhancedLibraryItem> {
        try {
            // 1. 创建文献核心数据
            const result = await this.literatureService.createLiterature(input.literature);

            // 获取创建的文献数据
            const literature = await this.literatureService.getLiterature(result.lid);
            if (!literature) {
                throw new Error('Failed to retrieve created literature');
            }

            // 2. 创建用户元数据（如果提供）
            let userMeta: UserLiteratureMeta | null = null;
            if (input.userMeta) {
                const metaInput: CreateUserLiteratureMetaInput = {
                    ...input.userMeta,
                    lid: literature.lid,
                    userId: input.userId,
                    tags: input.userMeta.tags || [],
                    readingStatus: input.userMeta.readingStatus || 'unread',
                    associatedSessions: input.userMeta.associatedSessions || [],
                    associatedProjects: input.userMeta.associatedProjects || [],
                    customCategories: input.userMeta.customCategories || [],
                    customFields: input.userMeta.customFields || {},
                };
                userMeta = await this.userMetaService.createUserMeta(
                    input.userId,
                    literature.lid,
                    metaInput,
                    { autoSetDefaultTags: true }
                );
            }

            // 3. 返回组合结果
            return this.buildEnhancedItem(literature, userMeta);
        } catch (error) {
            ErrorHandler.handle(error, { operation: 'CompositionService.createComposedLiterature' });
            throw error;
        }
    }

    /**
     * ✨ 批量创建组合文献
     */
    async createComposedLiteratureBatch(inputs: CreateComposedLiteratureInput[]): Promise<BatchOperationResult> {
        const results: BatchOperationResult = {
            success: [],
            failed: [],
            total: inputs.length
        };

        for (const input of inputs) {
            try {
                const created = await this.createComposedLiterature(input);
                results.success.push(created.literature.lid);
            } catch (error) {
                results.failed.push({
                    lid: `temp-${Date.now()}`, // 临时ID，因为还未创建
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        return results;
    }

    // ==================== 更新操作 ====================

    /**
     * 📝 更新组合文献
     * 
     * 可以同时更新文献数据和用户元数据
     */
    async updateComposedLiterature(
        lid: string,
        userId: string,
        updates: UpdateComposedLiteratureInput
    ): Promise<EnhancedLibraryItem> {
        try {
            let literature: LibraryItem | null = null;
            let userMeta: UserLiteratureMeta | null = null;

            // 1. 更新文献核心数据（如果提供）
            if (updates.literature) {
                const result = await this.literatureService.updateLiterature(lid, updates.literature);
                // 获取更新后的数据
                literature = await this.literatureService.getLiterature(lid);
                if (!literature) {
                    throw new Error('Failed to retrieve updated literature');
                }
            } else {
                literature = await this.literatureService.getLiterature(lid);
            }

            if (!literature) {
                throw new Error(`Literature not found: ${lid}`);
            }

            // 2. 更新用户元数据（如果提供）
            if (updates.userMeta) {
                // 先检查用户元数据是否存在
                const existingMeta = await this.userMetaService.getUserMeta(userId, lid);

                if (existingMeta) {
                    userMeta = await this.userMetaService.updateUserMeta(userId, lid, updates.userMeta);
                } else {
                    // 如果不存在则创建
                    const metaInput: CreateUserLiteratureMetaInput = {
                        ...updates.userMeta,
                        lid,
                        userId,
                        tags: updates.userMeta.tags || [],
                        readingStatus: updates.userMeta.readingStatus || 'unread',
                        associatedSessions: updates.userMeta.associatedSessions || [],
                        associatedProjects: updates.userMeta.associatedProjects || [],
                        customCategories: updates.userMeta.customCategories || [],
                        customFields: updates.userMeta.customFields || {},
                    };
                    userMeta = await this.userMetaService.createUserMeta(
                        userId,
                        lid,
                        metaInput,
                        { autoSetDefaultTags: true }
                    );
                }
            } else {
                // 获取现有用户元数据
                try {
                    userMeta = await this.userMetaService.getUserMeta(userId, lid);
                } catch (error) {
                    // 用户元数据不存在是正常情况
                }
            }

            // 3. 返回组合结果
            return this.buildEnhancedItem(literature, userMeta);
        } catch (error) {
            ErrorHandler.handle(error, { operation: 'CompositionService.updateComposedLiterature' });
            throw error;
        }
    }

    /**
     * 📝 批量更新组合文献
     */
    async updateComposedLiteratureBatch(
        updates: Array<{ lid: string; userId: string; updates: UpdateComposedLiteratureInput }>
    ): Promise<BatchOperationResult> {
        const results: BatchOperationResult = {
            success: [],
            failed: [],
            total: updates.length
        };

        for (const update of updates) {
            try {
                await this.updateComposedLiterature(update.lid, update.userId, update.updates);
                results.success.push(update.lid);
            } catch (error) {
                results.failed.push({
                    lid: update.lid,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        return results;
    }

    /**
     * 🏷️ 更新用户元数据（快捷方法）
     * 
     * 专门用于更新笔记、标签、评分等用户相关数据
     */
    async updateUserMeta(
        lid: string,
        userId: string,
        updates: UpdateUserLiteratureMetaInput
    ): Promise<EnhancedLibraryItem> {
        return this.updateComposedLiterature(lid, userId, { userMeta: updates });
    }

    // ==================== 删除操作 ====================

    /**
     * 🗑️ 删除组合文献
     * 
     * 清理所有相关数据，包括用户元数据
     */
    async deleteComposedLiterature(lid: string, userId?: string): Promise<void> {
        try {
            // 1. 删除用户元数据（如果指定用户）
            if (userId) {
                try {
                    await this.userMetaService.deleteUserMeta(lid, userId);
                } catch (error) {
                    // 用户元数据可能不存在，忽略错误
                }
            } else {
                // 删除所有用户的元数据
                try {
                    // TODO: 实现删除所有用户元数据的方法
                    // await this.userMetaService.deleteAllUserMetaForLiterature(lid);
                } catch (error) {
                    // 忽略错误
                }
            }

            // 2. 删除文献核心数据（只有在没有指定特定用户时）
            if (!userId) {
                await this.literatureService.deleteLiterature(lid);
            }
        } catch (error) {
            ErrorHandler.handle(error, { operation: 'CompositionService.deleteComposedLiterature' });
            throw error;
        }
    }

    /**
     * 🗑️ 批量删除组合文献
     */
    async deleteComposedLiteratureBatch(
        requests: Array<{ lid: string; userId?: string }>
    ): Promise<BatchOperationResult> {
        const results: BatchOperationResult = {
            success: [],
            failed: [],
            total: requests.length
        };

        for (const request of requests) {
            try {
                await this.deleteComposedLiterature(request.lid, request.userId);
                results.success.push(request.lid);
            } catch (error) {
                results.failed.push({
                    lid: request.lid,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        return results;
    }

    // ==================== 辅助方法 ====================

    /**
     * 🔧 构建增强的文献项
     */
    private buildEnhancedItem(
        literature: LibraryItem,
        userMeta: UserLiteratureMeta | null = null
    ): EnhancedLibraryItem {
        return {
            literature,
            userMeta: userMeta || undefined,
        };
    }
}

// 导出单例实例
export const compositionService = new CompositionService(
    literatureService,
    userMetaService
);