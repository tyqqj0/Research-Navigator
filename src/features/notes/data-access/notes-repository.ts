// Dexie repository for Notes

import Dexie, { Table } from 'dexie';
import type { NoteModel } from './notes-types';

class NotesDatabase extends Dexie {
    notes!: Table<NoteModel, string>;

    constructor() {
        super('ResearchNavigatorNotes');
        this.version(1).stores({
            notes: `&noteId, userId, paperId, [userId+paperId], source, createdAt, updatedAt, externalRef.itemKey`
        });
    }
}

const db = new NotesDatabase();

export const notesRepository = {
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
    }
};


