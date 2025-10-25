'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { MainLayout, ProtectedLayout } from '@/components/layout';
import { Button, Card, CardContent, Sheet, SheetContent, SheetHeader, SheetTitle, Input } from '@/components/ui';
import { useSessionStore } from '@/features/session/data-access/session-store';
import { useAuthStore } from '@/stores/auth.store';
import { commandBus } from '@/features/session/runtime/command-bus';
import { Plus, MessagesSquare } from 'lucide-react';
import { UserMenu } from '@/components/auth/UserMenu';
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
        <div className="flex items-center gap-2">
            <Button
                variant="outline"
                size="sm"
                className="md:hidden"
                onClick={() => setMobileSessionsOpen(true)}
            >
                <MessagesSquare className="w-4 h-4 mr-2" />
                会话列表
            </Button>
            {/* 主页右上角显示头像（桌面端可见） */}
            <UserMenu className="hidden md:inline-flex" expandDirection="bottom" align="end" />
        </div>
    );

    // 移除自动跳转，改为英雄区输入创建会话

    const createSession = async () => {
        const id = crypto.randomUUID();
        try { console.debug('[ui][research_page][create_session_click]', { id }); } catch { /* noop */ }
        await commandBus.dispatch({ id: crypto.randomUUID(), type: 'CreateSession', ts: Date.now(), sessionId: id, params: { title: '未命名研究' } } as any);
        router.push(`/research/${id}`);
    };

    const [topic, setTopic] = useState('');

    const createSessionFromTopic = async () => {
        const id = crypto.randomUUID();
        const title = topic.trim() || '未命名研究';
        try { console.debug('[ui][research_page][create_session_from_topic]', { id, title }); } catch { /* noop */ }
        await commandBus.dispatch({ id: crypto.randomUUID(), type: 'CreateSession', ts: Date.now(), sessionId: id, params: { title } } as any);
        router.push(`/research/${id}`);
    };

    return (
        <ProtectedLayout>
            <MainLayout showSidebar={true} showHeader={true} headerTitle="Research Navigator" headerRightContent={headerRightContent}>
                <div className="h-full flex items-center justify-center p-6">
                    <div className="w-full max-w-3xl">
                        <Card className="backdrop-blur-sm bg-background/60 dark:bg-neutral-950/50 shadow-lg border border-border/50 rounded-2xl">
                            <CardContent className="p-8">
                                <div className="text-center mb-6">
                                    <div className="text-2xl font-semibold mb-2">开始新的研究</div>
                                    <div className="text-sm text-muted-foreground">描述你的研究主题或问题，我们会为你创建一个新会话</div>
                                </div>
                                <div className="flex gap-2">
                                    <Input
                                        value={topic}
                                        onChange={(e) => setTopic(e.target.value)}
                                        placeholder="例如：大型语言模型在生物医学信息抽取中的应用挑战？"
                                        className="h-12 rounded-xl"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                void createSessionFromTopic();
                                            }
                                        }}
                                    />
                                    <Button className="h-12 rounded-xl px-6" onClick={() => void createSessionFromTopic()}>开始研究</Button>
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


