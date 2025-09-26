import type { IDatasetAdapter } from '../dataset-adapter';
import type { DatasetAuthConfig, DatasetNode, DatasetPaperItem, DatasetNoteItem } from '../dataset-types';

export class ExampleDatasetProvider implements IDatasetAdapter {
    private config: DatasetAuthConfig | null = null;

    async connect(cfg: DatasetAuthConfig): Promise<{ ok: boolean; message?: string }> {
        this.config = cfg;
        return { ok: true };
    }

    async listNodes(): Promise<DatasetNode[]> {
        return [
            { id: 'root', name: 'Root', kind: 'root', parentId: null, totalItems: 2 },
            { id: 'c1', name: 'Example Collection', kind: 'collection', parentId: 'root', totalItems: 2 }
        ];
    }

    async listPapers(nodeId: string, _opts?: { cursor?: string; limit?: number }): Promise<{ items: DatasetPaperItem[]; next?: string }> {
        if (nodeId !== 'c1') return { items: [], next: undefined };
        const items: DatasetPaperItem[] = [
            { id: 'ext-1', title: 'Example Paper A', authors: ['Doe, J.'], year: 2024, doi: '10.0000/example.a', url: null, s2Id: null },
            { id: 'ext-2', title: 'Example Paper B', authors: ['Zhang, W.'], year: 2023, doi: null, url: 'https://example.org/paper-b', s2Id: null }
        ];
        return { items, next: undefined };
    }

    async listNotesByPaper(paperExternalId: string): Promise<DatasetNoteItem[]> {
        if (paperExternalId !== 'ext-1') return [];
        return [
            { id: 'note-1', paperExternalId: 'ext-1', title: 'Highlights', markdown: '- point 1\n- point 2', tags: ['highlight'] }
        ];
    }
}


