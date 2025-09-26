// Dataset domain types

export type DatasetProvider = 'zotero' | 'notion' | 'obsidian' | 'custom';

export interface DatasetAuthConfig {
    apiKey?: string;
    apiBase?: string;
    // Support multiple roots simultaneously: e.g., 'user' and/or specific group ids
    roots?: Array<{ kind: 'user' | 'group'; id?: string; name?: string }>;
}

export type DatasetNodeKind = 'root' | 'folder' | 'collection';

export interface DatasetNode {
    id: string;
    name: string;
    kind: DatasetNodeKind;
    parentId?: string | null;
    totalItems?: number;
    // Optional root owner for multi-root: 'user' or 'group:{id}'
    owner?: string;
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


