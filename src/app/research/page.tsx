'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { MainLayout, ProtectedLayout } from '@/components/layout';
import { Button, Card, CardContent, Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui';
import { useSessionStore } from '@/features/session/data-access/session-store';
import { useAuthStore } from '@/stores/auth.store';
import { commandBus } from '@/features/session/runtime/command-bus';
import { Plus, MessagesSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SessionList } from '@/features/session/ui/SessionList';
// Bootstrap orchestrators to ensure command handlers are ready before first user interaction
import '@/features/session/runtime/orchestrator/bootstrap-orchestrators';

export default function ResearchPage() {
    const router = useRouter();
    const pathname = usePathname();
    const loadAllSessions = useSessionStore(s => s.loadAllSessions);
    const getSessions = useSessionStore(s => s.getSessions);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => { void loadAllSessions().then(() => setHydrated(true)); }, [loadAllSessions]);
    // Re-load sessions when user changes
    useEffect(() => {
        let prevUserId = useAuthStore.getState().currentUser?.id;
        const unsub = useAuthStore.subscribe((state) => {
            const uid = state.currentUser?.id;
            if (uid !== prevUserId) {
                prevUserId = uid;
                try { console.debug('[ui][research_page][user_changed]', { userId: uid }); } catch { /* noop */ }
                void loadAllSessions().then(() => setHydrated(true));
            }
        });
        return () => { unsub(); };
    }, [loadAllSessions]);
    const sessions = getSessions();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [titleDraft, setTitleDraft] = useState('');

    // 移动端会话列表 Sheet 状态
    const [mobileSessionsOpen, setMobileSessionsOpen] = useState(false);

    // 构建 Header 右侧内容
    const headerRightContent = (
        <Button
            variant="outline"
            size="sm"
            className="md:hidden"
            onClick={() => setMobileSessionsOpen(true)}
        >
            <MessagesSquare className="w-4 h-4 mr-2" />
            会话列表
        </Button>
    );

    // 自动跳转到最近会话
    useEffect(() => {
        if (!hydrated) return;
        const list = getSessions();
        try { console.debug('[ui][research_page][auto_redirect_check]', { hydrated, count: list.length }); } catch { /* noop */ }
        if (list.length > 0) {
            router.replace(`/research/${list[0].id}`);
        }
    }, [hydrated, getSessions, router]);

    const createSession = async () => {
        const id = crypto.randomUUID();
        try { console.debug('[ui][research_page][create_session_click]', { id }); } catch { /* noop */ }
        await commandBus.dispatch({ id: crypto.randomUUID(), type: 'CreateSession', ts: Date.now(), sessionId: id, params: { title: '未命名研究' } } as any);
        router.push(`/research/${id}`);
    };

    return (
        <ProtectedLayout>
            <MainLayout showSidebar={true} showHeader={true} headerTitle="Research Navigator" headerRightContent={headerRightContent}>
                <div className="h-full flex">
                    {/* 子侧边栏：会话列表（桌面端显示，移动端隐藏） */}
                    <div className="hidden md:block w-64 border-r bg-background p-3">
                        <SessionList />
                    </div>
                    {/* 主区域 */}
                    <div className="flex-1 p-6">
                        <Card>
                            <CardContent className="p-6 text-sm text-muted-foreground">
                                <div className="hidden md:block">
                                    {hydrated ? '选择左侧一个会话或点击"新建会话"开始研究讨论。' : '正在加载会话…'}
                                </div>
                                <div className="md:hidden text-center">
                                    {hydrated ? '点击右上角"会话列表"查看或创建研究会话。' : '正在加载会话…'}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* 移动端会话列表 Sheet */}
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
            </MainLayout>
        </ProtectedLayout>
    );
}


