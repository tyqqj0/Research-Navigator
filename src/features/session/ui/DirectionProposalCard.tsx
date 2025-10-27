"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StreamCard } from '@/components/ui/stream-card';
import { Markdown } from '@/components/ui/markdown';

interface DirectionProposalCardProps { sessionId: string; content: string; status?: 'streaming' | 'done' | 'error' | 'aborted' }

export const DirectionProposalCard: React.FC<DirectionProposalCardProps> = ({ sessionId, content, status = 'done' }) => {
    const title = status === 'streaming' ? '正在判定意图…' : '研究方向提案';
    return (
        <StreamCard
            title={title}
            status={status}
            headerVariant="blue"
            headerRight={status === 'streaming' ? (
                <Button size="sm" variant="ghost" onClick={() => import('@/features/session/runtime/command-bus').then(({ commandBus }) => commandBus.dispatch({ id: crypto.randomUUID(), type: 'StopStreaming', ts: Date.now(), params: { sessionId } } as any))}>停止</Button>
            ) : undefined}
            contentClassName="text-sm"
        >
            {status === 'streaming' ? (
                <div className="text-sm text-muted-foreground">正在分析您的输入是否足够明确，如需补充信息，将在下方给出具体问题。</div>
            ) : (
                <Markdown text={content} />
            )}
        </StreamCard>
    );
};

export default DirectionProposalCard;


