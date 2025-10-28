import type { LibraryItem } from './library-item.types';

// 🔎 统一的论文搜索参数（前端→后端透传，尽量保持宽松）
export type PaperSearchParams = {
    query: string;
    offset?: number;
    limit?: number;
    fields?: string[] | string;
    year?: number | string;
    publicationDateOrYear?: string;
    venue?: string | string[];
    fieldsOfStudy?: string | string[];
    publicationTypes?: string | string[];
    openAccessPdf?: boolean;
    minCitationCount?: number | string;
    matchTitle?: boolean;
    preferLocal?: boolean;
    fallbackToS2?: boolean;
};

export type SearchHighlights = {
    title?: string[];
    abstract?: string[];
    authors?: string[];
    venue?: string[];
};

// 🎯 最小搜索条目：仅包含必要标识以及请求到的轻量字段
export type MinimalSearchItem = {
    paperId: string;
    title?: string;
    year?: number;
    authors?: string[];
    venue?: string;
    url?: string;
    doi?: string;
    // 允许按需扩展额外字段（例如后端透传的简单属性）
    [key: string]: any;
};

// 🧭 排序命中结果，包含可选分数与高亮（默认使用最小条目形态）
export type SearchHit<T = MinimalSearchItem> = {
    item: T;
    score?: number;
    rank?: number;
    highlights?: SearchHighlights;
    source?: string;
};


