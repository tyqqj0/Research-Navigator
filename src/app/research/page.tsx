'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { MainLayout } from '@/components/layout';
import { Button, Card, CardContent } from '@/components/ui';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ResearchPage() {
    const router = useRouter();
    const pathname = usePathname();

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
                {/* 主区域 */}
                <div className="flex-1 p-6">
                    <Card>
                        <CardContent className="p-6 text-sm text-muted-foreground">
                            选择左侧一个会话或点击“新建会话”开始研究讨论。
                        </CardContent>
                    </Card>
                </div>
            </div>
        </MainLayout>
    );
}


