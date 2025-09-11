import { useEffect, useMemo, useState } from 'react';
import { literatureDataAccess } from '../data-access';

type Direction = 'out' | 'in' | 'both';

export interface InternalCitationsResult {
    edges: Array<{ source: string; target: string }>;
    stats?: { totalEdges: number; totalNodes: number; density: number; averageDegree: number };
}

export const useInternalCitationsByPaperIds = (
    paperIds: string[],
    options: { direction?: Direction; includeStats?: boolean } = {}
) => {
    const [data, setData] = useState<InternalCitationsResult>({ edges: [] });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            if (!paperIds || paperIds.length === 0) {
                setData({ edges: [] });
                return;
            }
            setLoading(true);
            setError(null);
            try {
                const res = await literatureDataAccess.getInternalCitations(paperIds, options);
                if (!cancelled) setData(res);
            } catch (e: any) {
                if (!cancelled) setError(e?.message || 'Failed to load internal citations');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        run();
        return () => { cancelled = true; };
    }, [JSON.stringify(paperIds), options.direction, options.includeStats]);

    return { ...data, loading, error };
};

export const useCollectionInternalCitations = (
    collectionId: string | null | undefined,
    options: { direction?: Direction; includeStats?: boolean } = {}
) => {
    const [paperIds, setPaperIds] = useState<string[]>([]);
    const { edges, stats, loading, error } = useInternalCitationsByPaperIds(paperIds, options);

    useEffect(() => {
        if (!collectionId) { setPaperIds([]); return; }
        try {
            const store = require('../data-access/stores').useCollectionStore as any;
            const state = store.getState();
            const collection = state.getCollection(collectionId);
            setPaperIds(collection?.paperIds || []);
        } catch (e) {
            setPaperIds([]);
        }
    }, [collectionId]);

    return { edges, stats, loading, error };
};


