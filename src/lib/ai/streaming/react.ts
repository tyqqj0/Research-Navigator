"use client";
import { useCallback, useRef, useState } from 'react';
import type { StartArgs, StartOptions, TextStream, TextStreamEvent } from './index';
import { startTextStream } from './start';

export type StreamStatus = 'idle' | 'running' | 'done' | 'error' | 'aborted';

export function useTextStream() {
    const [status, setStatus] = useState<StreamStatus>('idle');
    const [text, setText] = useState('');
    const [error, setError] = useState<string | null>(null);
    const streamRef = useRef<TextStream | null>(null);

    const start = useCallback(async (args: StartArgs, options?: StartOptions) => {
        setStatus('running');
        setText('');
        setError(null);
        const stream = startTextStream(args, options);
        streamRef.current = stream;
        try {
            for await (const ev of stream as AsyncIterable<TextStreamEvent>) {
                if (ev.type === 'delta') setText((t) => t + ev.text);
                if (ev.type === 'error') { setError(ev.message); setStatus('error'); break; }
                if (ev.type === 'aborted') { setStatus('aborted'); break; }
                if (ev.type === 'done') { setStatus('done'); break; }
            }
        } catch (e: any) {
            setError(e?.message || 'stream failed');
            setStatus('error');
        }
    }, []);

    const abort = useCallback((reason?: string) => {
        try { streamRef.current?.abort(reason); } catch { /* ignore */ }
    }, []);

    const reset = useCallback(() => { setStatus('idle'); setText(''); setError(null); }, []);

    return { status, text, error, start, abort, reset } as const;
}


