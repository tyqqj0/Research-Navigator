'use client';

import React, { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { MainLayout } from '@/components/layout';
import { Button } from '@/components/ui';
import { ChatPanel } from '@/features/session/ui/ChatPanel';
import { SessionCollectionPanel } from '@/features/session/ui/SessionCollectionPanel';
import { GraphCanvas } from '@/features/graph/editor/canvas/GraphCanvas';
import { LiteratureDetailPanel } from '@/features/literature/management/components/LiteratureDetailPanel';
import { usePaperCatalog } from '@/features/graph/editor/paper-catalog';
// 激活 orchestrators
import '@/features/session/runtime/orchestrator/chat.orchestrator';
import '@/features/session/runtime/orchestrator/direction.orchestrator';
import '@/features/session/runtime/orchestrator/collection.orchestrator';
import '@/features/session/runtime/orchestrator/report.orchestrator';
import { startDirectionSupervisor } from '@/features/session/runtime/orchestrator/direction.supervisor';
import { startCollectionSupervisor } from '@/features/session/runtime/orchestrator/collection.supervisor';
import { startTitleSupervisor } from '@/features/session/runtime/orchestrator/title.supervisor';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SessionList } from '@/features/session/ui/SessionList';
import { useSessionStore } from '@/features/session/data-access/session-store';
import { commandBus } from '@/features/session/runtime/command-bus';
import { useLiteratureOperations } from '@/features/literature/hooks/use-literature-operations';
import { useCollectionOperations } from '@/features/literature/hooks/use-collection-operations';

export default function ResearchSessionPage() {
    const params = useParams<{ sessionId: string }>();
    const router = useRouter();
    const pathname = usePathname();
    const sessionId = params?.sessionId;
    const store = useSessionStore();
    useEffect(() => { if (sessionId) void Promise.all([store.loadAllSessions(), store.loadSessionProjection(sessionId)]); }, [sessionId]);

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
    const pageHeader = (
        <div className="px-6 py-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold" title={`ID: ${sessionId}`}>{displayTitle}</h2>
        </div>
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
        <MainLayout showSidebar={true} showHeader={false} pageHeader={pageHeader}>
            <div className="h-full flex relative">
                {/* 子侧边栏：会话列表 */}
                <div className="w-60 border-r bg-background p-3 h-[calc(100vh-4rem)]"><SessionList /></div>

                {/* 动态布局：根据阶段和用户开关决定单列/三列，并带过渡动画 */}
                <DynamicSessionBody sessionId={sessionId!} getPaperSummary={getPaperSummary} graphId={graphId} onOpenDetail={openDetail} />
            </div>
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

    return (
        <div className="h-full flex-1 p-4">
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
                        <GraphCanvas
                            graphId={graphId}
                            getPaperSummary={getPaperSummary}
                            layoutMode="timeline"
                            height={'calc(100vh - 5rem)'}
                            onNodeOpenDetail={(pid) => onOpenDetail(pid)}
                        />
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
    );
}


