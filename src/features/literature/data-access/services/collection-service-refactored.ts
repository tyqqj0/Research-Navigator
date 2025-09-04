/**
 * 📂 Collection Service - 重构后的集合业务服务
 * 
 * 设计原则:
 * 1. 纯业务逻辑：只处理集合相关的业务规则和操作
 * 2. 无状态管理：不管理任何UI状态，由Store层负责
 * 3. 单一职责：专注于集合的CRUD和业务规则验证
 * 4. 依赖注入：通过构造函数注入Repository依赖
 * 
 * 架构变化:
 * - 移除了所有状态管理代码
 * - 移除了数据组合逻辑（交给Hook层）
 * - 专注于业务规则和数据验证
 * - 返回纯数据，不处理UI状态
 */

import {
    collectionRepository,
    literatureRepository,
    userMetaRepository,
} from '../repositories';
import {
    Collection,
    CollectionType,
    SmartCollectionRule,
    CreateCollectionInput,
    UpdateCollectionInput,
    CollectionQuery,
    CollectionSort,
    CollectionOperation,
    SmartCollectionResult,
} from '../models';
import { handleError } from '../../../../lib/errors';

// ==================== 业务错误类型 ====================

export class CollectionBusinessError extends Error {
    constructor(
        message: string,
        public code: string,
        public details?: any
    ) {
        super(message);
        this.name = 'CollectionBusinessError';
    }
}

// ==================== 业务规则常量 ====================

const BUSINESS_RULES = {
    MAX_COLLECTION_NAME_LENGTH: 100,
    MAX_DESCRIPTION_LENGTH: 500,
    MAX_COLLECTIONS_PER_USER: 1000,
    MAX_LITERATURE_PER_COLLECTION: 10000,
    MAX_NESTING_DEPTH: 5,
    SMART_COLLECTION_UPDATE_INTERVAL: 3600, // 1小时
} as const;

// ==================== Collection Service 类 ====================

export class CollectionService {
    constructor(
        private readonly collectionRepo = collectionRepository,
        private readonly literatureRepo = literatureRepository,
        private readonly userMetaRepo = userMetaRepository
    ) { }

    // ==================== 基础CRUD操作 ====================

    /**
     * ➕ 创建集合
     */
    async createCollection(
        userId: string,
        input: CreateCollectionInput
    ): Promise<Collection> {
        try {
            // 1. 业务规则验证
            await this.validateCreateCollection(userId, input);

            // 2. 数据预处理
            const processedInput = await this.preprocessCreateInput(userId, input);

            // 3. 执行创建
            const collectionId = await this.collectionRepo.createCollection(processedInput);

            // 4. 获取创建结果
            const collection = await this.collectionRepo.findById(collectionId);
            if (!collection) {
                throw new CollectionBusinessError(
                    'Failed to retrieve created collection',
                    'CREATION_FAILED'
                );
            }

            // 5. 后处理操作
            await this.postCreateCollection(collection);

            return collection;
        } catch (error) {
            throw handleError(error, 'Failed to create collection');
        }
    }

    /**
     * 📝 更新集合
     */
    async updateCollection(
        collectionId: string,
        userId: string,
        updates: UpdateCollectionInput
    ): Promise<Collection> {
        try {
            // 1. 权限验证
            await this.validateCollectionAccess(collectionId, userId, 'write');

            // 2. 业务规则验证
            await this.validateUpdateCollection(collectionId, updates);

            // 3. 数据预处理
            const processedUpdates = await this.preprocessUpdateInput(collectionId, updates);

            // 4. 执行更新
            await this.collectionRepo.update(collectionId, processedUpdates);

            // 5. 获取更新结果
            const collection = await this.collectionRepo.findById(collectionId);
            if (!collection) {
                throw new CollectionBusinessError(
                    'Collection not found after update',
                    'UPDATE_FAILED'
                );
            }

            // 6. 后处理操作
            await this.postUpdateCollection(collection, updates);

            return collection;
        } catch (error) {
            throw handleError(error, 'Failed to update collection');
        }
    }

    /**
     * 🗑️ 删除集合
     */
    async deleteCollection(collectionId: string, userId: string): Promise<void> {
        try {
            // 1. 权限验证
            await this.validateCollectionAccess(collectionId, userId, 'delete');

            // 2. 业务规则验证
            await this.validateDeleteCollection(collectionId);

            // 3. 预删除处理
            await this.preDeleteCollection(collectionId);

            // 4. 执行删除
            await this.collectionRepo.delete(collectionId);

        } catch (error) {
            throw handleError(error, 'Failed to delete collection');
        }
    }

