'use client';

import React, { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { MainLayout, ProtectedLayout } from '@/components/layout';
import { Button, Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui';
import { ChatPanel } from '@/features/session/ui/ChatPanel';
import { SessionCollectionPanel } from '@/features/session/ui/SessionCollectionPanel';
import { GraphCanvas } from '@/features/graph/editor/canvas/GraphCanvas';
import { GraphToolbar } from '@/features/graph/editor/canvas/GraphToolbar';
import { LiteratureDetailPanel } from '@/features/literature/management/components/LiteratureDetailPanel';
import { usePaperCatalog } from '@/features/graph/editor/paper-catalog';
// Bootstrap orchestrators to ensure command handlers are ready before first user interaction
import '@/features/session/runtime/orchestrator/bootstrap-orchestrators';
import { startDirectionSupervisor } from '@/features/session/runtime/orchestrator/direction.supervisor';
import { startCollectionSupervisor } from '@/features/session/runtime/orchestrator/collection.supervisor';
import { startTitleSupervisor } from '@/features/session/runtime/orchestrator/title.supervisor';
import { Plus, MessagesSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SessionList } from '@/features/session/ui/SessionList';
import { useSessionStore } from '@/features/session/data-access/session-store';
import { useAuthStore } from '@/stores/auth.store';
import { commandBus } from '@/features/session/runtime/command-bus';
import { useLiteratureOperations } from '@/features/literature/hooks/use-literature-operations';
import { useCollectionOperations } from '@/features/literature/hooks/use-collection-operations';
import { ArchiveManager } from '@/lib/archive/manager';

export default function ResearchSessionPage() {
    const params = useParams<{ sessionId: string }>();
    const router = useRouter();
    const pathname = usePathname();
    const sessionId = params?.sessionId;
    const store = useSessionStore();
    useEffect(() => { if (sessionId) void Promise.all([store.loadAllSessions(), store.loadSessionProjection(sessionId)]); }, [sessionId]);
    // Re-load when user changes to avoid stale cross-user state
    useEffect(() => {
        let prevUserId = useAuthStore.getState().currentUser?.id;
        const unsub = useAuthStore.subscribe((state) => {
            const uid = state.currentUser?.id;
            if (uid !== prevUserId) {
                prevUserId = uid;
                void Promise.all([store.loadAllSessions(), sessionId ? store.loadSessionProjection(sessionId) : Promise.resolve()]);
            }
        });
        return () => { unsub(); };
    }, [sessionId, store]);
    // Re-hydrate current session after archive switches to the logged-in user
    useEffect(() => {
        if (!sessionId) return;
        let unsub: (() => void) | undefined;
        try {
            unsub = ArchiveManager.subscribe((archiveId) => {
                try {
                    const uid = useAuthStore.getState().currentUser?.id;
                    if (uid && archiveId === uid) {
                        void Promise.all([
                            store.loadAllSessions(),
                            store.loadSessionProjection(sessionId)
                        ]);
                    }
                } catch { /* noop */ }
            });
        } catch { /* noop */ }
        return () => { try { unsub?.(); } catch { /* noop */ } };
    }, [sessionId, store]);

    const sessions = store.getSessions();
    // Ensure supervisors started once on client
    useEffect(() => { startDirectionSupervisor(); startCollectionSupervisor(); startTitleSupervisor(); }, []);

    const createSession = async () => {
        const id = crypto.randomUUID();
        await commandBus.dispatch({ id: crypto.randomUUID(), type: 'CreateSession', ts: Date.now(), sessionId: id, params: { title: '未命名研究' } } as any);
        router.push(`/research/${id}`);
    };

    const [editingId, setEditingId] = React.useState<string | null>(null);
    const [titleDraft, setTitleDraft] = React.useState('');

    const current = useSessionStore(state => state.sessions.get(sessionId!));
    const displayTitle = current?.title || '未命名研究';

    // 移动端会话列表 Sheet 状态
    const [mobileSessionsOpen, setMobileSessionsOpen] = React.useState(false);

    // 构建 Header 右侧内容（会话标题 + 切换按钮）
    const headerRightContent = (
        <>
            {/* 会话标题（桌面端显示） */}
            <div className="hidden md:block text-base font-medium theme-text-secondary" title={`ID: ${sessionId}`}>
                {displayTitle}
            </div>
            {/* 移动端会话切换按钮 */}
            <Button
                variant="outline"
                size="sm"
                className="md:hidden"
                onClick={() => setMobileSessionsOpen(true)}
            >
                <MessagesSquare className="w-4 h-4 mr-2" />
                切换会话
            </Button>
        </>
    );

    const { getPaperSummary } = usePaperCatalog();
    const { loadLiteratures } = useLiteratureOperations();
    const { loadCollections } = useCollectionOperations();
    // 确保刷新后加载用户文献/集合，以便时间线/集合面板可用
    useEffect(() => {
        void loadLiteratures({ force: false });
        void loadCollections({ force: false });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // current already defined above
    const graphId = (current?.meta as any)?.graphId;

    const [detailOpen, setDetailOpen] = React.useState(false);
    const [activePaperId, setActivePaperId] = React.useState<string | undefined>(undefined);

    const openDetail = React.useCallback((paperId?: string) => {
        if (!paperId) return;
        setActivePaperId(paperId);
        setDetailOpen(true);
    }, []);

    React.useEffect(() => {
        if (!detailOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDetailOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => { window.removeEventListener('keydown', onKey); };
    }, [detailOpen]);

    return (
        <ProtectedLayout>
            <MainLayout showSidebar={true} showHeader={true} headerTitle="Research Navigator" headerRightContent={headerRightContent}>
                {/* 动态布局：根据阶段和用户开关决定单列/三列，并带过渡动画 */}
                <DynamicSessionBody sessionId={sessionId!} getPaperSummary={getPaperSummary} graphId={graphId} onOpenDetail={openDetail} />

                {/* 移动端会话列表 Sheet（保留移动端切换入口） */}
                <Sheet open={mobileSessionsOpen} onOpenChange={setMobileSessionsOpen}>
                    <SheetContent side="bottom" className="h-[85vh] p-0">
                        <SheetHeader className="p-6 pb-4">
                            <SheetTitle>研究会话</SheetTitle>
                        </SheetHeader>
                        <div
                            className="px-6 pb-6 h-[calc(100%-5rem)] overflow-y-auto"
                            onClick={(e) => {
                                // 点击会话链接后自动关闭 Sheet
                                const target = e.target as HTMLElement;
                                if (target.closest('a[href^="/research/"]')) {
                                    setMobileSessionsOpen(false);
                                }
                            }}
                        >
                            <SessionList />
                        </div>
                    </SheetContent>
                </Sheet>

                {/* 右侧上层覆盖的文献详情 Overlay：保持挂载以获得过渡动画 */}
                <LiteratureDetailPanel
                    open={detailOpen}
                    onOpenChange={setDetailOpen}
                    paperId={activePaperId}
                    onUpdated={() => { }}
                    variant="overlay"
                    defaultCollectionId={current?.linkedCollectionId || undefined}
                />

            </MainLayout>
        </ProtectedLayout>
    );
}

function DynamicSessionBody({ sessionId, getPaperSummary, graphId, onOpenDetail }: { sessionId: string; getPaperSummary: any; graphId: any; onOpenDetail: (paperId: string) => void }) {
    const s = useSessionStore(state => state.sessions.get(sessionId));
    const stage = (s?.meta as any)?.stage as string | undefined;
    const meta = (s?.meta as any) || {};
    const defaultOpen = stage === 'collection' || stage === 'reporting';
    const metaOpen = meta.graphPanelOpen;
    // 固定 open 判定逻辑，确保阶段切换后也触发布局过渡
    const open = typeof metaOpen === 'boolean' ? metaOpen : defaultOpen;
    // 监听阶段变化的时间戳，让网格在阶段变更时也走一遍过渡
    const stageChangedAt = meta.stageChangedAt as number | undefined;
    // 用一个无意义的 style 变量绑定时间戳，使 React 在变更时应用 transition
    const stageKeyStyle = { ['--stageKey' as any]: (stageChangedAt || 0) as unknown as string } as React.CSSProperties;

    // 移动端标签页状态（对话/图谱/集合）
    const [mobileTab, setMobileTab] = React.useState<'chat' | 'graph' | 'collection'>('chat');

    return (
        <>
            {/* 桌面端：三列网格布局（保留原有逻辑） */}
            <div className="hidden md:block h-full flex-1 p-4">
                <div
                    className="h-[calc(100vh-5rem)] grid"
                    style={{
                        gridTemplateColumns: open ? '1.2fr 1.6fr 0.6fr' : '1fr 0fr 0fr',
                        gap: open ? '1rem' : '0rem',
                        transition: 'grid-template-columns 300ms ease-in-out, gap 300ms ease-in-out',
                        ...stageKeyStyle
                    }}
                >
                    {/* 左：对话栏 */}
                    <div className="min-w-0">
                        <ChatPanel sessionId={sessionId} onOpenDetail={onOpenDetail} />
                    </div>

                    {/* 中：图谱 */}
                    <div
                        className={cn('min-w-0 overflow-hidden')}
                        style={{
                            opacity: open ? 1 : 0,
                            transform: open ? 'none' : 'translateX(8px)',
                            pointerEvents: open ? 'auto' : 'none',
                            transition: 'opacity 300ms ease-in-out, transform 300ms ease-in-out'
                        }}
                        aria-hidden={!open}
                    >
                        {graphId ? (
                            <>
                                <div className="p-2">
                                    <GraphToolbar graphId={graphId || undefined} />
                                </div>
                                <GraphCanvas
                                    graphId={graphId}
                                    getPaperSummary={getPaperSummary}
                                    layoutMode="timeline"
                                    height={'calc(100vh - 5rem - 40px)'}
                                    onNodeOpenDetail={(pid) => onOpenDetail(pid)}
                                />
                            </>
                        ) : (
                            <div className="h-full grid place-items-center text-muted-foreground">尚未生成图谱</div>
                        )}
                    </div>

                    {/* 右：集合列表 */}
                    <div
                        className={cn('min-w-0 overflow-hidden')}
                        style={{
                            opacity: open ? 1 : 0,
                            transform: open ? 'none' : 'translateX(8px)',
                            pointerEvents: open ? 'auto' : 'none',
                            transition: 'opacity 300ms ease-in-out, transform 300ms ease-in-out'
                        }}
                        aria-hidden={!open}
                    >
                        <SessionCollectionPanel sessionId={sessionId} onOpenDetail={onOpenDetail} />
                    </div>
                </div>
            </div>

            {/* 移动端：标签页切换模式 */}
            <div className="md:hidden h-[calc(100vh-5rem)] flex flex-col">
                {/* 标签页导航 */}
                <div className="shrink-0 flex border-b theme-border-primary theme-background-primary">
                    <button
                        onClick={() => setMobileTab('chat')}
                        className={cn(
                            'flex-1 px-3 py-2 text-sm font-medium transition-colors',
                            mobileTab === 'chat'
                                ? 'border-b-2 border-blue-600 text-blue-600'
                                : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        💬 对话
                    </button>
                    <button
                        onClick={() => setMobileTab('graph')}
                        className={cn(
                            'flex-1 px-3 py-2 text-sm font-medium transition-colors',
                            mobileTab === 'graph'
                                ? 'border-b-2 border-blue-600 text-blue-600'
                                : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        🌐 图谱
                    </button>
                    <button
                        onClick={() => setMobileTab('collection')}
                        className={cn(
                            'flex-1 px-3 py-2 text-sm font-medium transition-colors',
                            mobileTab === 'collection'
                                ? 'border-b-2 border-blue-600 text-blue-600'
                                : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        📚 集合
                    </button>
                </div>

                {/* 标签页内容（全屏显示） */}
                <div className="flex-1 min-h-0 p-2">
                    {mobileTab === 'chat' && (
                        <ChatPanel sessionId={sessionId} onOpenDetail={onOpenDetail} />
                    )}
                    {mobileTab === 'graph' && (
                        <div className="h-full flex flex-col">
                            {graphId ? (
                                <>
                                    <div className="shrink-0 p-2">
                                        <GraphToolbar graphId={graphId || undefined} />
                                    </div>
                                    <div className="flex-1 min-h-0">
                                        <GraphCanvas
                                            graphId={graphId}
                                            getPaperSummary={getPaperSummary}
                                            layoutMode="timeline"
                                            height={'100%'}
                                            onNodeOpenDetail={(pid) => onOpenDetail(pid)}
                                        />
                                    </div>
                                </>
                            ) : (
                                <div className="h-full grid place-items-center text-muted-foreground text-center px-4">
                                    尚未生成图谱<br />
                                    <span className="text-xs mt-2">在对话中提出研究问题后，系统会自动生成知识图谱</span>
                                </div>
                            )}
                        </div>
                    )}
                    {mobileTab === 'collection' && (
                        <SessionCollectionPanel sessionId={sessionId} onOpenDetail={onOpenDetail} />
                    )}
                </div>
            </div>
        </>
    );
}

