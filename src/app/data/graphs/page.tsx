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
import { useLiteratureOperations } from '@/features/literature/hooks/use-literature-operations';
import { useCollectionOperations } from '@/features/literature/hooks/use-collection-operations';
import { usePaperCatalog } from '@/features/graph/editor/paper-catalog';

export default function GraphPage() {
    const { loadLiteratures } = useLiteratureOperations();
    const { loadCollections } = useCollectionOperations();
    const { getPaperSummary } = usePaperCatalog();

    const [graphId, setGraphId] = useState<string | null>(null);
    const [visibleIds, setVisibleIds] = useState<string[]>([]);

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
            <MainLayout headerTitle="图谱编辑" showSidebar={true}>
                <div className="p-4">
                    <div className="grid grid-cols-12 gap-4">
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
                                limit={12}
                                onVisibleIdsChange={setVisibleIds}
                                showPagination={true}
                                showControls={true}
                            />
                        </div>
                    </div>
                </div>
            </MainLayout>
        </RequireAuth>
    );
}


