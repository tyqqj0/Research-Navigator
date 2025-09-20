import { literatureDataAccess } from '@/features/literature/data-access';

export const pruneExecutor = {
    async pruneToMax(collectionId: string, targetMax: number, criterion: 'citation_low_first' | 'random' = 'citation_low_first') {
        const collection = await literatureDataAccess.getCollection(collectionId as any);
        const allIds: string[] = (collection as any)?.paperIds || [];
        if (allIds.length <= targetMax) return { removed: 0, from: allIds.length, to: allIds.length };

        let removeIds: string[] = [];
        if (criterion === 'random') {
            removeIds = [...allIds].sort(() => Math.random() - 0.5).slice(0, allIds.length - targetMax);
        } else {
            // Fallback: without citation stats, approximate by pushing older ones later
            removeIds = [...allIds].slice(0, allIds.length - targetMax);
        }
        if (removeIds.length > 0) {
            await literatureDataAccess.collections.removeItemsFromCollection(collectionId as any, removeIds);
        }
        const to = allIds.length - removeIds.length;
        return { removed: removeIds.length, from: allIds.length, to };
    }
};


