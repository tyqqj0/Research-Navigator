'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { MainLayout } from '@/components/layout';
import { Button } from '@/components/ui';
import { ChatPanel } from '@/features/session/ui/ChatPanel';
import { SessionCollectionPanel } from '@/features/session/ui/SessionCollectionPanel';
import { GraphCanvas } from '@/features/graph/editor/canvas/GraphCanvas';
import { usePaperCatalog } from '@/features/graph/editor/paper-catalog';
// 激活 orchestrators
import '@/features/session/runtime/orchestrator/chat.orchestrator';
import '@/features/session/runtime/orchestrator/direction.orchestrator';
import '@/features/session/runtime/orchestrator/collection.orchestrator';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ResearchSessionPage() {
    const params = useParams<{ sessionId: string }>();
    const router = useRouter();
    const pathname = usePathname();
    const sessionId = params?.sessionId;

    const sessions = useMemo(() => (
        [
            { id: 'session-a1', title: '关于Transformer在医学影像中的应用' },
            { id: 'session-b2', title: 'LLM驱动的文献综述起草' },
            { id: 'session-c3', title: '科研方法论与实验设计探讨' },
        ]
    ), []);

    const createSession = () => {
        const id = Math.random().toString(36).slice(2, 10);
        router.push(`/research/${id}`);
    };

    const pageHeader = (
        <div className="px-6 py-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">研究会话 - {sessionId}</h2>
            <Button size="sm" onClick={createSession}>
                <Plus className="w-4 h-4 mr-2" /> 新建会话
            </Button>
        </div>
    );

    const { getPaperSummary } = usePaperCatalog();
    const graphId = undefined as any; // 后续与编排器打通

    return (
        <MainLayout showSidebar={true} showHeader={false} pageHeader={pageHeader}>
            <div className="h-full flex">
                {/* 子侧边栏：会话列表 */}
                <div className="w-64 border-r bg-background p-3">
                    <div className="text-xs text-muted-foreground mb-2 px-1">会话</div>
                    <div className="space-y-1">
                        {sessions.map(s => (
                            <Link
                                key={s.id}
                                href={`/research/${s.id}`}
                                className={cn(
                                    'block text-sm rounded-md px-3 py-2 hover:bg-accent',
                                    pathname === `/research/${s.id}` && 'bg-accent'
                                )}
                            >
                                {s.title}
                            </Link>
                        ))}
                    </div>
                </div>

                {/* 三栏：左聊/中图/右列 */}
                <div className="h-full flex-1 grid grid-cols-12 gap-4 p-4">
                    <div className="col-span-12 md:col-span-3 h-[70vh]"><ChatPanel sessionId={sessionId!} /></div>
                    <div className="col-span-12 md:col-span-6 h-[70vh]">
                        {graphId ? (
                            <GraphCanvas graphId={graphId} getPaperSummary={getPaperSummary} layoutMode="timeline" />
                        ) : (
                            <div className="h-full grid place-items-center text-muted-foreground">尚未生成图谱</div>
                        )}
                    </div>
                    <div className="col-span-12 md:col-span-3 h-[70vh]"><SessionCollectionPanel sessionId={sessionId!} /></div>
                </div>
            </div>
        </MainLayout>
    );
}


