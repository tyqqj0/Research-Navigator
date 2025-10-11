"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { notesService } from '../data-access/notes-service';
import { useEffect as useArchiveEffect } from 'react';
import { ArchiveManager } from '@/lib/archive/manager';
import type { NoteModel } from '../data-access/notes-types';

export function useNotes(paperId?: string) {
    const [notes, setNotes] = useState<NoteModel[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!paperId) return;
        setIsLoading(true);
        setError(null);
        try {
            const list = await notesService.listByPaperId(paperId);
            setNotes(list.sort((a, b) => (b.updatedAt?.getTime?.() || 0) - (a.updatedAt?.getTime?.() || 0)));
        } catch (e: any) {
            setError(e?.message || '加载笔记失败');
        } finally {
            setIsLoading(false);
        }
    }, [paperId]);

    useEffect(() => { load(); }, [load]);

    // Reload on archive switch
    useArchiveEffect(() => {
        const unsub = ArchiveManager.subscribe(() => {
            setNotes([]);
            load();
        });
        return unsub;
    }, [load]);

    const create = useCallback(async (contentMarkdown: string, title?: string) => {
        if (!paperId) return;
        const note = await notesService.create({ paperId, title, contentMarkdown });
        setNotes(prev => [note, ...prev]);
    }, [paperId]);

    const update = useCallback(async (noteId: string, patch: Partial<Pick<NoteModel, 'title' | 'contentMarkdown' | 'tags'>>) => {
        const updated = await notesService.update(noteId, patch);
        setNotes(prev => prev.map(n => n.noteId === noteId ? updated : n));
    }, []);

    const remove = useCallback(async (noteId: string) => {
        await notesService.remove(noteId);
        setNotes(prev => prev.filter(n => n.noteId !== noteId));
    }, []);

    return useMemo(() => ({ notes, isLoading, error, reload: load, create, update, remove }), [notes, isLoading, error, load, create, update, remove]);
}


