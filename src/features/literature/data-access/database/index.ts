/**
 * 📚 Literature Database - 数据库层统一导出
 * 
 * 提供: 数据库实例、配置、工具函数
 */

// 🏪 主数据库导出
export { LiteratureDatabase, literatureDB } from './literature-database';

// 📊 数据库配置常量
export const DATABASE_CONFIG = {
    NAME: 'literatureDB',
    CURRENT_VERSION: 8,
    BATCH_SIZE: 100,
    INDEX_OPTIONS: {
        multiEntry: true
    }
} as const;

// 🔧 数据库工具函数
export const DatabaseUtils = {
    /**
     * 🔄 批量操作辅助函数
     */
    async batchOperation<T>(
        items: T[],
        operation: (batch: T[]) => Promise<void>,
        batchSize: number = DATABASE_CONFIG.BATCH_SIZE
    ): Promise<void> {
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            await operation(batch);
        }
    },

    /**
     * 🔍 安全查询包装器
     */
    async safeQuery<T>(
        queryFn: () => Promise<T>,
        fallback: T,
        logError: boolean = true
    ): Promise<T> {
        try {
            return await queryFn();
        } catch (error) {
            if (logError) {
                console.error('Database query failed:', error);
            }
            return fallback;
        }
    },

    /**
     * 📏 生成UUID（用于主键）
     */
    generateId(): string {
        return crypto.randomUUID();
    },

    /**
     * ⏰ 获取当前时间戳
     */
    now(): Date {
        return new Date();
    },

    /**
     * 🔄 标准化输入数据
     */
    normalizeInput<T extends Record<string, any>>(input: T): T {
        const normalized = { ...input };

        // 确保字符串字段被trim
        Object.keys(normalized).forEach(key => {
            if (typeof normalized[key] === 'string') {
                normalized[key] = normalized[key].trim();
            }
        });

        return normalized;
    }
};

// 🎯 数据库状态类型
export type DatabaseStatus = {
    isOpen: boolean;
    version: number;
    isHealthy: boolean;
    lastError?: string;
};

// 📊 数据库事件类型
export type DatabaseEvent = {
    type: 'opened' | 'closed' | 'error' | 'migrated';
    timestamp: Date;
    details?: any;
};
