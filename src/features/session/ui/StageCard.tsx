"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { StreamCard } from '@/components/ui/stream-card';
import type { SessionId } from '../data-access/types';
import { commandBus } from '@/features/session/runtime/command-bus';

type StageStatus = 'idle' | 'streaming' | 'done' | 'error' | 'aborted';

interface StageCardProps {
    sessionId: SessionId;
    stage: 'outline' | 'expand' | 'abstract';
    messageId?: string;
    title: string;
    status?: StageStatus;
    headerVariant?: React.ComponentProps<typeof StreamCard> extends infer T
    ? T extends { headerVariant?: infer V } ? V : never
    : never;
    className?: string;
    contentClassName?: string;
    footer?: React.ReactNode;
    children?: React.ReactNode;
}

export const StageCard: React.FC<StageCardProps> = ({
    sessionId,
    stage,
    messageId,
    title,
    status = 'idle',
    headerVariant = 'purple',
    className,
    contentClassName,
    footer,
    children,
}) => {
    const onStop = React.useCallback(async () => {
        await commandBus.dispatch({ id: crypto.randomUUID(), type: 'StopReport', ts: Date.now(), params: { sessionId } } as any);
    }, [sessionId]);

    const onRetry = React.useCallback(async () => {
        await commandBus.dispatch({ id: crypto.randomUUID(), type: 'RegenerateReportStage', ts: Date.now(), params: { sessionId, stage, messageId } } as any);
    }, [sessionId, stage, messageId]);

    const onResume = React.useCallback(async () => {
        await commandBus.dispatch({ id: crypto.randomUUID(), type: 'ResumeReport', ts: Date.now(), params: { sessionId, messageId } } as any);
    }, [sessionId, messageId]);

    const headerRight = (() => {
        if (status === 'streaming') {
            return (
                <Button size="sm" variant="ghost" onClick={onStop}>停止</Button>
            );
        }
        if (status === 'aborted') {
            return (
                <div className="flex items-center gap-2">
                    <Button size="sm" variant="secondary" onClick={onRetry}>重试</Button>
                    <Button size="sm" variant="ghost" onClick={onResume}>继续</Button>
                </div>
            );
        }
        if (status === 'error') {
            return (
                <Button size="sm" variant="secondary" onClick={onRetry}>重试</Button>
            );
        }
        return undefined;
    })();

    return (
        <StreamCard
            title={title}
            status={status}
            headerVariant={headerVariant as any}
            headerRight={headerRight}
            className={className}
            contentClassName={contentClassName}
            footer={footer}
        >
            {children}
        </StreamCard>
    );
};

export default StageCard;


