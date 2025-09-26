import type {
    DatasetAuthConfig,
    DatasetNode,
    DatasetPaperItem,
    DatasetNoteItem
} from './dataset-types';

export interface IDatasetAdapter {
    connect(cfg: DatasetAuthConfig): Promise<{ ok: boolean; message?: string }>;
    listNodes(): Promise<DatasetNode[]>;
    listPapers(nodeId: string, opts?: { cursor?: string; limit?: number }): Promise<{ items: DatasetPaperItem[]; next?: string }>;
    listNotesByPaper(paperExternalId: string): Promise<DatasetNoteItem[]>;
}


