import type { Artifact } from '../../data-access/types';

export interface CollectionData { paperIds: string[] }

export const collectionExecutor = {
    mergeBatch(prev: Artifact<CollectionData> | null, batch: Artifact<{ paperIds: string[] }>): Artifact<CollectionData> & { added: number } {
        const prevIds = new Set(prev?.data.paperIds || []);
        const addedIds = batch.data.paperIds.filter(id => !prevIds.has(id));
        const all = [...prevIds, ...addedIds] as unknown as string[]; // prevIds is Set iterable
        const version = (prev?.version || 0) + 1;
        return { id: prev?.id || crypto.randomUUID(), kind: 'literature_collection', version, data: { paperIds: Array.from(new Set(all)) }, createdAt: Date.now(), added: addedIds.length };
    }
};


