'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { MainLayout } from '@/components/layout';
import { Button, Card, CardContent } from '@/components/ui';
import { useSessionStore } from '@/features/session/data-access/session-store';
import { commandBus } from '@/features/session/runtime/command-bus';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SessionList } from '@/features/session/ui/SessionList';

export default function ResearchPage() {
    const router = useRouter();
    const pathname = usePathname();
    const store = useSessionStore();
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => { void store.loadAllSessions().then(() => setHydrated(true)); }, []);
    const sessions = store.getSessions();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [titleDraft, setTitleDraft] = useState('');

    // 自动跳转到最近会话
    useEffect(() => {
        if (!hydrated) return;
        const list = store.getSessions();
        if (list.length > 0) {
            router.replace(`/research/${list[0].id}`);
        }
    }, [hydrated]);

    const createSession = async () => {
        const id = crypto.randomUUID();
        await commandBus.dispatch({ id: crypto.randomUUID(), type: 'CreateSession', ts: Date.now(), sessionId: id, params: { title: '未命名研究' } } as any);
        router.push(`/research/${id}`);
    };

    const pageHeader = (
        <div className="px-6 py-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">研究会话</h2>
        </div>
    );

    return (
        <MainLayout showSidebar={true} showHeader={false} pageHeader={pageHeader}>
            <div className="h-full flex">
                {/* 子侧边栏：会话列表 */}
                <div className="w-64 border-r bg-background p-3"><SessionList /></div>
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


