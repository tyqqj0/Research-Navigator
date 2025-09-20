import type { Artifact } from '../../data-access/types';

export interface CollectionData { paperIds: string[] }

export const collectionExecutor = {
    mergeBatch(prev: Artifact<CollectionData> | null, batch: Artifact<{ paperIds: string[] }>): Artifact<CollectionData> & { added: number } {
        const prevIds = new Set(prev?.data.paperIds || []);
        // 先对批次去重，避免“新增 N > 总计 M”现象
        const uniqueBatchIds = Array.from(new Set(batch.data.paperIds || []));
        const addedIds = uniqueBatchIds.filter(id => !prevIds.has(id));
        const all = new Set<string>([...prevIds, ...addedIds]);
        const version = (prev?.version || 0) + 1;
        return { id: prev?.id || crypto.randomUUID(), kind: 'literature_collection', version, data: { paperIds: Array.from(all) }, createdAt: Date.now(), added: addedIds.length };
    }
};


