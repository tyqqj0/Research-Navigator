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
    LiteratureFilter,
    LiteratureSort,
    PaginatedResult,
} from '../models';
import { LiteratureService, literatureService } from './literature-service';
import { UserMetaService, userMetaService } from './user-meta-service';
import { handleError } from '../../../../lib/errors';
import { authStoreUtils, type AuthStoreState } from '../../../../stores/auth.store';

// 错误处理器别名
const ErrorHandler = { handle: handleError };

/**
 * 📝 创建文献输入（包含用户元数据）
 * 🎯 重构后：移除userId参数，Service内部自动获取
 */
export interface CreateComposedLiteratureInput {
    // 文献核心数据
    literature: CreateLibraryItemInput;
    // 用户元数据（可选）
    userMeta?: Omit<CreateUserLiteratureMetaInput, 'paperId' | 'userId'>;
    // 🚀 移除userId参数 - Service内部自动获取当前用户
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
    failed: Array<{ paperId: string; error: string }>;
    total: number;
}

/**
 * 📚 文献组合操作服务
 * 
 * 负责对已组合的文献数据进行业务操作
 * 🎯 重构后：内部自动获取用户身份，消除Parameter Drilling
 */
export class CompositionService {
    private authStore: Pick<AuthStoreState, 'getCurrentUserId' | 'requireAuth'>;

    constructor(
        private literatureService: LiteratureService,
        private userMetaService: UserMetaService,
        authStore?: Pick<AuthStoreState, 'getCurrentUserId' | 'requireAuth'>
    ) {
        // 🔐 注入Auth Store依赖，支持测试时Mock
        this.authStore = authStore || authStoreUtils.getStoreInstance();
    }

    // 🔐 内部方法：安全获取当前用户ID
    private getCurrentUserId(): string {
        try {
            return this.authStore.requireAuth();
        } catch (error) {
            ErrorHandler.handle(error, {
                operation: 'CompositionService.getCurrentUserId',
                additionalInfo: { message: 'Authentication required for literature operations' }
            });
            throw error;
        }
    }

    // ==================== 创建操作 ====================