    /**
     * 🔍 查询集合
     */
    async queryCollections(
        query: CollectionQuery,
        sort: CollectionSort = { field: 'createdAt', order: 'desc' },
        page: number = 1,
        pageSize: number = 20
    ): Promise<{
        items: Collection[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    }> {
        try {
            return await this.collectionRepo.searchWithFilters(query, sort, page, pageSize);
        } catch (error) {
            throw handleError(error, 'Failed to query collections');
        }
    }

    // ==================== 文献管理操作 ====================

    /**
     * 📚 添加文献到集合
     */
    async addLiteratureToCollection(
        collectionId: string,
        literatureIds: string[],
        userId: string
    ): Promise<void> {
        try {
            // 1. 权限验证
            await this.validateCollectionAccess(collectionId, userId, 'write');

            // 2. 业务规则验证
            await this.validateAddLiterature(collectionId, literatureIds);

            // 3. 执行添加
            await this.collectionRepo.addLiterature(collectionId, literatureIds);

            // 4. 后处理
            await this.postAddLiterature(collectionId, literatureIds);

        } catch (error) {
            throw handleError(error, 'Failed to add literature to collection');
        }
    }

    /**
     * 📚 从集合移除文献
     */
    async removeLiteratureFromCollection(
        collectionId: string,
        literatureIds: string[],
        userId: string
    ): Promise<void> {
        try {
            // 1. 权限验证
            await this.validateCollectionAccess(collectionId, userId, 'write');

            // 2. 执行移除
            await this.collectionRepo.removeLiterature(collectionId, literatureIds);

            // 3. 后处理
            await this.postRemoveLiterature(collectionId, literatureIds);

        } catch (error) {
            throw handleError(error, 'Failed to remove literature from collection');
        }
    }

    // ==================== 智能集合操作 ====================

    /**
     * 🤖 执行智能集合规则
     */
    async executeSmartCollection(collectionId: string): Promise<SmartCollectionResult> {
        try {
            const collection = await this.collectionRepo.findById(collectionId);
            if (!collection) {
                throw new CollectionBusinessError(
                    'Collection not found',
                    'NOT_FOUND'
                );
            }

            if (collection.type !== 'smart' || !collection.smartRule) {
                throw new CollectionBusinessError(
                    'Collection is not a smart collection',
                    'INVALID_TYPE'
                );
            }

            const startTime = Date.now();

            // 执行智能规则
            const matchedItems = await this.executeSmartRule(collection.smartRule);

            // 计算变更
            const currentItems = new Set(collection.literatureIds);
            const newItems = new Set(matchedItems);

            const addedItems = matchedItems.filter(id => !currentItems.has(id));
            const removedItems = collection.literatureIds.filter(id => !newItems.has(id));

            // 更新集合
            if (addedItems.length > 0 || removedItems.length > 0) {
                await this.collectionRepo.update(collectionId, {
                    literatureIds: matchedItems,
                    updatedAt: new Date(),
                });
            }

            return {
                collectionId,
                matchedItems,
                addedItems,
                removedItems,
                totalMatched: matchedItems.length,
                executedAt: new Date(),
                executionTime: Date.now() - startTime,
            };

        } catch (error) {
            throw handleError(error, 'Failed to execute smart collection');
        }
    }

    // ==================== 业务规则验证 ====================

    private async validateCreateCollection(
        userId: string,
        input: CreateCollectionInput
    ): Promise<void> {
        // 验证名称长度
        if (input.name.length > BUSINESS_RULES.MAX_COLLECTION_NAME_LENGTH) {
            throw new CollectionBusinessError(
                `Collection name too long (max ${BUSINESS_RULES.MAX_COLLECTION_NAME_LENGTH} characters)`,
                'NAME_TOO_LONG'
            );
        }

        // 验证描述长度
        if (input.description && input.description.length > BUSINESS_RULES.MAX_DESCRIPTION_LENGTH) {
            throw new CollectionBusinessError(
                `Description too long (max ${BUSINESS_RULES.MAX_DESCRIPTION_LENGTH} characters)`,
                'DESCRIPTION_TOO_LONG'
            );
        }

        // 验证用户集合数量限制
        const userCollections = await this.collectionRepo.searchWithFilters(
            { ownerId: userId },
            { field: 'createdAt', order: 'desc' },
            1,
            1
        );

        if (userCollections.total >= BUSINESS_RULES.MAX_COLLECTIONS_PER_USER) {
            throw new CollectionBusinessError(
                `Maximum collections limit reached (${BUSINESS_RULES.MAX_COLLECTIONS_PER_USER})`,
                'MAX_COLLECTIONS_EXCEEDED'
            );
        }

        // 验证层次深度
        if (input.parentId) {
            const parentDepth = await this.getCollectionDepth(input.parentId);
            if (parentDepth >= BUSINESS_RULES.MAX_NESTING_DEPTH) {
                throw new CollectionBusinessError(
                    `Maximum nesting depth exceeded (max ${BUSINESS_RULES.MAX_NESTING_DEPTH})`,
                    'MAX_DEPTH_EXCEEDED'
                );
            }
        }
    }

    private async validateUpdateCollection(
        collectionId: string,
        updates: UpdateCollectionInput
    ): Promise<void> {
        // 验证名称长度
        if (updates.name && updates.name.length > BUSINESS_RULES.MAX_COLLECTION_NAME_LENGTH) {
            throw new CollectionBusinessError(
                `Collection name too long (max ${BUSINESS_RULES.MAX_COLLECTION_NAME_LENGTH} characters)`,
                'NAME_TOO_LONG'
            );
        }

        // 验证描述长度
        if (updates.description && updates.description.length > BUSINESS_RULES.MAX_DESCRIPTION_LENGTH) {
            throw new CollectionBusinessError(
                `Description too long (max ${BUSINESS_RULES.MAX_DESCRIPTION_LENGTH} characters)`,
                'DESCRIPTION_TOO_LONG'
            );
        }

        // 验证层次结构变更
        if (updates.parentId !== undefined) {
            await this.validateHierarchyChange(collectionId, updates.parentId);
        }
    }

    private async validateDeleteCollection(collectionId: string): Promise<void> {
        const collection = await this.collectionRepo.findById(collectionId);
        if (!collection) {
            throw new CollectionBusinessError(
                'Collection not found',
                'NOT_FOUND'
            );
        }

        // 检查是否有子集合
        if (collection.childIds.length > 0) {
            throw new CollectionBusinessError(
                'Cannot delete collection with child collections',
                'HAS_CHILDREN'
            );
        }
    }

    private async validateAddLiterature(
        collectionId: string,
        literatureIds: string[]
    ): Promise<void> {
        const collection = await this.collectionRepo.findById(collectionId);
        if (!collection) {
            throw new CollectionBusinessError(
                'Collection not found',
                'NOT_FOUND'
            );
        }

        // 验证文献数量限制
        const totalItems = collection.literatureIds.length + literatureIds.length;
        if (totalItems > BUSINESS_RULES.MAX_LITERATURE_PER_COLLECTION) {
            throw new CollectionBusinessError(
                `Maximum literature limit exceeded (max ${BUSINESS_RULES.MAX_LITERATURE_PER_COLLECTION})`,
                'MAX_LITERATURE_EXCEEDED'
            );
        }

        // 验证文献是否存在
        const existingLiterature = await this.literatureRepo.findByIds(literatureIds);
        const existingIds = new Set(existingLiterature.map(item => item.id));
        const missingIds = literatureIds.filter(id => !existingIds.has(id));

        if (missingIds.length > 0) {
            throw new CollectionBusinessError(
                `Literature items not found: ${missingIds.join(', ')}`,
                'LITERATURE_NOT_FOUND',
                { missingIds }
            );
        }
    }

    private async validateCollectionAccess(
        collectionId: string,
        userId: string,
        permission: 'read' | 'write' | 'delete'
    ): Promise<void> {
        const collection = await this.collectionRepo.findById(collectionId);
        if (!collection) {
            throw new CollectionBusinessError(
                'Collection not found',
                'NOT_FOUND'
            );
        }

        // 所有者有全部权限
        if (collection.ownerId === userId) {
            return;
        }

        // 公开集合的读权限
        if (permission === 'read' && collection.isPublic) {
            return;
        }

        // 其他情况拒绝访问
        throw new CollectionBusinessError(
            'Access denied',
            'ACCESS_DENIED'
        );
    }

    // ==================== 辅助方法 ====================

    private async preprocessCreateInput(
        userId: string,
        input: CreateCollectionInput
    ): Promise<CreateCollectionInput> {
        const processed = { ...input };

        // 设置所有者
        processed.ownerId = userId;

        // 处理层次结构
        if (processed.parentId) {
            const parent = await this.collectionRepo.findById(processed.parentId);
            if (parent) {
                // 自动添加到父集合的子列表中会在Repository层处理
            }
        }

        return processed;
    }

    private async preprocessUpdateInput(
        collectionId: string,
        updates: UpdateCollectionInput
    ): Promise<UpdateCollectionInput> {
        const processed = { ...updates };

        // 添加更新时间
        processed.updatedAt = new Date();

        return processed;
    }

    private async postCreateCollection(collection: Collection): Promise<void> {
        // 如果是智能集合，立即执行一次规则
        if (collection.type === 'smart' && collection.smartRule) {
            try {
                await this.executeSmartCollection(collection.id);
            } catch (error) {
                console.warn(`Failed to execute smart collection on creation: ${error}`);
            }
        }
    }

    private async postUpdateCollection(
        collection: Collection,
        updates: UpdateCollectionInput
    ): Promise<void> {
        // 如果更新了智能规则，重新执行
        if (updates.smartRule && collection.type === 'smart') {
            try {
                await this.executeSmartCollection(collection.id);
            } catch (error) {
                console.warn(`Failed to execute smart collection after update: ${error}`);
            }
        }
    }

    private async preDeleteCollection(collectionId: string): Promise<void> {
        const collection = await this.collectionRepo.findById(collectionId);
        if (!collection) return;

        // 从父集合的子列表中移除
        if (collection.parentId) {
            try {
                const parent = await this.collectionRepo.findById(collection.parentId);
                if (parent) {
                    const updatedChildIds = parent.childIds.filter(id => id !== collectionId);
                    await this.collectionRepo.update(collection.parentId, {
                        childIds: updatedChildIds,
                    });
                }
            } catch (error) {
                console.warn(`Failed to update parent collection: ${error}`);
            }
        }
    }

    private async postAddLiterature(
        collectionId: string,
        literatureIds: string[]
    ): Promise<void> {
        // 可以在这里添加后处理逻辑，比如发送通知等
    }

    private async postRemoveLiterature(
        collectionId: string,
        literatureIds: string[]
    ): Promise<void> {
        // 可以在这里添加后处理逻辑
    }

    private async executeSmartRule(rule: SmartCollectionRule): Promise<string[]> {
        // 这里应该实现智能规则的执行逻辑
        // 目前返回空数组，实际实现需要根据规则查询文献
        return [];
    }

    private async getCollectionDepth(collectionId: string): Promise<number> {
        let depth = 0;
        let currentId: string | null = collectionId;

        while (currentId && depth < BUSINESS_RULES.MAX_NESTING_DEPTH) {
            const collection = await this.collectionRepo.findById(currentId);
            if (!collection) break;

            depth++;
            currentId = collection.parentId || null;
        }

        return depth;
    }

    private async validateHierarchyChange(
        collectionId: string,
        newParentId: string | null
    ): Promise<void> {
        if (!newParentId) return;

        // 防止循环引用
        if (await this.wouldCreateCycle(collectionId, newParentId)) {
            throw new CollectionBusinessError(
                'Cannot create circular hierarchy',
                'CIRCULAR_HIERARCHY'
            );
        }

        // 验证深度限制
        const newDepth = await this.getCollectionDepth(newParentId) + 1;
        if (newDepth > BUSINESS_RULES.MAX_NESTING_DEPTH) {
            throw new CollectionBusinessError(
                `Maximum nesting depth exceeded (max ${BUSINESS_RULES.MAX_NESTING_DEPTH})`,
                'MAX_DEPTH_EXCEEDED'
            );
        }
    }

    private async wouldCreateCycle(
        collectionId: string,
        potentialParentId: string
    ): Promise<boolean> {
        let currentId: string | null = potentialParentId;
        const visited = new Set<string>();

        while (currentId && !visited.has(currentId)) {
            if (currentId === collectionId) {
                return true; // 发现循环
            }

            visited.add(currentId);
            const collection = await this.collectionRepo.findById(currentId);
            currentId = collection?.parentId || null;
        }

        return false;
    }
}

// ==================== 导出 ====================

export const collectionService = new CollectionService();
