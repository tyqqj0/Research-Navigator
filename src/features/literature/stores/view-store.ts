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
        subscribeWithSelector((set: any) => ({
            visiblePaperIds: [],
            activePaperId: null,
            setVisiblePaperIds: (ids: any) => set({ visiblePaperIds: Array.isArray(ids) ? ids : [] }),
            setActivePaperId: (paperId: any) => set({ activePaperId: paperId }),
        })),
        { name: 'literature-view-store' }
    )
);


