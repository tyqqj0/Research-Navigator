// Notes Service - auto user context

import { authStoreUtils, type AuthStoreState } from '@/stores/auth.store';
import { notesRepository } from './notes-repository';
import type { CreateNoteInput, NoteModel, UpdateNoteInput } from './notes-types';

export class NotesService {
    private authStore: Pick<AuthStoreState, 'getCurrentUserId' | 'requireAuth'>;

    constructor(authStore?: Pick<AuthStoreState, 'getCurrentUserId' | 'requireAuth'>) {
        this.authStore = authStore || authStoreUtils.getStoreInstance();
    }

    private requireUserId(): string {
        return this.authStore.requireAuth();
    }

    async listByPaperId(paperId: string): Promise<NoteModel[]> {
        const userId = this.requireUserId();
        return notesRepository.listByPaperId(userId, paperId);
    }

    async countByPaperIds(paperIds: string[]): Promise<Record<string, number>> {
        const userId = this.requireUserId();
        return notesRepository.countByPaperIds(userId, paperIds);
    }

    async create(input: CreateNoteInput): Promise<NoteModel> {
        const userId = this.requireUserId();
        const note: NoteModel = {
            noteId: crypto.randomUUID(),
            userId,
            paperId: input.paperId,
            title: input.title,
            contentMarkdown: input.contentMarkdown,
            tags: input.tags || [],
            source: 'manual',
            privacy: 'private',
            isDeleted: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await notesRepository.create(note);
        return note;
    }

    async update(noteId: string, patch: UpdateNoteInput): Promise<NoteModel> {
        const existing = await notesRepository.get(noteId);
        if (!existing) throw new Error('Note not found');
        const updated: Partial<NoteModel> = {
            ...patch,
            updatedAt: new Date(),
        } as Partial<NoteModel>;
        await notesRepository.update(noteId, updated);
        const after = await notesRepository.get(noteId);
        if (!after) throw new Error('Failed to reload updated note');
        return after;
    }

    async remove(noteId: string): Promise<void> {
        await notesRepository.softDelete(noteId);
    }
}

export const notesService = new NotesService();


