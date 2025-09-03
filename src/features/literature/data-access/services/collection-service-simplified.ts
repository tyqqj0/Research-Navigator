/**
 * 📂 Collection Service - 简化版集合服务
 * 
 * 新架构: 轻量化集合管理，专注用户体验
 * 核心功能: 集合CRUD、智能分类、快速访问
 */

import { literatureDomainRepositories } from '../repositories';
import { Collection, CollectionType, LibraryItem } from '../types';

/**
 * 📂 简化版 Collection Service
 * 
 * 设计原则：
 * 1. 集合管理完全本地化
 * 2. 支持多种集合类型
 * 3. 智能标签和自动分类
 * 4. 快速搜索和过滤
 */
export class SimplifiedCollectionService {
  constructor(
    private readonly collectionRepo = literatureDomainRepositories.collection,
    private readonly literatureRepo = literatureDomainRepositories.literature
  ) {}

  // ==================== 集合基础操作 ====================

  /**
   * ➕ 创建新集合
   */
  async createCollection(
    userId: string,
    data: {
      name: string;
      description?: string;
      type: CollectionType;
      isPublic?: boolean;
      tags?: string[];
      parentId?: string;
    }
  ): Promise<Collection> {
    try {
      console.log(`[CollectionService] Creating collection: ${data.name}`);

      // 检查名称重复
      const existing = await this.collectionRepo.findByUserAndName(userId, data.name);
      if (existing) {
        throw new Error('Collection with this name already exists');
      }

      // 创建集合
      const collection = await this.collectionRepo.create({
        id: `col_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        name: data.name,
        description: data.description || '',
        type: data.type,
        literatureIds: [],
        metadata: {
          isPublic: data.isPublic || false,
          tags: data.tags || [],
          parentId: data.parentId,
          childIds: [],
          itemCount: 0,
          lastModified: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // 如果有父集合，更新父集合的子集合列表
      if (data.parentId) {
        await this.addChildCollection(data.parentId, collection.id);
      }

      console.log(`[CollectionService] Collection created: ${collection.id}`);
      return collection;

    } catch (error) {
      console.error('[CollectionService] Create collection failed:', error);
      throw error;
    }
  }

  /**
   * 📝 更新集合信息
   */
  async updateCollection(
    collectionId: string,
    updates: {
      name?: string;
      description?: string;
      isPublic?: boolean;
      tags?: string[];
    }
  ): Promise<Collection> {
    try {
      console.log(`[CollectionService] Updating collection: ${collectionId}`);

      const existing = await this.collectionRepo.findById(collectionId);
      if (!existing) {
        throw new Error('Collection not found');
      }

      // 检查名称重复（如果更改了名称）
      if (updates.name && updates.name !== existing.name) {
        const duplicate = await this.collectionRepo.findByUserAndName(existing.userId, updates.name);
        if (duplicate) {
          throw new Error('Collection with this name already exists');
        }
      }

      // 更新集合
      const updated = await this.collectionRepo.update(collectionId, {
        name: updates.name || existing.name,
        description: updates.description ?? existing.description,
        metadata: {
          ...existing.metadata,
          isPublic: updates.isPublic ?? existing.metadata.isPublic,
          tags: updates.tags || existing.metadata.tags,
          lastModified: new Date()
        },
        updatedAt: new Date()
      });

      return updated!;

    } catch (error) {
      console.error('[CollectionService] Update collection failed:', error);
      throw error;
    }
  }

  /**
   * 🗑️ 删除集合
   */
  async deleteCollection(collectionId: string, userId: string): Promise<void> {
    try {
      console.log(`[CollectionService] Deleting collection: ${collectionId}`);

      const collection = await this.collectionRepo.findById(collectionId);
      if (!collection) {
        throw new Error('Collection not found');
      }

      if (collection.userId !== userId) {
        throw new Error('Permission denied: not the owner of this collection');
      }

      // 删除所有子集合
      const childIds = collection.metadata.childIds || [];
      for (const childId of childIds) {
        await this.deleteCollection(childId, userId);
      }

      // 从父集合中移除引用
      if (collection.metadata.parentId) {
        await this.removeChildCollection(collection.metadata.parentId, collectionId);
      }

      // 删除集合
      await this.collectionRepo.delete(collectionId);

      console.log(`[CollectionService] Collection deleted: ${collectionId}`);

    } catch (error) {
      console.error('[CollectionService] Delete collection failed:', error);
      throw error;
    }
  }

  // ==================== 文献管理 ====================

  /**
   * ➕ 添加文献到集合
   */
  async addLiteratureToCollection(
    collectionId: string,
    literatureIds: string[]
  ): Promise<Collection> {
    try {
      console.log(`[CollectionService] Adding ${literatureIds.length} literature to collection: ${collectionId}`);

      const collection = await this.collectionRepo.findById(collectionId);
      if (!collection) {
        throw new Error('Collection not found');
      }

      // 验证文献是否存在
      const validLiteratureIds: string[] = [];
      for (const literatureId of literatureIds) {
        const literature = await this.literatureRepo.findById(literatureId);
        if (literature) {
          validLiteratureIds.push(literatureId);
        } else {
          console.warn(`[CollectionService] Literature not found: ${literatureId}`);
        }
      }

      // 合并文献ID（去重）
      const currentIds = new Set(collection.literatureIds);
      validLiteratureIds.forEach(id => currentIds.add(id));
      const newLiteratureIds = Array.from(currentIds);

      // 更新集合
      const updated = await this.collectionRepo.update(collectionId, {
        literatureIds: newLiteratureIds,
        metadata: {
          ...collection.metadata,
          itemCount: newLiteratureIds.length,
          lastModified: new Date()
        },
        updatedAt: new Date()
      });

      console.log(`[CollectionService] Added literature to collection, new count: ${newLiteratureIds.length}`);
      return updated!;

    } catch (error) {
      console.error('[CollectionService] Add literature to collection failed:', error);
      throw error;
    }
  }

  /**
   * ➖ 从集合中移除文献
   */
  async removeLiteratureFromCollection(
    collectionId: string,
    literatureIds: string[]
  ): Promise<Collection> {
    try {
      console.log(`[CollectionService] Removing ${literatureIds.length} literature from collection: ${collectionId}`);

      const collection = await this.collectionRepo.findById(collectionId);
      if (!collection) {
        throw new Error('Collection not found');
      }

      // 移除指定的文献ID
      const removeSet = new Set(literatureIds);
      const newLiteratureIds = collection.literatureIds.filter(id => !removeSet.has(id));

      // 更新集合
      const updated = await this.collectionRepo.update(collectionId, {
        literatureIds: newLiteratureIds,
        metadata: {
          ...collection.metadata,
          itemCount: newLiteratureIds.length,
          lastModified: new Date()
        },
        updatedAt: new Date()
      });

      console.log(`[CollectionService] Removed literature from collection, new count: ${newLiteratureIds.length}`);
      return updated!;

    } catch (error) {
      console.error('[CollectionService] Remove literature from collection failed:', error);
      throw error;
    }
  }

  /**
   * 📚 获取集合中的文献
   */
  async getCollectionLiterature(
    collectionId: string,
    options: {
      page?: number;
      pageSize?: number;
      sortBy?: 'title' | 'year' | 'addedAt' | 'relevance';
      sortOrder?: 'asc' | 'desc';
      filters?: {
        authors?: string[];
        yearRange?: { start: number; end: number };
        topics?: string[];
      };
    } = {}
  ): Promise<{
    literature: LibraryItem[];
    pagination: {
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
    collection: Collection;
  }> {
    try {
      console.log(`[CollectionService] Getting literature for collection: ${collectionId}`);

      const collection = await this.collectionRepo.findById(collectionId);
      if (!collection) {
        throw new Error('Collection not found');
      }

      // 获取所有文献
      const allLiterature = await Promise.all(
        collection.literatureIds.map(id => this.literatureRepo.findById(id))
      );
      
      // 过滤掉不存在的文献
      let validLiterature = allLiterature.filter(Boolean) as LibraryItem[];

      // 应用过滤器
      if (options.filters) {
        validLiterature = this.applyLiteratureFilters(validLiterature, options.filters);
      }

      // 排序
      validLiterature = this.sortLiterature(validLiterature, options.sortBy, options.sortOrder);

      // 分页
      const page = options.page || 1;
      const pageSize = options.pageSize || 20;
      const totalPages = Math.ceil(validLiterature.length / pageSize);
      const startIndex = (page - 1) * pageSize;
      const paginatedLiterature = validLiterature.slice(startIndex, startIndex + pageSize);

      return {
        literature: paginatedLiterature,
        pagination: {
          total: validLiterature.length,
          page,
          pageSize,
          totalPages
        },
        collection
      };

    } catch (error) {
      console.error('[CollectionService] Get collection literature failed:', error);
      throw error;
    }
  }

  // ==================== 集合查询 ====================

  /**
   * 📋 获取用户的所有集合
   */
  async getUserCollections(
    userId: string,
    options: {
      type?: CollectionType;
      includeEmpty?: boolean;
      sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'itemCount';
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<Collection[]> {
    try {
      console.log(`[CollectionService] Getting collections for user: ${userId}`);

      let collections = await this.collectionRepo.findByUserId(userId);

      // 按类型过滤
      if (options.type) {
        collections = collections.filter(col => col.type === options.type);
      }

      // 是否包含空集合
      if (!options.includeEmpty) {
        collections = collections.filter(col => col.literatureIds.length > 0);
      }

      // 排序
      collections = this.sortCollections(collections, options.sortBy, options.sortOrder);

      return collections;

    } catch (error) {
      console.error('[CollectionService] Get user collections failed:', error);
      throw error;
    }
  }

  /**
   * 🔍 搜索集合
   */
  async searchCollections(
    userId: string,
    query: string,
    options: {
      type?: CollectionType;
      includePublic?: boolean;
    } = {}
  ): Promise<Collection[]> {
    try {
      console.log(`[CollectionService] Searching collections: "${query}"`);

      let collections = await this.collectionRepo.findByUserId(userId);

      // 包含公共集合
      if (options.includePublic) {
        const publicCollections = await this.collectionRepo.findPublicCollections();
        collections = [...collections, ...publicCollections.filter(col => col.userId !== userId)];
      }

      // 按类型过滤
      if (options.type) {
        collections = collections.filter(col => col.type === options.type);
      }

      // 文本搜索
      const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
      collections = collections.filter(collection => {
        const searchText = `${collection.name} ${collection.description} ${collection.metadata.tags?.join(' ')}`.toLowerCase();
        return searchTerms.some(term => searchText.includes(term));
      });

      return collections;

    } catch (error) {
      console.error('[CollectionService] Search collections failed:', error);
      throw error;
    }
  }

  /**
   * 🌳 获取集合层次结构
   */
  async getCollectionHierarchy(userId: string): Promise<Array<{
    collection: Collection;
    children: Array<{ collection: Collection; children: any[] }>;
    depth: number;
  }>> {
    try {
      console.log(`[CollectionService] Getting collection hierarchy for user: ${userId}`);

      const allCollections = await this.collectionRepo.findByUserId(userId);
      const collectionMap = new Map(allCollections.map(col => [col.id, col]));

      // 找到根集合（没有父集合的）
      const rootCollections = allCollections.filter(col => !col.metadata.parentId);

      // 构建层次结构
      const buildHierarchy = (collection: Collection, depth: number = 0): any => {
        const childIds = collection.metadata.childIds || [];
        const children = childIds
          .map(childId => collectionMap.get(childId))
          .filter(Boolean)
          .map(child => buildHierarchy(child!, depth + 1));

        return {
          collection,
          children,
          depth
        };
      };

      return rootCollections.map(root => buildHierarchy(root));

    } catch (error) {
      console.error('[CollectionService] Get collection hierarchy failed:', error);
      throw error;
    }
  }

  // ==================== 智能功能 ====================

  /**
   * 🤖 自动创建智能集合
   */
  async createSmartCollection(
    userId: string,
    criteria: {
      name: string;
      description?: string;
      rules: Array<{
        field: 'title' | 'authors' | 'year' | 'topics' | 'tags';
        operator: 'contains' | 'equals' | 'greater_than' | 'less_than' | 'in_range';
        value: any;
      }>;
      autoUpdate?: boolean;
    }
  ): Promise<Collection> {
    try {
      console.log(`[CollectionService] Creating smart collection: ${criteria.name}`);

      // 执行智能查询
      const matchingLiterature = await this.executeSmartQuery(userId, criteria.rules);
      const literatureIds = matchingLiterature.map(lit => lit.id);

      // 创建智能集合
      const collection = await this.createCollection(userId, {
        name: criteria.name,
        description: criteria.description,
        type: 'smart',
        tags: ['auto-generated', 'smart-collection']
      });

      // 添加文献到集合
      await this.addLiteratureToCollection(collection.id, literatureIds);

      // 保存智能规则
      await this.collectionRepo.update(collection.id, {
        metadata: {
          ...collection.metadata,
          smartRules: criteria.rules,
          autoUpdate: criteria.autoUpdate || false,
          lastAutoUpdate: new Date()
        }
      });

      console.log(`[CollectionService] Smart collection created with ${literatureIds.length} items`);
      return (await this.collectionRepo.findById(collection.id))!;

    } catch (error) {
      console.error('[CollectionService] Create smart collection failed:', error);
      throw error;
    }
  }

  /**
   * 🔄 更新智能集合
   */
  async updateSmartCollections(userId: string): Promise<{
    updated: string[];
    errors: string[];
  }> {
    try {
      console.log(`[CollectionService] Updating smart collections for user: ${userId}`);

      const collections = await this.collectionRepo.findByUserId(userId);
      const smartCollections = collections.filter(col => 
        col.type === 'smart' && 
        col.metadata.smartRules && 
        col.metadata.autoUpdate
      );

      const updated: string[] = [];
      const errors: string[] = [];

      for (const collection of smartCollections) {
        try {
          const matchingLiterature = await this.executeSmartQuery(userId, collection.metadata.smartRules);
          const newLiteratureIds = matchingLiterature.map(lit => lit.id);

          // 更新集合内容
          await this.collectionRepo.update(collection.id, {
            literatureIds: newLiteratureIds,
            metadata: {
              ...collection.metadata,
              itemCount: newLiteratureIds.length,
              lastAutoUpdate: new Date(),
              lastModified: new Date()
            }
          });

          updated.push(collection.id);

        } catch (error) {
          console.error(`[CollectionService] Failed to update smart collection ${collection.id}:`, error);
          errors.push(`${collection.name}: ${error}`);
        }
      }

      console.log(`[CollectionService] Updated ${updated.length} smart collections`);
      return { updated, errors };

    } catch (error) {
      console.error('[CollectionService] Update smart collections failed:', error);
      throw error;
    }
  }

  // ==================== 私有工具方法 ====================

  /**
   * 👶 添加子集合
   */
  private async addChildCollection(parentId: string, childId: string): Promise<void> {
    const parent = await this.collectionRepo.findById(parentId);
    if (parent) {
      const childIds = parent.metadata.childIds || [];
      if (!childIds.includes(childId)) {
        childIds.push(childId);
        await this.collectionRepo.update(parentId, {
          metadata: {
            ...parent.metadata,
            childIds,
            lastModified: new Date()
          }
        });
      }
    }
  }

  /**
   * 🗑️ 移除子集合
   */
  private async removeChildCollection(parentId: string, childId: string): Promise<void> {
    const parent = await this.collectionRepo.findById(parentId);
    if (parent) {
      const childIds = (parent.metadata.childIds || []).filter(id => id !== childId);
      await this.collectionRepo.update(parentId, {
        metadata: {
          ...parent.metadata,
          childIds,
          lastModified: new Date()
        }
      });
    }
  }

  /**
   * 🔍 应用文献过滤器
   */
  private applyLiteratureFilters(
    literature: LibraryItem[],
    filters: {
      authors?: string[];
      yearRange?: { start: number; end: number };
      topics?: string[];
    }
  ): LibraryItem[] {
    let filtered = literature;

    // 按作者过滤
    if (filters.authors && filters.authors.length > 0) {
      filtered = filtered.filter(lit =>
        filters.authors!.some(author =>
          lit.authors.some(litAuthor =>
            litAuthor.toLowerCase().includes(author.toLowerCase())
          )
        )
      );
    }

    // 按年份范围过滤
    if (filters.yearRange) {
      filtered = filtered.filter(lit =>
        lit.year && 
        lit.year >= filters.yearRange!.start &&
        lit.year <= filters.yearRange!.end
      );
    }

    // 按主题过滤
    if (filters.topics && filters.topics.length > 0) {
      filtered = filtered.filter(lit =>
        filters.topics!.some(topic =>
          lit.topics?.some(litTopic =>
            litTopic.toLowerCase().includes(topic.toLowerCase())
          )
        )
      );
    }

    return filtered;
  }

  /**
   * 📊 排序文献
   */
  private sortLiterature(
    literature: LibraryItem[],
    sortBy?: 'title' | 'year' | 'addedAt' | 'relevance',
    sortOrder?: 'asc' | 'desc'
  ): LibraryItem[] {
    if (!sortBy) return literature;

    const order = sortOrder === 'desc' ? -1 : 1;

    return literature.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return order * a.title.localeCompare(b.title);
        case 'year':
          return order * ((a.year || 0) - (b.year || 0));
        case 'addedAt':
          return order * (a.createdAt.getTime() - b.createdAt.getTime());
        default:
          return 0;
      }
    });
  }

  /**
   * 📊 排序集合
   */
  private sortCollections(
    collections: Collection[],
    sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'itemCount',
    sortOrder?: 'asc' | 'desc'
  ): Collection[] {
    if (!sortBy) return collections;

    const order = sortOrder === 'desc' ? -1 : 1;

    return collections.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return order * a.name.localeCompare(b.name);
        case 'createdAt':
          return order * (a.createdAt.getTime() - b.createdAt.getTime());
        case 'updatedAt':
          return order * (a.updatedAt.getTime() - b.updatedAt.getTime());
        case 'itemCount':
          return order * (a.literatureIds.length - b.literatureIds.length);
        default:
          return 0;
      }
    });
  }

  /**
   * 🤖 执行智能查询
   */
  private async executeSmartQuery(
    userId: string,
    rules: Array<{
      field: 'title' | 'authors' | 'year' | 'topics' | 'tags';
      operator: 'contains' | 'equals' | 'greater_than' | 'less_than' | 'in_range';
      value: any;
    }>
  ): Promise<LibraryItem[]> {
    // 获取用户可访问的所有文献
    const allLiterature = await this.literatureRepo.findAll();

    // 应用智能规则
    return allLiterature.filter(literature => {
      return rules.every(rule => {
        switch (rule.field) {
          case 'title':
            return this.applyStringRule(literature.title, rule.operator, rule.value);
          case 'authors':
            return literature.authors.some(author => 
              this.applyStringRule(author, rule.operator, rule.value)
            );
          case 'year':
            return this.applyNumberRule(literature.year || 0, rule.operator, rule.value);
          case 'topics':
            return literature.topics?.some(topic =>
              this.applyStringRule(topic, rule.operator, rule.value)
            ) || false;
          default:
            return true;
        }
      });
    });
  }

  /**
   * 🔤 应用字符串规则
   */
  private applyStringRule(value: string, operator: string, ruleValue: any): boolean {
    switch (operator) {
      case 'contains':
        return value.toLowerCase().includes(ruleValue.toLowerCase());
      case 'equals':
        return value.toLowerCase() === ruleValue.toLowerCase();
      default:
        return false;
    }
  }

  /**
   * 🔢 应用数字规则
   */
  private applyNumberRule(value: number, operator: string, ruleValue: any): boolean {
    switch (operator) {
      case 'equals':
        return value === ruleValue;
      case 'greater_than':
        return value > ruleValue;
      case 'less_than':
        return value < ruleValue;
      case 'in_range':
        return value >= ruleValue.start && value <= ruleValue.end;
      default:
        return false;
    }
  }
}

// 🏪 单例服务实例
export const simplifiedCollectionService = new SimplifiedCollectionService();

