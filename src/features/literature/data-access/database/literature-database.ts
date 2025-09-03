/**
 * 📚 Literature Database - 文献数据库配置
 * 
 * 迁移自: old/src/libs/db/index.ts
 * 优化: 现代化Dexie配置，保持版本迁移兼容性
 */

import Dexie, { Table } from 'dexie';
import {
    LibraryItem,
    ExtendedLibraryItem,
    UserLiteratureMeta,
    Citation,
    Collection
} from '../types';

// 📊 数据库版本历史 - 保持与旧版兼容
const DATABASE_VERSION = 8; // 新增版本，基于旧版最新版本7
const DATABASE_NAME = 'literatureDB';

/**
 * 📚 Literature Database Class
 * 
 * 设计原则:
 * 1. 保持与旧版数据的完全兼容性
 * 2. 支持渐进式数据迁移
 * 3. 现代化的类型定义
 * 4. 高性能索引策略
 */
export class LiteratureDatabase extends Dexie {
    // 📚 核心文献表
    libraries!: Table<ExtendedLibraryItem, string>;

    // 👤 用户元数据表 - 新增分离
    userMetas!: Table<UserLiteratureMeta, string>;

    // 🔗 引文关系表
    citations!: Table<Citation, number>;

    // 📂 文献集合表 - 新增功能
    collections!: Table<Collection, string>;

    constructor() {
        super(DATABASE_NAME);

        // 🔄 版本迁移策略 - 保持与旧版完全兼容
        this.defineVersions();
    }

    /**
     * 🔄 定义数据库版本和迁移策略
     */
    private defineVersions() {
        // ==================== 旧版本保持兼容 ====================

        // Version 1 - 原始版本
        this.version(1).stores({
            library: '++id, title, *authors, year, source, publication, zoteroKey, createdAt',
            literatureTrees: '++id, name, createdAt'
        });

        // Version 2 - 添加引文表
        this.version(2).stores({
            library: '++id, title, *authors, year, source, publication, zoteroKey, doi, url, pdfPath, parsingStatus, createdAt',
            literatureTrees: '++id, name, createdAt',
            citations: '++id, [sourceItemId+targetItemId], sourceItemId, targetItemId'
        }).upgrade(trans => Promise.resolve());

        // Version 3 - 添加任务字段（已废弃）
        this.version(3).stores({
            library: '++id, title, *authors, year, source, publication, zoteroKey, doi, url, pdfPath, mineruTaskId, parsingStatus, createdAt',
            literatureTrees: '++id, name, createdAt',
            citations: '++id, [sourceItemId+targetItemId], sourceItemId, targetItemId'
        }).upgrade(trans => Promise.resolve());

        // Version 4 - 后端集成字段（已废弃）
        this.version(4).stores({
            library: '++id, title, *authors, year, source, publication, zoteroKey, doi, url, pdfPath, mineruTaskId, backendTaskId, backendLiteratureId, parsingStatus, createdAt',
            literatureTrees: '++id, name, createdAt',
            citations: '++id, [sourceItemId+targetItemId], sourceItemId, targetItemId'
        }).upgrade(trans => Promise.resolve());

        // Version 5 - 重构后端架构
        this.version(5).stores({
            library: '++id, title, *authors, year, source, publication, zoteroKey, doi, url, pdfPath, createdAt',
            literatureTrees: '++id, name, createdAt',
            citations: '++id, [sourceItemId+targetItemId], sourceItemId, targetItemId'
        }).upgrade(trans => {
            return trans.table('library').toCollection().modify((item: any) => {
                // 清理旧字段
                delete item.parsingStatus;
                delete item.parsingProgress;
                delete item.mineruTaskId;
                delete item.backendTaskId;
                delete item.backendLiteratureId;
                delete item.backendStatus;
                delete item.parsedContent;

                if (!item.createdAt) {
                    item.createdAt = new Date();
                }
            });
        });

        // Version 6 - 引文管理功能
        this.version(6).stores({
            library: '++id, title, *authors, year, source, publication, zoteroKey, doi, url, pdfPath, createdAt',
            literatureTrees: '++id, name, createdAt',
            citations: '++id, [sourceItemId+targetItemId], sourceItemId, targetItemId'
        }).upgrade(trans => {
            console.log('🔗 Database upgraded to version 6 - Citation management ready');
            return Promise.resolve();
        });

        // Version 7 - 话题管理支持
        this.version(7).stores({
            library: '++id, title, *authors, year, source, publication, zoteroKey, doi, url, pdfPath, *topics, createdAt',
            literatureTrees: '++id, name, createdAt',
            citations: '++id, [sourceItemId+targetItemId], sourceItemId, targetItemId'
        }).upgrade(trans => {
            console.log('🏷️ Database upgraded to version 7 - Topics support added');
            return Promise.resolve();
        });

        // ==================== 新版本架构 ====================

        // Version 8 - 🚀 Feature-First 重构版本
        this.version(8).stores({
            // 📚 重命名为libraries，表示多个文献库
            libraries: '++id, title, *authors, year, source, publication, doi, url, createdAt, updatedAt',

            // 👤 新增用户元数据表 - 核心架构改进
            userMetas: '++id, userId, literatureId, *tags, readingStatus, priority, *associatedSessions, createdAt, updatedAt',

            // 🔗 保持引文表
            citations: '++id, [sourceItemId+targetItemId], sourceItemId, targetItemId, citationType, discoveryMethod, isVerified, createdAt',

            // 📂 新增集合管理表
            collections: '++id, name, type, ownerId, *literatureIds, parentId, isArchived, createdAt, updatedAt',

            // 🌳 保持文献树表（用于research-tree功能）
            literatureTrees: '++id, name, createdAt'
        }).upgrade(async (trans) => {
            console.log('🚀 Database upgrading to version 8 - Feature-First architecture');

            try {
                // 🔄 迁移现有library数据到libraries表
                const oldLibraries = await trans.table('library').toArray();
                console.log(`📦 Migrating ${oldLibraries.length} library items to new schema`);

                for (const oldItem of oldLibraries) {
                    // 🔄 数据结构适配
                    const newItem: Partial<ExtendedLibraryItem> = {
                        id: oldItem.id,
                        title: oldItem.title || 'Untitled',
                        authors: Array.isArray(oldItem.authors) ? oldItem.authors : ['Unknown Author'],
                        year: oldItem.year || new Date().getFullYear(),
                        source: oldItem.source || 'manual',
                        publication: oldItem.publication || null,
                        abstract: oldItem.abstract || null,
                        summary: oldItem.summary || null,
                        doi: oldItem.doi || null,
                        url: oldItem.url || null,
                        pdfPath: oldItem.pdfPath || null,
                        parsedContent: oldItem.parsedContent || undefined,
                        backendTask: oldItem.backendTask || undefined,
                        createdAt: oldItem.createdAt ? new Date(oldItem.createdAt) : new Date(),
                        updatedAt: new Date()
                    };

                    await trans.table('libraries').add(newItem);

                    // 🏷️ 迁移topics到用户元数据
                    if (oldItem.topics && Array.isArray(oldItem.topics) && oldItem.topics.length > 0) {
                        const userMeta: Partial<UserLiteratureMeta> = {
                            id: `meta_${oldItem.id}`,
                            userId: 'default_user', // 单用户模式下的默认用户
                            literatureId: oldItem.id,
                            tags: oldItem.topics,
                            readingStatus: 'unread',
                            associatedSessions: oldItem.associatedSessions || [],
                            createdAt: new Date(),
                            updatedAt: new Date()
                        };

                        await trans.table('userMetas').add(userMeta);
                    }
                }

                // 🗑️ 删除旧library表（已迁移到libraries）
                await trans.table('library').clear();

                console.log('✅ Database migration to version 8 completed successfully');

            } catch (error) {
                console.error('❌ Database migration to version 8 failed:', error);
                throw error;
            }
        });
    }

