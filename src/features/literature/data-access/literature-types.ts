// Literature Domain Types
// 文献领域类型定义

export interface LiteratureItem {
    id: string;
    title: string;
    authors: string[];
    abstract?: string;
    publishedDate?: Date;
    journal?: string;
    doi?: string;
    url?: string;
    pdfPath?: string;
    tags: string[];
    notes?: string;
    citationCount?: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface LiteratureCollection {
    id: string;
    name: string;
    description?: string;
    literatureIds: string[];
    createdAt: Date;
    updatedAt: Date;
}

export interface CitationRelation {
    id: string;
    sourceLiteratureId: string;
    targetLiteratureId: string;
    relationshipType: 'cites' | 'cited_by' | 'related';
    strength?: number; // 0-1, 关系强度
    createdAt: Date;
}

export interface LiteratureNote {
    id: string;
    literatureId: string;
    content: string;
    pageNumber?: number;
    highlightText?: string;
    category?: 'summary' | 'insight' | 'question' | 'critique';
    createdAt: Date;
    updatedAt: Date;
}

// Search and Filter Types
export interface LiteratureSearchQuery {
    query?: string;
    tags?: string[];
    authors?: string[];
    dateRange?: {
        start: Date;
        end: Date;
    };
    journals?: string[];
}

export interface LiteratureSearchResult {
    items: LiteratureItem[];
    total: number;
    page: number;
    pageSize: number;
}
