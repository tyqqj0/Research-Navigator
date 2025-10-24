"use client";

import React, { useEffect, useState, useCallback } from 'react';
// import RequireAuth from '@/components/auth/RequireAuth'; // Replaced by ProtectedLayout
import { MainLayout, ProtectedLayout } from '@/components/layout';
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
import { cn } from '@/lib/utils';

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
    const [mobileTab, setMobileTab] = useState<'graphs' | 'canvas' | 'literature'>('canvas');

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
        <ProtectedLayout>
            <MainLayout headerTitle="图谱编辑" showSidebar={true} hideUserInfo={true}>
                <div className="p-4 h-full relative">
                    {/* 桌面端：三栏布局 */}
                    <div
                        className="hidden xl:grid gap-4 transition-all duration-300"
                        style={{
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

                    {/* 移动端：标签页切换模式 */}
                    <div className="xl:hidden h-[calc(100vh-8rem)] flex flex-col">
                        {/* 标签页导航 */}
                        <div className="shrink-0 flex border-b theme-border-primary theme-background-primary">
                            <button
                                onClick={() => setMobileTab('graphs')}
                                className={cn(
                                    'flex-1 px-2 py-2 text-sm font-medium transition-colors',
                                    mobileTab === 'graphs'
                                        ? 'border-b-2 border-blue-600 text-blue-600'
                                        : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                📊 图谱
                            </button>
                            <button
                                onClick={() => setMobileTab('canvas')}
                                className={cn(
                                    'flex-1 px-2 py-2 text-sm font-medium transition-colors',
                                    mobileTab === 'canvas'
                                        ? 'border-b-2 border-blue-600 text-blue-600'
                                        : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                🎨 画布
                            </button>
                            <button
                                onClick={() => setMobileTab('literature')}
                                className={cn(
                                    'flex-1 px-2 py-2 text-sm font-medium transition-colors',
                                    mobileTab === 'literature'
                                        ? 'border-b-2 border-blue-600 text-blue-600'
                                        : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                📚 文献
                            </button>
                        </div>

                        {/* 标签页内容 */}
                        <div className="flex-1 min-h-0 overflow-hidden">
                            {mobileTab === 'graphs' && (
                                <div className="h-full overflow-y-auto theme-background-primary p-2 space-y-4">
                                    <GraphPickerPanel onSelectGraph={(id) => { setGraphId(id); setMobileTab('canvas'); }} />
                                    {graphId && <GraphMetaPanel graphId={graphId} />}
                                </div>
                            )}

                            {mobileTab === 'canvas' && (
                                <div className="h-full flex flex-col theme-background-primary">
                                    <div className="shrink-0 p-2">
                                        <GraphToolbar graphId={graphId || undefined} />
                                    </div>
                                    <div className="flex-1 min-h-0">
                                        {graphId ? (
                                            store.getGraphById(graphId) && !graphLoading ? (
                                                <GraphCanvas
                                                    graphId={graphId}
                                                    getPaperSummary={getPaperSummary}
                                                    onNodeOpenDetail={(pid) => { setActivePaperId(pid); setDetailOpen(true); }}
                                                    layoutMode="timeline"
                                                    height="100%"
                                                />
                                            ) : (
                                                <div className="h-full grid place-items-center text-muted-foreground text-sm">
                                                    正在加载图谱...
                                                </div>
                                            )
                                        ) : (
                                            <div className="h-full grid place-items-center text-muted-foreground text-center px-4">
                                                <div>
                                                    <div className="text-base mb-2">请选择图谱</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        点击 "📊 图谱" 标签选择或新建图谱
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {mobileTab === 'literature' && (
                                <div className="h-full overflow-y-auto theme-background-primary p-2 space-y-4">
                                    <CollectionTreePanel onSelectCollection={handleSelectCollection} />
                                    <LiteratureListPanel
                                        onVisibleIdsChange={setVisibleIds}
                                        showPagination={true}
                                        showControls={true}
                                        onItemClick={(item) => { setActivePaperId(item.literature.paperId); setDetailOpen(true); }}
                                        contextCollectionId={null}
                                    />
                                </div>
                            )}
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
        </ProtectedLayout>
    );
}


