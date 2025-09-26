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
import { useGraphStore } from '@/features/graph/data-access';

export default function GraphPage() {
    const store = useGraphStore();
    const { loadLiteratures } = useLiteratureOperations();
    const { loadCollections } = useCollectionOperations();
    const { getPaperSummary } = usePaperCatalog();

    const [graphId, setGraphId] = useState<string | null>(null);
    const [graphLoading, setGraphLoading] = useState(false);
    const [visibleIds, setVisibleIds] = useState<string[]>([]);
    const [detailOpen, setDetailOpen] = useState(false);
    const [activePaperId, setActivePaperId] = useState<string | undefined>(undefined);

    useEffect(() => {
        loadLiteratures({ force: false }).catch(() => { });
        loadCollections({ force: false }).catch(() => { });
        // We only need to load once on mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Esc 关闭 overlay
    useEffect(() => {
        if (!detailOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDetailOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => { window.removeEventListener('keydown', onKey); };
    }, [detailOpen]);

    // load selected graph explicitly to avoid No target graph after refresh
    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            if (!graphId) return;
            // already loaded?
            if (store.getGraphById(graphId)) return;
            setGraphLoading(true);
            try {
                await store.loadGraph(graphId);
            } catch {
                // noop
            } finally {
                if (!cancelled) setGraphLoading(false);
            }
        };
        void run();
        return () => { cancelled = true; };
    }, [graphId, store.getGraphById, store.loadGraph]);

    const handleSelectCollection = useCallback((collectionId: string | null) => {
        // LiteratureListPanel manages its own filtering
    }, []);

    return (
        <RequireAuth>
            <MainLayout headerTitle="图谱编辑" showSidebar={true} hideUserInfo={true}>
                <div className="p-4 h-full relative">
                    {/* 使用 grid 并通过自定义比例分配三栏宽度 */}
                    <div
                        className={`grid gap-4 transition-all duration-300`}
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 2.5fr 1.5fr', // 左:中:右 = 1:2.5:1.5
                        }}
                    >
                        <div className="space-y-4">
                            <GraphPickerPanel onSelectGraph={setGraphId} />
                            {graphId && <GraphMetaPanel graphId={graphId} />}
                        </div>

                        <div className="space-y-3">
                            <Card>
                                <CardHeader className="py-2">
                                    <CardTitle className="text-sm">Canvas</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="p-2">
                                        <GraphToolbar graphId={graphId || undefined} />
                                    </div>
                                    <div className="h-[70vh]">
                                        {graphId ? (
                                            store.getGraphById(graphId) && !graphLoading ? (
                                                <GraphCanvas
                                                    graphId={graphId}
                                                    getPaperSummary={getPaperSummary}
                                                    onNodeOpenDetail={(pid) => { setActivePaperId(pid); setDetailOpen(true); }}
                                                    layoutMode="timeline"
                                                />
                                            ) : (
                                                <div className="h-full grid place-items-center text-muted-foreground text-sm">
                                                    正在加载图谱...
                                                </div>
                                            )
                                        ) : (
                                            <div className="h-full grid place-items-center text-muted-foreground">
                                                请选择左侧图谱，或新建一个
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="space-y-4">
                            <CollectionTreePanel onSelectCollection={handleSelectCollection} />
                            <LiteratureListPanel
                                onVisibleIdsChange={setVisibleIds}
                                showPagination={true}
                                showControls={true}
                                onItemClick={(item) => { setActivePaperId(item.literature.paperId); setDetailOpen(true); }}
                                contextCollectionId={null}
                            />
                        </div>
                    </div>
                    {/* 右侧详情 Overlay：保持挂载以获得过渡动画 */}
                    <LiteratureDetailPanel
                        open={detailOpen}
                        onOpenChange={setDetailOpen}
                        paperId={activePaperId}
                        onUpdated={() => { }}
                        variant="overlay"
                        defaultCollectionId={undefined}
                    />
                </div>
            </MainLayout>
        </RequireAuth>
    );
}