    /**
     * 🔍 数据库健康检查
     */
    async healthCheck(): Promise<{
        isHealthy: boolean;
        stats: {
            libraries: number;
            userMetas: number;
            citations: number;
            collections: number;
        };
        version: number;
    }> {
        try {
            const [librariesCount, userMetasCount, citationsCount, collectionsCount] = await Promise.all([
                this.libraries.count(),
                this.userMetas.count(),
                this.citations.count(),
                this.collections.count()
            ]);

            return {
                isHealthy: true,
                stats: {
                    libraries: librariesCount,
                    userMetas: userMetasCount,
                    citations: citationsCount,
                    collections: collectionsCount
                },
                version: this.verno
            };
        } catch (error) {
            console.error('❌ Database health check failed:', error);
            return {
                isHealthy: false,
                stats: { libraries: 0, userMetas: 0, citations: 0, collections: 0 },
                version: 0
            };
        }
    }

    /**
     * 🧹 数据库维护和清理
     */
    async maintenance(): Promise<void> {
        try {
            console.log('🧹 Starting database maintenance...');

            // 清理孤儿用户元数据
            const allUserMetas = await this.userMetas.toArray();
            const validLiteratureIds = new Set((await this.libraries.toCollection().primaryKeys()));

            const orphanedMetas = allUserMetas.filter(meta => !validLiteratureIds.has(meta.literatureId));
            if (orphanedMetas.length > 0) {
                console.log(`🧹 Cleaning ${orphanedMetas.length} orphaned user metadata`);
                await this.userMetas.bulkDelete(orphanedMetas.map(meta => meta.id));
            }

            // 清理孤儿引文
            const allCitations = await this.citations.toArray();
            const orphanedCitations = allCitations.filter(citation =>
                !validLiteratureIds.has(citation.sourceItemId) ||
                !validLiteratureIds.has(citation.targetItemId)
            );

            if (orphanedCitations.length > 0) {
                console.log(`🧹 Cleaning ${orphanedCitations.length} orphaned citations`);
                await this.citations.bulkDelete(orphanedCitations.map(citation => citation.id!));
            }

            console.log('✅ Database maintenance completed');

        } catch (error) {
            console.error('❌ Database maintenance failed:', error);
            throw error;
        }
    }
}

// 🏪 单例数据库实例
export const literatureDB = new LiteratureDatabase();
