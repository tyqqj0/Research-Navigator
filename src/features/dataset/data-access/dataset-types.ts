// Dataset domain types

export type DatasetProvider = 'zotero' | 'notion' | 'obsidian' | 'custom';

export interface DatasetAuthConfig {
    apiKey?: string;
    apiBase?: string;
    libraryId?: string;
}

export type DatasetNodeKind = 'root' | 'folder' | 'collection';

export interface DatasetNode {
    id: string;
    name: string;
    kind: DatasetNodeKind;
    parentId?: string | null;
    totalItems?: number;
}

export interface DatasetPaperItem {
    id: string;
    title: string;
    authors?: string[];
    year?: number;
    doi?: string | null;
    url?: string | null;
    s2Id?: string | null;
    extra?: Record<string, any>;
}

export interface DatasetNoteItem {
    id: string;
    paperExternalId: string;
    title?: string;
    markdown?: string;
    rawHtml?: string;
    tags?: string[];
    externalRef?: Record<string, any>;
}


