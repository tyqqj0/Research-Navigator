"use client";

import React, { useEffect, useState, useCallback } from 'react';
import RequireAuth from '@/components/auth/RequireAuth';
import { MainLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GraphPickerPanel } from '@/features/graph/editor/left/GraphPickerPanel';
import { GraphMetaPanel } from '@/features/graph/editor/left/GraphMetaPanel';
import { GraphCanvas } from '@/features/graph/editor/canvas/GraphCanvas';
import { GraphToolbar } from '@/features/graph/editor/canvas/GraphToolbar';
import { CollectionTreePanel } from '@/features/literature/management/components/CollectionTreePanel';
import { LiteratureListPanel } from '@/features/literature/management/components/LiteratureListPanel';
import LiteratureDetailPanel from '@/features/literature/management/components/LiteratureDetailPanel';
import { useLiteratureOperations } from '@/features/literature/hooks/use-literature-operations';
import { useCollectionOperations } from '@/features/literature/hooks/use-collection-operations';
import { usePaperCatalog } from '@/features/graph/editor/paper-catalog';

export default function GraphPage() {
    const { loadLiteratures } = useLiteratureOperations();
    const { loadCollections } = useCollectionOperations();
    const { getPaperSummary } = usePaperCatalog();

    const [graphId, setGraphId] = useState<string | null>(null);
    const [visibleIds, setVisibleIds] = useState<string[]>([]);
    const [detailOpen, setDetailOpen] = useState(false);
    const [activePaperId, setActivePaperId] = useState<string | undefined>(undefined);

    useEffect(() => {
        loadLiteratures({ force: false }).catch(() => { });
        loadCollections({ force: false }).catch(() => { });
        // We only need to load once on mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSelectCollection = useCallback((collectionId: string | null) => {
        // LiteratureListPanel manages its own filtering
    }, []);

    return (
        <RequireAuth>
            <MainLayout headerTitle="图谱编辑" showSidebar={true} hideUserInfo={true}>
                <div className="p-4 h-full relative">
                    <div className={`grid grid-cols-12 gap-4 transition-all duration-300 ${detailOpen ? 'pr-[38rem]' : ''}`}>
                        <div className="col-span-12 md:col-span-3 space-y-4">
                            <GraphPickerPanel onSelectGraph={setGraphId} />
                            {graphId && <GraphMetaPanel graphId={graphId} />}
                        </div>

                        <div className="col-span-12 md:col-span-6 space-y-3">
                            <Card>
                                <CardHeader className="py-2">
                                    <CardTitle className="text-sm">Canvas</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="p-2 border-b">
                                        <GraphToolbar graphId={graphId || undefined} />
                                    </div>
                                    <div className="h-[70vh]">
                                        {graphId ? (
                                            <GraphCanvas
                                                graphId={graphId}
                                                getPaperSummary={getPaperSummary}
                                                onNodeOpenDetail={(pid) => { setActivePaperId(pid); setDetailOpen(true); }}
                                                layoutMode="timeline"
                                            />
                                        ) : (
                                            <div className="h-full grid place-items-center text-muted-foreground">
                                                请选择左侧图谱，或新建一个
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="col-span-12 md:col-span-3 space-y-4">
                            <CollectionTreePanel onSelectCollection={handleSelectCollection} />
                            <LiteratureListPanel
                                onVisibleIdsChange={setVisibleIds}
                                showPagination={true}
                                showControls={true}
                                onItemClick={(item) => { setActivePaperId(item.literature.paperId); setDetailOpen(true); }}
                            />
                        </div>
                    </div>
                    {/* right-side detail panel - inside page container to avoid covering header */}
                    <div className="absolute inset-y-0 right-0 z-20 pointer-events-none">
                        <div className="h-full">
                            <div className="w-[38rem] max-w-[90vw] h-full transform transition-transform duration-300 shadow-xl pointer-events-auto"
                                style={{ transform: detailOpen ? 'translateX(0)' : 'translateX(100%)' }}>
                                <LiteratureDetailPanel
                                    open={detailOpen}
                                    onOpenChange={setDetailOpen}
                                    paperId={activePaperId}
                                    onUpdated={() => { }}
                                    variant="side"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </MainLayout>
        </RequireAuth>
    );
}


