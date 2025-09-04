/**
 * 📚 Literature Source Types - 文献来源类型定义
 * 
 * 迁移自: old/src/libs/db/constants.ts
 * 优化: 使用现代TypeScript枚举和元数据定义
 */

// 文献来源枚举 - 与旧版保持兼容
export const LITERATURE_SOURCES = {
    MANUAL: 'manual',
    SEARCH: 'search',
    IMPORT: 'import',
    KNOWLEDGE: 'knowledge',
    ZOTERO: 'zotero'
} as const;

export type LiteratureSource = typeof LITERATURE_SOURCES[keyof typeof LITERATURE_SOURCES];

// 来源元数据 - 用于UI显示
export const SOURCE_METADATA = {
    [LITERATURE_SOURCES.MANUAL]: {
        name: '手动添加',
        description: '用户手动添加的文献',
        icon: '✏️',
        color: 'bg-blue-100 text-blue-800'
    },
    [LITERATURE_SOURCES.SEARCH]: {
        name: '搜索发现',
        description: '通过搜索发现的文献',
        icon: '🔍',
        color: 'bg-green-100 text-green-800'
    },
    [LITERATURE_SOURCES.IMPORT]: {
        name: '文件导入',
        description: '从文件导入的文献',
        icon: '📄',
        color: 'bg-purple-100 text-purple-800'
    },
    [LITERATURE_SOURCES.KNOWLEDGE]: {
        name: '知识库',
        description: '从知识库添加的文献',
        icon: '🧠',
        color: 'bg-yellow-100 text-yellow-800'
    },
    [LITERATURE_SOURCES.ZOTERO]: {
        name: 'Zotero同步',
        description: '从Zotero同步的文献',
        icon: '📚',
        color: 'bg-red-100 text-red-800'
    }
} as const;

// 默认来源
export const DEFAULT_LITERATURE_SOURCE = LITERATURE_SOURCES.MANUAL;
