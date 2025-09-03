/**
 * 📚 Literature Database - 文献数据库配置 (优化版本)
 * 
 * 迁移自: old/src/libs/db/index.ts
 * 优化: 统一版本架构，Feature-First设计，性能优化
 */

import Dexie, { Table, Transaction } from 'dexie';
import {
    LibraryItemCore,
    UserLiteratureMetaCore,
    CitationCore,
    CollectionCore,
    ModelValidators,
    ErrorHandler,
    DatabaseError,
    LITERATURE_CONSTANTS,
} from '../models';
import type {
    LiteratureFilter,
    LiteratureSort,
    PaginatedResult,
} from '../models';

// 📊 数据库配置
const DATABASE_NAME = 'ResearchNavigatorLiteratureDB';
const DATABASE_VERSION = 1; // 统一版本

/**
 * 📚 Literature Database Class - 简化版本管理
 * 
 * 设计原则:
 * 1. 单一版本 - 完整新架构
 * 2. Feature-First 组织
 * 3. 现代化类型定义
 * 4. 高性能索引策略
 */
export class LiteratureDatabase extends Dexie {
    // 📚 核心文献表
    libraries!: Table<LibraryItemCore, string>;

    // 👤 用户元数据表 - 分离用户个性化数据
    userMetas!: Table<UserLiteratureMetaCore, string>;

    // 🔗 引文关系表
    citations!: Table<CitationCore, string>;

    // 📂 文献集合表
    collections!: Table<CollectionCore, string>;

