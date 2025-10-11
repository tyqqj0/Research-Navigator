// Dexie repository for Notes (archive-scoped)

import Dexie, { Table } from 'dexie';
import type { NoteModel } from './notes-types';

export interface NotesRepository {
    findByExternalItemKey(userId: string, itemKey: string): Promise<NoteModel | undefined>;
    upsert(note: NoteModel, externalItemKey?: string): Promise<void>;
    listByPaperId(userId: string, paperId: string): Promise<NoteModel[]>;
    countByPaperIds(userId: string, paperIds: string[]): Promise<Record<string, number>>;
    create(note: NoteModel): Promise<void>;
    update(noteId: string, patch: Partial<NoteModel>): Promise<void>;
    softDelete(noteId: string): Promise<void>;
    get(noteId: string): Promise<NoteModel | undefined>;
    close(): void;
}

class NotesDatabase extends Dexie {
    notes!: Table<NoteModel, string>;

    constructor(dbName: string) {
        super(dbName);
        this.version(1).stores({
            notes: `&noteId, userId, paperId, [userId+paperId], source, createdAt, updatedAt, externalRef.itemKey`
        });
    }
}

export function createNotesRepository(archiveId: string): NotesRepository {
    // Archive-scoped DB name to isolate data per archive
    const db = new NotesDatabase(`ResearchNavigatorNotes__${archiveId}`);

    return {
        async findByExternalItemKey(userId: string, itemKey: string): Promise<NoteModel | undefined> {
            return db.notes
                .where('externalRef.itemKey')
                .equals(itemKey)
                .and(n => n.userId === userId && !n.isDeleted)
                .first();
        },

        async upsert(note: NoteModel, externalItemKey?: string): Promise<void> {
            if (externalItemKey) {
                const existing = await db.notes
                    .where('externalRef.itemKey')
                    .equals(externalItemKey)
                    .and(n => n.userId === note.userId && n.paperId === note.paperId)
                    .first();
                if (existing) {
                    await db.notes.update(existing.noteId, {
                        title: note.title,
                        contentMarkdown: note.contentMarkdown,
                        rawHtml: note.rawHtml,
                        tags: note.tags,
                        updatedAt: new Date(),
                        isDeleted: false,
                        externalRef: note.externalRef || existing.externalRef,
                        source: note.source,
                    });
                    return;
                }
            }
            await db.notes.put(note);
        },

        async listByPaperId(userId: string, paperId: string): Promise<NoteModel[]> {
            return db.notes
                .where('[userId+paperId]')
                .equals([userId, paperId])
                .and(n => !n.isDeleted)
                .reverse()
                .sortBy('updatedAt')
                .then(arr => arr.reverse());
        },

        async countByPaperIds(userId: string, paperIds: string[]): Promise<Record<string, number>> {
            const result: Record<string, number> = {};
            await Promise.all(paperIds.map(async pid => {
                const count = await db.notes
                    .where('[userId+paperId]')
                    .equals([userId, pid])
                    .and(n => !n.isDeleted)
                    .count();
                result[pid] = count;
            }));
            return result;
        },

        async create(note: NoteModel): Promise<void> {
            await db.notes.put(note);
        },

        async update(noteId: string, patch: Partial<NoteModel>): Promise<void> {
            await db.notes.update(noteId, patch);
        },

        async softDelete(noteId: string): Promise<void> {
            await db.notes.update(noteId, { isDeleted: true, updatedAt: new Date() });
        },

        async get(noteId: string): Promise<NoteModel | undefined> {
            return db.notes.get(noteId);
        },

        close(): void {
            try { db.close(); } catch { /* ignore */ }
        }
    };
}


