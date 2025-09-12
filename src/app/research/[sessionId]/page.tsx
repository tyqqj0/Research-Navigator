'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { MainLayout } from '@/components/layout';
import { Button, Card, CardContent, Input } from '@/components/ui';
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

                {/* 聊天区域 */}
                <div className="h-full flex-1 flex flex-col">
                    {/* 聊天消息区 */}
                    <div className="flex-1 overflow-auto p-6">
                        <div className="max-w-4xl mx-auto space-y-4">
                            {/* AI 欢迎消息 */}
                            <div className="flex space-x-3">
                                <div className="flex-shrink-0">
                                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                        </svg>
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <Card>
                                        <CardContent className="p-4">
                                            <p className="text-sm">
                                                您好！这是会话 {sessionId}。请描述您的研究主题或任务，我会协助您推进研究。
                                            </p>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 输入区域 */}
                    <div className="border-t bg-white dark:bg-gray-900 p-4">
                        <div className="max-w-4xl mx-auto">
                            <div className="flex space-x-4">
                                <Input
                                    placeholder="输入您的问题..."
                                    className="flex-1"
                                />
                                <Button>发送</Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}


