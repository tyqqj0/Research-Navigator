import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';

export interface LiteratureViewState {
    visiblePaperIds: string[];
    activePaperId: string | null;
}

export interface LiteratureViewActions {
    setVisiblePaperIds: (ids: string[]) => void;
    setActivePaperId: (paperId: string | null) => void;
}

export const useLiteratureViewStore = create<LiteratureViewState & LiteratureViewActions>()(
    devtools(
        subscribeWithSelector((set) => ({
            visiblePaperIds: [] as string[],
            activePaperId: null as string | null,
            setVisiblePaperIds: (ids: string[]) => set({ visiblePaperIds: Array.isArray(ids) ? ids : [] }),
            setActivePaperId: (paperId: string | null) => set({ activePaperId: paperId }),
        })),
        { name: 'literature-view-store' }
    )
);


