"use client";

import React from 'react';
import { MainLayout } from '@/components/layout';
import { ChatPanel } from './ChatPanel';
import { SessionCollectionPanel } from './SessionCollectionPanel';
import { GraphCanvas } from '@/features/graph/editor/canvas/GraphCanvas';
import { usePaperCatalog } from '@/features/graph/editor/paper-catalog';
import { useSessionStore } from '../data-access/session-store';
// ensure orchestrators are registered
import '../runtime/orchestrator/chat.orchestrator';
import '../runtime/orchestrator/direction.orchestrator';
import '../runtime/orchestrator/collection.orchestrator';
import '../runtime/orchestrator/report.orchestrator';
import { startDirectionSupervisor } from '@/features/session/runtime/orchestrator/direction.supervisor';
import { startCollectionSupervisor } from '@/features/session/runtime/orchestrator/collection.supervisor';

export const SessionPage: React.FC<{ sessionId: string }> = ({ sessionId }) => {
    React.useEffect(() => { startDirectionSupervisor(); startCollectionSupervisor(); }, []);
    const { getPaperSummary } = usePaperCatalog();
    const session = useSessionStore(s => s.sessions.get(sessionId));
    const graphId = undefined as any; // 后续由编排器设置并接入 GraphCanvas

    return (
        <MainLayout headerTitle="研究会话" showSidebar={false} hideUserInfo={true}>
            <div className="p-4 h-full grid grid-cols-12 gap-4">
                <div className="col-span-12 md:col-span-3 h-[70vh]">
                    <ChatPanel sessionId={sessionId} />
                </div>
                <div className="col-span-12 md:col-span-6 h-[70vh]">
                    {graphId ? (
                        <GraphCanvas graphId={graphId} getPaperSummary={getPaperSummary} layoutMode="timeline" />
                    ) : (
                        <div className="h-full grid place-items-center text-muted-foreground">尚未生成图谱</div>
                    )}
                </div>
                <div className="col-span-12 md:col-span-3 h-[70vh]">
                    <SessionCollectionPanel sessionId={sessionId} />
                </div>
            </div>
        </MainLayout>
    );
};

export default SessionPage;


