// Literature Domain - Zustand Store
// 文献领域状态管理

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
    LiteratureItem,
    LiteratureCollection,
    CitationRelation,
    LiteratureNote,
    LiteratureSearchQuery,
    LiteratureSearchResult
} from './literature-types';

interface LiteratureState {
    // 数据状态
    items: LiteratureItem[];
    collections: LiteratureCollection[];
    citations: CitationRelation[];
    notes: LiteratureNote[];

    // UI状态
    selectedItemId: string | null;
    searchQuery: LiteratureSearchQuery;
    searchResults: LiteratureSearchResult | null;
    isLoading: boolean;
    error: string | null;

    // 操作方法
    setItems: (items: LiteratureItem[]) => void;
    addItem: (item: LiteratureItem) => void;
    updateItem: (id: string, updates: Partial<LiteratureItem>) => void;
    removeItem: (id: string) => void;

    setSelectedItem: (id: string | null) => void;
    setSearchQuery: (query: LiteratureSearchQuery) => void;
    setSearchResults: (results: LiteratureSearchResult | null) => void;

    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;

    // Collection operations
    addCollection: (collection: LiteratureCollection) => void;
    updateCollection: (id: string, updates: Partial<LiteratureCollection>) => void;
    removeCollection: (id: string) => void;

    // Note operations
    addNote: (note: LiteratureNote) => void;
    updateNote: (id: string, updates: Partial<LiteratureNote>) => void;
    removeNote: (id: string) => void;

    // Citation operations
    addCitation: (citation: CitationRelation) => void;
    removeCitation: (id: string) => void;
}

export const useLiteratureStore = create<LiteratureState>()(
    devtools(
        (set, get) => ({
            // 初始状态
            items: [],
            collections: [],
            citations: [],
            notes: [],
            selectedItemId: null,
            searchQuery: {},
            searchResults: null,
            isLoading: false,
            error: null,

            // 基础操作
            setItems: (items) => set({ items }),
            addItem: (item) => set((state) => ({ items: [...state.items, item] })),
            updateItem: (id, updates) => set((state) => ({
                items: state.items.map((item) =>
                    item.id === id ? { ...item, ...updates, updatedAt: new Date() } : item
                )
            })),
            removeItem: (id) => set((state) => ({
                items: state.items.filter((item) => item.id !== id)
            })),

            // UI状态操作
            setSelectedItem: (id) => set({ selectedItemId: id }),
            setSearchQuery: (query) => set({ searchQuery: query }),
            setSearchResults: (results) => set({ searchResults: results }),
            setLoading: (loading) => set({ isLoading: loading }),
            setError: (error) => set({ error }),

            // Collection操作
            addCollection: (collection) => set((state) => ({
                collections: [...state.collections, collection]
            })),
            updateCollection: (id, updates) => set((state) => ({
                collections: state.collections.map((collection) =>
                    collection.id === id ? { ...collection, ...updates, updatedAt: new Date() } : collection
                )
            })),
            removeCollection: (id) => set((state) => ({
                collections: state.collections.filter((collection) => collection.id !== id)
            })),

            // Note操作
            addNote: (note) => set((state) => ({ notes: [...state.notes, note] })),
            updateNote: (id, updates) => set((state) => ({
                notes: state.notes.map((note) =>
                    note.id === id ? { ...note, ...updates, updatedAt: new Date() } : note
                )
            })),
            removeNote: (id) => set((state) => ({
                notes: state.notes.filter((note) => note.id !== id)
            })),

            // Citation操作
            addCitation: (citation) => set((state) => ({
                citations: [...state.citations, citation]
            })),
            removeCitation: (id) => set((state) => ({
                citations: state.citations.filter((citation) => citation.id !== id)
            })),
        }),
        {
            name: 'literature-store',
        }
    )
);
