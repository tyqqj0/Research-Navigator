'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { MainLayout } from '@/components/layout';
import { Button, Card, CardContent, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Input } from '@/components/ui';
import { useSessionStore } from '@/features/session/data-access/session-store';
import { commandBus } from '@/features/session/runtime/command-bus';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ResearchPage() {
    const router = useRouter();
    const pathname = usePathname();
    const store = useSessionStore();
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => { void store.loadAllSessions().then(() => setHydrated(true)); }, []);
    const sessions = store.getSessions();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [titleDraft, setTitleDraft] = useState('');

    const createSession = async () => {
        const id = crypto.randomUUID();
        await commandBus.dispatch({ id: crypto.randomUUID(), type: 'CreateSession', ts: Date.now(), sessionId: id, params: { title: '未命名研究' } } as any);
        router.push(`/research/${id}`);
    };

    const pageHeader = (
        <div className="px-6 py-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">研究会话</h2>
            <Button size="sm" onClick={createSession}>
                <Plus className="w-4 h-4 mr-2" /> 新建会话
            </Button>
        </div>
    );

    return (
        <MainLayout showSidebar={true} showHeader={false} pageHeader={pageHeader}>
            <div className="h-full flex">
                {/* 子侧边栏：会话列表 */}
                <div className="w-64 border-r bg-background p-3">
                    <div className="text-xs text-muted-foreground mb-2 px-1">会话</div>
                    <div className="space-y-1">
                        {sessions.map(s => (
                            <div key={s.id} className="group flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent">
                                <Link
                                    href={`/research/${s.id}`}
                                    className={cn('flex-1 block text-sm px-1 py-1 rounded-md', pathname === `/research/${s.id}` && 'bg-accent')}
                                >
                                    {editingId === s.id ? (
                                        <Input autoFocus value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} onBlur={async () => { if (titleDraft.trim()) await commandBus.dispatch({ id: crypto.randomUUID(), type: 'RenameSession', ts: Date.now(), params: { sessionId: s.id, title: titleDraft.trim() } } as any); setEditingId(null); }} />
                                    ) : (
                                        s.title || '未命名研究'
                                    )}
                                </Link>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 px-2">···</button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => { setEditingId(s.id); setTitleDraft(s.title || ''); }}>重命名</DropdownMenuItem>
                                        <DropdownMenuItem className="text-red-600" onClick={async () => { await store.removeSession(s.id); }}>删除</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        ))}
                    </div>
                </div>
                {/* 主区域 */}
                <div className="flex-1 p-6">
                    <Card>
                        <CardContent className="p-6 text-sm text-muted-foreground">
                            {hydrated ? '选择左侧一个会话或点击“新建会话”开始研究讨论。' : '正在加载会话…'}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </MainLayout>
    );
}


