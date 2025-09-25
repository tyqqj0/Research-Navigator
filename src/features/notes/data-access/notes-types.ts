// Notes domain types

export type NoteSource = 'manual' | 'zotero' | 'import';
export type NotePrivacy = 'private';

export interface NoteExternalRef {
    provider: 'zotero';
    libraryId?: string;
    itemKey: string;
    parentKey?: string;
    lastModified?: string;
}

export interface NoteModel {
    noteId: string;
    userId: string;
    paperId: string;
    title?: string;
    contentMarkdown: string;
    rawHtml?: string;
    tags?: string[];
    source: NoteSource;
    externalRef?: NoteExternalRef;
    privacy: NotePrivacy;
    isDeleted?: boolean;
    createdAt: Date;
    updatedAt?: Date;
}

export interface CreateNoteInput {
    paperId: string;
    title?: string;
    contentMarkdown: string;
    tags?: string[];
}

export interface UpdateNoteInput {
    title?: string;
    contentMarkdown?: string;
    tags?: string[];
    privacy?: NotePrivacy;
}


