"use client";

import React from 'react';
import type { SessionId } from '../data-access/types';
import { useSessionStore } from '../data-access/session-store';
import { LiteratureListPanel } from '@/features/literature/management/components/LiteratureListPanel';
import { literatureDataAccess } from '@/features/literature/data-access';

export const SessionCollectionPanel: React.FC<{ sessionId: SessionId }> = ({ sessionId }) => {
    const session = useSessionStore(s => s.sessions.get(sessionId));
    const [items, setItems] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        const run = async () => {
            const cid = session?.linkedCollectionId;
            if (!cid) { setItems([]); return; }
            setLoading(true);
            try {
                // 简化：拿到集合后取用户文献全集并在前端过滤（后续可加专用API）
                const all = await literatureDataAccess.literatures.getUserLiteratures();
                // 如果 CollectionStore 可用，也可以直接从 store 取 ids 再映射增强项
                setItems(all.filter(i => (i as any).collections?.includes(cid)));
            } catch { setItems([]); }
            finally { setLoading(false); }
        };
        void run();
    }, [session?.linkedCollectionId]);

    return (
        <LiteratureListPanel showControls={true} showPagination={true} literatures={items as any} isLoading={loading} />
    );
};

export default SessionCollectionPanel;


