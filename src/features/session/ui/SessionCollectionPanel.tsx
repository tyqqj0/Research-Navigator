"use client";

import React from 'react';
import type { SessionId } from '../data-access/types';
import { useSessionStore } from '../data-access/session-store';
import { LiteratureListPanel } from '@/features/literature/management/components/LiteratureListPanel';
import { useCollectionStore, useLiteratureStore } from '@/features/literature/data-access';
import { useCollectionOperations } from '@/features/literature/hooks/use-collection-operations';
import { useLiteratureOperations } from '@/features/literature/hooks/use-literature-operations';

export const SessionCollectionPanel: React.FC<{ sessionId: SessionId; onOpenDetail?: (paperId: string) => void }> = ({ sessionId, onOpenDetail }) => {
    const session = useSessionStore(s => s.sessions.get(sessionId));
    const cid = session?.linkedCollectionId || null;

    // ensure initial load after refresh
    const { loadCollections, loadCollection } = useCollectionOperations();
    const { loadLiteratures } = useLiteratureOperations();
    React.useEffect(() => { void loadCollections({ force: false }); void loadLiteratures({ force: false }); }, [loadCollections, loadLiteratures]);

    // subscribe to store updates for reactive list
    const collection = useCollectionStore(s => (cid ? s.getCollection(cid) : undefined));
    const collectionUpdated = useCollectionStore(s => s.stats.lastUpdated);
    const literatureUpdated = useLiteratureStore(s => s.stats.lastUpdated);

    const items = React.useMemo(() => {
        if (!cid || !collection) return [] as any[];
        const map = useLiteratureStore.getState().literatures;
        return collection.paperIds.map(id => map.get(id)).filter(Boolean) as any[];
    }, [cid, collection?.paperIds?.join('|'), collectionUpdated, literatureUpdated]);

    // 若已绑定集合但还未加载进 Store，主动触发一次加载该集合，避免长时间“加载中”
    React.useEffect(() => {
        let cancelled = false;
        const run = async () => {
            if (!cid) return;
            if (collection) return;
            try { await loadCollection(cid); } catch { }
            if (cancelled) return;
        };
        void run();
        return () => { cancelled = true; };
    }, [cid, collection, loadCollection]);

    const loading = !collection && !!cid;

    return (
        <LiteratureListPanel
            showControls={true}
            showPagination={true}
            literatures={items as any}
            isLoading={loading}
            onItemClick={(item) => {
                try { onOpenDetail?.(item.literature.paperId); } catch { /* noop */ }
            }}
        />
    );
};

export default SessionCollectionPanel;