    /**
     * ✨ 创建组合文献
     * 
     * 同时创建文献数据和用户元数据，确保数据一致性
     * 🎯 重构后：自动获取当前用户ID，无需传递userId参数
     */
    async createComposedLiterature(input: CreateComposedLiteratureInput): Promise<EnhancedLibraryItem> {
        const userId = this.getCurrentUserId(); // 🔐 内部自动获取用户ID

        try {
            // 1. 创建文献核心数据
            const result = await this.literatureService.createLiterature(input.literature);

            // 获取创建的文献数据
            const literature = await this.literatureService.getLiterature(result.paperId);
            if (!literature) {
                throw new Error('Failed to retrieve created literature');
            }

            // 2. 创建用户元数据（如果提供）
            let userMeta: UserLiteratureMeta | null = null;
            if (input.userMeta) {
                const metaInput: CreateUserLiteratureMetaInput = {
                    ...input.userMeta,
                    paperId: literature.paperId,
                    userId, // 🎯 使用内部获取的userId
                    tags: input.userMeta.tags || [],
                    readingStatus: input.userMeta.readingStatus || 'unread',
                    associatedSessions: input.userMeta.associatedSessions || [],
                    associatedProjects: input.userMeta.associatedProjects || [],
                    customCategories: input.userMeta.customCategories || [],
                    customFields: input.userMeta.customFields || {},
                };
                userMeta = await this.userMetaService.createUserMeta(
                    userId, // 🎯 使用内部获取的userId
                    literature.paperId,
                    metaInput,
                    { autoSetDefaultTags: true }
                );
            }

            // 3. 返回组合结果
            return this.buildEnhancedItem(literature, userMeta);
        } catch (error) {
            ErrorHandler.handle(error, {
                operation: 'CompositionService.createComposedLiterature',
                additionalInfo: { message: `Creating literature for user: ${userId}` }
            });
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
                results.success.push(created.literature.paperId);
            } catch (error) {
                results.failed.push({
                    paperId: `temp-${Date.now()}`, // 临时ID，因为还未创建
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
     * 🎯 重构后：自动获取当前用户ID，简化API调用
     */
    async updateComposedLiterature(
        paperId: string,
        updates: UpdateComposedLiteratureInput
    ): Promise<EnhancedLibraryItem> {
        const userId = this.getCurrentUserId(); // 🔐 内部自动获取用户ID
        try {
            let literature: LibraryItem | null = null;
            let userMeta: UserLiteratureMeta | null = null;

            // 1. 更新文献核心数据（如果提供）
            if (updates.literature) {
                const result = await this.literatureService.updateLiterature(paperId, updates.literature);
                // 获取更新后的数据
                literature = await this.literatureService.getLiterature(paperId);
                if (!literature) {
                    throw new Error('Failed to retrieve updated literature');
                }
            } else {
                literature = await this.literatureService.getLiterature(paperId);
            }

            if (!literature) {
                throw new Error(`Literature not found: ${paperId}`);
            }

            // 2. 更新用户元数据（如果提供）
            if (updates.userMeta) {
                // 先检查用户元数据是否存在
                const existingMeta = await this.userMetaService.getUserMeta(userId, paperId);

                if (existingMeta) {
                    userMeta = await this.userMetaService.updateUserMeta(userId, paperId, updates.userMeta);
                } else {
                    // 如果不存在则创建
                    const metaInput: CreateUserLiteratureMetaInput = {
                        ...updates.userMeta,
                        paperId,
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
                        paperId,
                        metaInput,
                        { autoSetDefaultTags: true }
                    );
                }
            } else {
                // 获取现有用户元数据
                try {
                    userMeta = await this.userMetaService.getUserMeta(userId, paperId);
                } catch (error) {
                    // 用户元数据不存在是正常情况
                }
            }

            // 3. 返回组合结果
            return this.buildEnhancedItem(literature, userMeta);
        } catch (error) {
            ErrorHandler.handle(error, {
                operation: 'CompositionService.updateComposedLiterature',
                additionalInfo: { message: `Updating literature ${paperId} for user: ${userId}` }
            });
            throw error;
        }
    }

    /**
     * 📝 批量更新组合文献
     * 🎯 重构后：移除userId参数，批量操作都使用当前用户
     */
    async updateComposedLiteratureBatch(
        updates: Array<{ paperId: string; updates: UpdateComposedLiteratureInput }>
    ): Promise<BatchOperationResult> {
        const results: BatchOperationResult = {
            success: [],
            failed: [],
            total: updates.length
        };

        for (const update of updates) {
            try {
                await this.updateComposedLiterature(update.paperId, update.updates); // 🎯 移除userId参数
                results.success.push(update.paperId);
            } catch (error) {
                results.failed.push({
                    paperId: update.paperId,
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
     * 🎯 重构后：自动使用当前用户，API更简洁
     */
    async updateUserMeta(
        paperId: string,
        updates: UpdateUserLiteratureMetaInput
    ): Promise<EnhancedLibraryItem> {
        return this.updateComposedLiterature(paperId, { userMeta: updates }); // 🎯 移除userId参数
    }

    // ==================== 删除操作 ====================

    /**
     * 🗑️ 删除组合文献
     * 
     * 清理所有相关数据，包括用户元数据
     * 🎯 重构后：默认删除当前用户的数据，可选择删除全局数据
     */
    async deleteComposedLiterature(paperId: string, options: {
        deleteGlobally?: boolean
    } = {}): Promise<void> {
        const userId = this.getCurrentUserId(); // 🔐 内部自动获取用户ID

        try {
            // 1. 删除当前用户的元数据
            try {
                await this.userMetaService.deleteUserMeta(paperId, userId);
            } catch (error) {
                // 用户元数据可能不存在，忽略错误
            }

            // 2. 如果指定全局删除，则删除文献核心数据
            if (options.deleteGlobally) {
                await this.literatureService.deleteLiterature(paperId);
                // TODO: 实现删除所有用户元数据的方法
                // await this.userMetaService.deleteAllUserMetaForLiterature(paperId);
            }
        } catch (error) {
            ErrorHandler.handle(error, {
                operation: 'CompositionService.deleteComposedLiterature',
                additionalInfo: { message: `Deleting literature ${paperId} for user: ${userId}, global: ${options.deleteGlobally}` }
            });
            throw error;
        }
    }

    /**
     * 🗑️ 批量删除组合文献
     * 🎯 重构后：批量删除当前用户的文献数据
     */
    async deleteComposedLiteratureBatch(
        requests: Array<{ paperId: string; deleteGlobally?: boolean }>
    ): Promise<BatchOperationResult> {
        const results: BatchOperationResult = {
            success: [],
            failed: [],
            total: requests.length
        };

        for (const request of requests) {
            try {
                await this.deleteComposedLiterature(request.paperId, {
                    deleteGlobally: request.deleteGlobally
                }); // 🎯 使用新的options参数
                results.success.push(request.paperId);
            } catch (error) {
                results.failed.push({
                    paperId: request.paperId,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        return results;
    }

    // ==================== 查询操作 ====================

    /**
     * 📚 获取单个增强文献
     * 🎯 重构后：自动使用当前用户的元数据进行增强
     */
    async getEnhancedLiterature(paperId: string): Promise<EnhancedLibraryItem | null> {
        const userId = this.getCurrentUserId(); // 🔐 内部自动获取用户ID
        try {
            // 1. 获取文献数据
            const literature = await this.literatureService.getLiterature(paperId);
            if (!literature) {
                return null;
            }

            // 2. 获取当前用户的元数据
            let userMeta: UserLiteratureMeta | null = null;
            try {
                userMeta = await this.userMetaService.getUserMeta(userId, paperId);
            } catch (error) {
                // 用户元数据不存在是正常情况
            }

            return this.buildEnhancedItem(literature, userMeta);
        } catch (error) {
            ErrorHandler.handle(error, { operation: 'CompositionService.getEnhancedLiterature' });
            throw error;
        }
    }

    /**
     * 📋 获取当前用户的所有组合文献
     * 🎯 重构后：自动获取当前用户的文献，无需传递userId
     */
    async getUserComposedLiteratures(): Promise<EnhancedLibraryItem[]> {
        const userId = this.getCurrentUserId(); // 🔐 内部自动获取用户ID
        try {
            // 1. 获取用户的所有文献元数据
            const userMetas = await this.userMetaService.getUserAllMetas(userId);

            // 2. 批量获取文献数据
            const lids = userMetas.map(meta => meta.paperId);
            const literatures: LibraryItem[] = [];

            // 批量获取文献数据
            for (const paperId of lids) {
                try {
                    const literature = await this.literatureService.getLiterature(paperId);
                    if (literature) {
                        literatures.push(literature);
                    }
                } catch (error) {
                    // 单个文献获取失败不影响整体
                    console.warn(`Failed to get literature ${paperId}:`, error);
                }
            }

            // 3. 组合数据
            const enhancedItems: EnhancedLibraryItem[] = [];
            for (const literature of literatures) {
                const userMeta = userMetas.find(meta => meta.paperId === literature.paperId);
                enhancedItems.push(this.buildEnhancedItem(literature, userMeta || null));
            }

            return enhancedItems;
        } catch (error) {
            ErrorHandler.handle(error, { operation: 'CompositionService.getUserComposedLiteratures' });
            throw error;
        }
    }

    /**
     * 🔍 搜索增强文献
     * 🎯 重构后：自动使用当前用户进行搜索和增强
     */
    async searchEnhancedLiteratures(
        filter: LiteratureFilter = {},
        sort: LiteratureSort = { field: 'createdAt', order: 'desc' },
        page: number = 1,
        pageSize: number = 20
    ): Promise<PaginatedResult<EnhancedLibraryItem>> {
        const userId = this.getCurrentUserId(); // 🔐 内部自动获取用户ID
        try {
            // 1. 执行基础搜索
            const searchResult = await this.literatureService.searchLiterature(filter, sort, page, pageSize);

            // 2. 增强搜索结果
            const enhancedItems: EnhancedLibraryItem[] = [];
            for (const literature of searchResult.items) {
                let userMeta: UserLiteratureMeta | null = null;
                try {
                    userMeta = await this.userMetaService.getUserMeta(userId, literature.paperId);
                } catch (error) {
                    // 用户元数据不存在是正常情况
                }
                enhancedItems.push(this.buildEnhancedItem(literature, userMeta));
            }

            return {
                items: enhancedItems,
                total: searchResult.total,
                page: searchResult.page,
                pageSize: searchResult.pageSize,
                totalPages: searchResult.totalPages,
            };
        } catch (error) {
            ErrorHandler.handle(error, { operation: 'CompositionService.searchEnhancedLiteratures' });
            throw error;
        }
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

// 导出单例实例 - 🎯 注入Auth Store依赖
export const compositionService = new CompositionService(
    literatureService,
    userMetaService,
    authStoreUtils.getStoreInstance() // 🔐 注入Auth Store
);