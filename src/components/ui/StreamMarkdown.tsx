"use client";

import React from 'react';
import { Markdown } from '@/components/ui/markdown';
import { useMessageStream } from '@/lib/ui/streaming/hooks/use-message-stream';

type Source =
    | { type: 'message'; sessionId: string; messageId: string }
    | { type: 'inline'; text: string; running?: boolean }
    | { type: 'selector'; get: () => { text: string; running: boolean } };

export function StreamMarkdown({ source, className, pendingHint }: { source: Source; className?: string; pendingHint?: string }) {
    const data = (() => {
        if (source.type === 'message') return useMessageStream({ sessionId: source.sessionId, messageId: source.messageId });
        if (source.type === 'inline') return { text: source.text, running: !!source.running, status: source.running ? 'streaming' : 'done' } as const;
        const v = source.get();
        return { text: v.text, running: v.running, status: v.running ? 'streaming' : 'done' } as const;
    })();

    const hint = typeof pendingHint === 'string' ? pendingHint : '⏳ 正在生成…';
    const pending = data.running && !data.text ? hint : '';
    const text = data.text || pending;
    return <Markdown text={text} className={className} />;
}

export default StreamMarkdown;


