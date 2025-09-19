import { startTextStream } from '@/lib/ai/streaming/start';

export interface AssistantRun {
    abort(): void;
}

export const assistantExecutor = {
    start(opts: { messages: string[]; onStart: () => void; onDelta: (delta: string) => void; onDone: () => void; onAbort: (reason?: string) => void; onError: (msg: string) => void }): AssistantRun {
        const ctr = new AbortController();
        (async () => {
            try {
                opts.onStart();
                const stream = startTextStream({ messages: opts.messages }, { signal: ctr.signal });
                for await (const ev of stream) {
                    if (ev.type === 'delta') opts.onDelta(ev.text);
                    else if (ev.type === 'done') opts.onDone();
                    else if (ev.type === 'aborted') opts.onAbort(ev.reason);
                    else if (ev.type === 'error') opts.onError(ev.message);
                }
            } catch (e) {
                opts.onError((e as Error).message);
            }
        })();
        return { abort() { ctr.abort('user'); } };
    }
};


