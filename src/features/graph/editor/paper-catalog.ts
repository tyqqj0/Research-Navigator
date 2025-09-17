"use client";

import { useCallback } from 'react';
import { useLiteratureOperations } from '@/features/literature/hooks/use-literature-operations';

export type PaperSummary = { id: string; title: string; year?: number; authors?: string[]; name?: string; publicationDate?: string };

export function usePaperCatalog() {
    const lit = useLiteratureOperations();

    const getPaperSummary = useCallback((paperId: string): PaperSummary | undefined => {
        const item = lit.getLiterature(paperId);
        if (!item) return undefined;
        return {
            id: item.literature.paperId,
            title: item.literature.title,
            year: item.literature.year,
            authors: item.literature.authors,
            publicationDate: item.literature.publicationDate,
        };
    }, [lit]);

    return { getPaperSummary };
}