    constructor() {
        super(DATABASE_NAME);

        // ✨ 统一版本 - 完整的新架构数据库
        this.version(DATABASE_VERSION).stores({
            // 📚 核心文献表 - 与后端API对齐
            libraries: '&lid, title, *authors, year, source, publication, doi, url, pdfPath, createdAt, updatedAt',

            // 👤 用户文献元数据表 - 完全分离用户个性化数据
            userMetas: '&[userId+lid], userId, lid, *tags, priority, isFavorite, *notes, *associatedSessions, *associatedProjects, *customCategories, createdAt, updatedAt',

            // 🔗 引文关系表 - 支持复杂网络分析
            citations: '&[sourceItemId+targetItemId], sourceItemId, targetItemId, citationType, discoveryMethod, isVerified, confidence, createdAt, updatedAt',

            // 📂 文献集合表 - 统一的集合管理（通用/话题/智能）
            collections: '&collectionId, userId, lids, type, name, itemCount, createdAt, updatedAt'
        });

        console.log('✨ Literature Database initialized with unified schema');
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
        dbName: string;
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
                version: this.verno,
                dbName: DATABASE_NAME
            };
        } catch (error) {
            console.error('❌ Database health check failed:', error);
            return {
                isHealthy: false,
                stats: { libraries: 0, userMetas: 0, citations: 0, collections: 0 },
                version: 0,
                dbName: DATABASE_NAME
            };
        }
    }

    /**
     * 🧹 清理所有数据 - 开发调试用
     */
    async clearAllData(): Promise<void> {
        try {
            console.log('🧹 Clearing all literature data...');
            await Promise.all([
                this.libraries.clear(),
                this.userMetas.clear(),
                this.citations.clear(),
                this.collections.clear()
            ]);
            console.log('✅ All literature data cleared successfully');
        } catch (error) {
            console.error('❌ Failed to clear all data:', error);
            throw error;
        }
    }

    /**
     * 📊 获取数据库概览
     */
    async getOverview(): Promise<{
        totalLiterature: number;
        totalCitations: number;
        totalCollections: number;
        totalUsers: number;
        lastActivity: Date | null;
    }> {
        try {
            const [libraries, userMetas, citations, collections] = await Promise.all([
                this.libraries.toArray(),
                this.userMetas.toArray(),
                this.citations.toArray(),
                this.collections.toArray()
            ]);

            // 计算唯一用户数
            const uniqueUsers = new Set(userMetas.map(meta => meta.userId));

            // 找出最近活动
            const allDates = [
                ...libraries.map(item => item.updatedAt || item.createdAt),
                ...userMetas.map(meta => meta.updatedAt || meta.createdAt),
                ...citations.map(citation => citation.updatedAt || citation.createdAt),
                ...collections.map(collection => collection.updatedAt || collection.createdAt)
            ].filter(date => date instanceof Date);

            const lastActivity = allDates.length > 0 ?
                new Date(Math.max(...allDates.map(date => date.getTime()))) : null;

            return {
                totalLiterature: libraries.length,
                totalCitations: citations.length,
                totalCollections: collections.length,
                totalUsers: uniqueUsers.size,
                lastActivity
            };
        } catch (error) {
            console.error('❌ Failed to get database overview:', error);
            throw error;
        }
    }

    /**
     * 🔧 数据库维护工具
     */
    async performMaintenance(): Promise<{
        orphanedUserMetas: number;
        orphanedCitations: number;
        inconsistentCollections: number;
        maintenanceTime: number;
    }> {
        const startTime = Date.now();
        console.log('🧹 Starting database maintenance...');

        try {
            // 1. 清理孤儿用户元数据
            const validLiteratureIds = new Set(
                (await this.libraries.toCollection().primaryKeys()) as string[]
            );

            const allUserMetas = await this.userMetas.toArray();
            const orphanedMetas = allUserMetas.filter(meta =>
                !validLiteratureIds.has(meta.literatureId)
            );

            if (orphanedMetas.length > 0) {
                await this.userMetas.bulkDelete(orphanedMetas.map(meta => meta.id));
                console.log(`🧹 Cleaned ${orphanedMetas.length} orphaned user metadata`);
            }

            // 2. 清理孤儿引文
            const allCitations = await this.citations.toArray();
            const orphanedCitations = allCitations.filter(citation =>
                !validLiteratureIds.has(citation.sourceItemId) ||
                !validLiteratureIds.has(citation.targetItemId)
            );

            if (orphanedCitations.length > 0) {
                await this.citations.bulkDelete(orphanedCitations.map(citation => citation.id!));
                console.log(`🧹 Cleaned ${orphanedCitations.length} orphaned citations`);
            }

            // 3. 修复集合计数不一致
            const allCollections = await this.collections.toArray();
            let inconsistentCollections = 0;

            for (const collection of allCollections) {
                const actualCount = collection.literatureIds?.length || 0;
                if (collection.itemCount !== actualCount) {
                    await this.collections.update(collection.id, {
                        itemCount: actualCount,
                        updatedAt: new Date()
                    });
                    inconsistentCollections++;
                }
            }

            if (inconsistentCollections > 0) {
                console.log(`🧹 Fixed ${inconsistentCollections} inconsistent collection counts`);
            }

            const maintenanceTime = Date.now() - startTime;
            console.log(`✅ Database maintenance completed in ${maintenanceTime}ms`);

            return {
                orphanedUserMetas: orphanedMetas.length,
                orphanedCitations: orphanedCitations.length,
                inconsistentCollections,
                maintenanceTime
            };

        } catch (error) {
            console.error('❌ Database maintenance failed:', error);
            throw error;
        }
    }
}

/**
 * 🛠️ 数据库工具类
 */
export class DatabaseUtils {
    /**
     * 📅 获取当前时间
     */
    static now(): Date {
        return new Date();
    }

    /**
     * 🔑 生成UUID
     */
    static generateId(): string {
        return crypto.randomUUID ?
            crypto.randomUUID() :
            'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
    }

    /**
     * 📊 格式化文件大小
     */
    static formatFileSize(bytes: number): string {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * 🔍 深度比较对象
     */
    static deepEqual(obj1: any, obj2: any): boolean {
        if (obj1 === obj2) return true;
        if (obj1 == null || obj2 == null) return false;
        if (typeof obj1 !== typeof obj2) return false;

        if (typeof obj1 === 'object') {
            const keys1 = Object.keys(obj1);
            const keys2 = Object.keys(obj2);

            if (keys1.length !== keys2.length) return false;

            for (const key of keys1) {
                if (!keys2.includes(key) || !this.deepEqual(obj1[key], obj2[key])) {
                    return false;
                }
            }
            return true;
        }

        return false;
    }
}

// 🏪 单例数据库实例
export const literatureDB = new LiteratureDatabase();