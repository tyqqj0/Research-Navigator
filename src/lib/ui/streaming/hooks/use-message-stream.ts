"use client";

import React from 'react';
import { useSessionStore } from '@/features/session/data-access/session-store';

export function useMessageStream(input: { sessionId: string; messageId: string }) {
    const { sessionId, messageId } = input;
    const getMessages = useSessionStore(s => s.getMessages);
    const messages = getMessages(sessionId);
    const memo = React.useMemo(() => {
        const m = (messages || []).find(x => x.id === messageId);
        const text = m?.content || '';
        const status = (m as any)?.status as 'streaming' | 'done' | 'error' | 'aborted' | undefined;
        const running = status === 'streaming';
        return { text, status, running } as const;
    }, [messages, messageId]);
    return memo;
}


