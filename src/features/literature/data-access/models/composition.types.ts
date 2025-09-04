/**
 * 📚 Literature Composition Types - 文献组合类型定义
 * 
 * 专注于文献实体与用户元数据的组合，不涉及集合等外部关系
 * 
 * 设计原则：
 * - 纯粹组合：只组合文献本身与用户元数据
 * - 解耦关系：不包含集合、引用等外部关系概念
 * - 按需组合：提供不同级别的组合选项
 * - 批量友好：支持通过文献ID列表批量获取组合数据
 * - 类型安全：严格的TypeScript类型约束
 */

import type { LibraryItem } from './library-item.types';
import type { UserLiteratureMeta } from './user-literature-meta.types';

// ==================== 核心组合类型 ====================

/**
 * 🔄 增强的文献项 - 文献与用户元数据的纯粹组合
 * 
 * 这是系统中最重要的组合类型，将基础文献数据与用户个人数据结合
 * 不包含任何外部关系（如集合、引用等）
 */
export type EnhancedLibraryItem = {
    /** 核心文献数据 */
    literature: LibraryItem;
    /** 用户元数据（可选，取决于是否有用户上下文） */
    userMeta?: UserLiteratureMeta;
};

/**
 * 🎯 带统计信息的增强文献
 * 
 * 在基础增强文献基础上，添加用户相关的统计信息
 */
export type EnhancedLibraryItemWithStats = EnhancedLibraryItem & {
    /** 用户文献统计信息 */
    stats?: {
        /** 用户阅读次数 */
        readCount: number;
        /** 最后访问时间 */
        lastAccessed?: Date;
        /** 文件大小（如果有PDF） */
        fileSize?: number;
        /** 页数（如果已解析） */
        pageCount?: number;
        /** 用户添加时间 */
        addedAt?: Date;
        /** 用户最后修改时间 */
        lastModified?: Date;
    };
};

// ==================== 组合选项类型 ====================

/**
 * 🎛️ 文献组合选项
 * 
 * 控制文献组合服务的数据组合行为，只涉及文献与用户元数据的组合
 */
export type CompositionOptions = {
    /** 用户ID（用于获取用户元数据） */
    userId?: string;
    /** 是否包含用户元数据 */
    includeUserMeta?: boolean;
    /** 是否包含统计信息 */
    includeStats?: boolean;
    /** 是否包含文件信息（大小、页数等） */
    includeFileInfo?: boolean;
};

// ==================== 批量操作类型 ====================

/**
 * 📦 批量组合结果
 * 
 * 用于批量文献组合操作的结果类型
 */
export type BatchCompositionResult<T = EnhancedLibraryItem> = {
    /** 成功组合的项目 */
    items: T[];
    /** 失败的项目ID */
    failed: string[];
    /** 总数统计 */
    total: number;
    /** 成功数量 */
    success: number;
    /** 失败数量 */
    errors: number;
};

/**
 * 🎯 按ID批量获取选项
 * 
 * 核心功能：支持外部通过文献ID列表批量获取组合数据
 * 使用场景：Collection获取lid列表后，批量获取文献组合数据
 */
export type BatchByIdsOptions = CompositionOptions & {
    /** 文献ID列表 */
    literatureIds: string[];
    /** 是否保持ID顺序（默认false，按数据库返回顺序） */
    preserveOrder?: boolean;
    /** 是否忽略不存在的ID（默认true，不存在的ID不会导致整体失败） */
    ignoreNotFound?: boolean;
};

/**
 * 📊 ID映射结果
 * 
 * 保持ID到组合数据的映射关系，便于外部使用
 */
export type CompositionByIdMap<T = EnhancedLibraryItem> = {
    /** ID到组合数据的映射 */
    byId: Record<string, T>;
    /** 按顺序的项目列表（如果preserveOrder=true） */
    ordered?: T[];
    /** 找到的ID列表 */
    found: string[];
    /** 未找到的ID列表 */
    notFound: string[];
};

// 注意：所有类型都已在上面定义时直接导出，无需重复导出
