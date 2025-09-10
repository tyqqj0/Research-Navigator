/**
 * 🏗️ Base Repository - 基础仓储抽象类
 * 
 * 设计模式: Repository Pattern
 * 职责: 提供通用的CRUD操作接口和实现
 */

import { literatureDB } from '../database';
import type { Table } from 'dexie';

/**
 * 🎯 基础仓储接口
 */
export interface IBaseRepository<T, K> {
    findById(id: K): Promise<T | null>;
    findAll(): Promise<T[]>;
    create(entity: Omit<T, keyof { id: K }>): Promise<K>;
    update(id: K, updates: Partial<T>): Promise<void>;
    delete(id: K): Promise<void>;
    bulkCreate(entities: Omit<T, keyof { id: K }>[]): Promise<K[]>;
    bulkDelete(ids: K[]): Promise<void>;
    count(): Promise<number>;
    exists(id: K): Promise<boolean>;
}

/**
 * 🏗️ 基础仓储实现
 */
export abstract class BaseRepository<T extends { id: K }, K> implements IBaseRepository<T, K> {
    protected abstract table: Table<T, K>;
    protected abstract generateId(): K;

    /**
     * 🔍 根据ID查找单个实体
     */
    async findById(id: K): Promise<T | null> {
        try {
            const entity = await this.table.get(id);
            return entity || null;
        } catch (error) {
            console.error(`[${this.constructor.name}] findById failed:`, error);
            throw new Error(`Failed to find entity by id: ${id}`);
        }
    }

    /**
     * 📋 查找所有实体
     */
    async findAll(): Promise<T[]> {
        try {
            return await this.table.toArray();
        } catch (error) {
            console.error(`[${this.constructor.name}] findAll failed:`, error);
            throw new Error('Failed to fetch all entities');
        }
    }

    /**
     * ➕ 创建新实体
     */
    async create(entityData: Omit<T, keyof { id: K }>): Promise<K> {
        try {
            const id = this.generateId();
            const entity = {
                ...entityData,
                id
            } as T;

            await this.table.add(entity);
            return id;
        } catch (error) {
            console.error(`[${this.constructor.name}] create failed:`, error);
            throw new Error('Failed to create entity');
        }
    }

    /**
     * 📝 更新实体
     */
    async update(id: K, updates: Partial<T>): Promise<void> {
        try {
            const existingEntity = await this.findById(id);
            if (!existingEntity) {
                throw new Error(`Entity with id ${id} not found`);
            }

            // 合并更新数据
            const updateData = {
                ...updates,
                updatedAt: new Date()
            } as any;

            await this.table.update(id, updateData);
        } catch (error) {
            console.error(`[${this.constructor.name}] update failed:`, error);
            throw new Error(`Failed to update entity: ${id}`);
        }
    }

    /**
 * 🗑️ 删除实体
 */
    async delete(id: K): Promise<void> {
        try {
            // 使用主键删除，避免依赖'id'索引名称
            await this.table.delete(id);
        } catch (error) {
            console.error(`[${this.constructor.name}] delete failed:`, error);
            throw new Error(`Failed to delete entity: ${id}`);
        }
    }

    /**
     * 📦 批量创建
     */
    async bulkCreate(entitiesData: Omit<T, keyof { id: K }>[]): Promise<K[]> {
        try {
            const entities = entitiesData.map(data => ({
                ...data,
                id: this.generateId()
            })) as T[];

            await this.table.bulkAdd(entities);
            return entities.map(entity => entity.id);
        } catch (error) {
            console.error(`[${this.constructor.name}] bulkCreate failed:`, error);
            throw new Error('Failed to bulk create entities');
        }
    }

    /**
     * 🗑️ 批量删除
     */
    async bulkDelete(ids: K[]): Promise<void> {
        try {
            await this.table.bulkDelete(ids);
        } catch (error) {
            console.error(`[${this.constructor.name}] bulkDelete failed:`, error);
            throw new Error('Failed to bulk delete entities');
        }
    }

    /**
     * 📊 统计数量
     */
    async count(): Promise<number> {
        try {
            return await this.table.count();
        } catch (error) {
            console.error(`[${this.constructor.name}] count failed:`, error);
            return 0;
        }
    }

    /**
     * ❓ 检查实体是否存在
     */
    async exists(id: K): Promise<boolean> {
        try {
            const entity = await this.table.get(id);
            return !!entity;
        } catch (error) {
            console.error(`[${this.constructor.name}] exists failed:`, error);
            return false;
        }
    }

    /**
     * 🔍 分页查询基础实现
     */
    protected async paginate(
        query: any,
        page: number = 1,
        pageSize: number = 20
    ): Promise<{
        items: T[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    }> {
        try {
            const offset = (page - 1) * pageSize;

            const [items, total] = await Promise.all([
                query.offset(offset).limit(pageSize).toArray(),
                query.count()
            ]);

            return {
                items,
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize)
            };
        } catch (error) {
            console.error(`[${this.constructor.name}] paginate failed:`, error);
            throw new Error('Failed to paginate results');
        }
    }

    /**
     * 🔧 获取数据库连接
     */
    protected get db() {
        return literatureDB;
    }
}

/**
 * 🎯 查询构建器基础类
 */
export abstract class QueryBuilder<T> {
    protected query: any;

    constructor(protected table: Table<T, any>) {
        this.query = table.toCollection();
    }

    /**
     * 🔍 添加过滤条件
     */
    where(field: keyof T, value: any): this {
        this.query = this.table.where(field as string).equals(value);
        return this;
    }

    /**
     * 🔍 添加多值过滤
     */
    whereIn(field: keyof T, values: any[]): this {
        this.query = this.table.where(field as string).anyOf(values);
        return this;
    }

    /**
     * 📈 排序
     */
    orderBy(field: keyof T, direction: 'asc' | 'desc' = 'asc'): this {
        if (direction === 'desc') {
            this.query = this.query.reverse();
        }
        this.query = this.query.sortBy(field as string);
        return this;
    }

    /**
     * 📄 限制数量
     */
    limit(count: number): this {
        this.query = this.query.limit(count);
        return this;
    }

    /**
     * ⏭️ 跳过数量
     */
    offset(count: number): this {
        this.query = this.query.offset(count);
        return this;
    }

    /**
     * 🎯 执行查询
     */
    async execute(): Promise<T[]> {
        return await this.query.toArray();
    }

    /**
     * 📊 统计数量
     */
    async count(): Promise<number> {
        return await this.query.count();
    }
}
