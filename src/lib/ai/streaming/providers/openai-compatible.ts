import type { ProviderAdapter, TextStream, TextStreamEvent } from '../index';

function makeTextStream(controller: AbortController, reader: ReadableStreamDefaultReader<Uint8Array>, batchingMs: number | undefined): TextStream {
    let aborted = false;
    const encoder = new TextDecoder();

    async function* iterator(): AsyncGenerator<TextStreamEvent> {
        yield { type: 'start' } as const;
        let buffer = '';
        let pending = '';
        let lastEmit = Date.now();

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const text = encoder.decode(value, { stream: true });
                buffer += text;

                // SSE line-based parse
                const lines = buffer.split(/\r?\n/);
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (!line.startsWith('data:')) continue;
                    const data = line.slice(5).trim();
                    if (!data) continue;
                    if (data === '[DONE]') {
                        // flush remaining
                        if (pending.length > 0) {
                            const chunk = pending; pending = '';
                            yield { type: 'delta', text: chunk } as const;
                        }
                        yield { type: 'done' } as const;
                        return;
                    }
                    try {
                        const json = JSON.parse(data);
                        // OpenAI-like delta path: choices[0].delta.content or choices[0].text
                        const token = json?.choices?.[0]?.delta?.content
                            ?? json?.choices?.[0]?.text
                            ?? '';
                        if (typeof token === 'string' && token.length) {
                            if (batchingMs && batchingMs > 0) {
                                pending += token;
                                const now = Date.now();
                                if (now - lastEmit >= batchingMs) {
                                    const chunk = pending; pending = '';
                                    yield { type: 'delta', text: chunk } as const;
                                    lastEmit = now;
                                }
                            } else {
                                yield { type: 'delta', text: token } as const;
                            }
                        }
                    } catch {
                        // ignore malformed json line
                    }
                }
            }
            // stream closed by server, flush any pending
            if (pending.length > 0) {
                const chunk = pending; pending = '';
                yield { type: 'delta', text: chunk } as const;
            }
            yield { type: 'done' } as const;
        } catch (e: any) {
            if (aborted) {
                yield { type: 'aborted', reason: 'aborted' } as const;
            } else {
                yield { type: 'error', message: e?.message || 'stream error' } as const;
            }
        }
    }

    return {
        [Symbol.asyncIterator]() { return iterator(); },
        abort(reason?: string) { aborted = true; try { controller.abort(reason); } catch { /* ignore */ } },
    } as TextStream;
}

function buildEndpointUrl(baseURL?: string): string {
    const fallback = 'https://api.openai.com/v1/chat/completions';
    const b = (baseURL || '').replace(/\/+$/, '');
    if (!b) return fallback;
    // If already points to an endpoint, keep as-is
    if (/\/(chat\/completions|responses)$/i.test(b)) return b;
    // If ends with version like /v1, append chat/completions
    if (/\/v\d+$/i.test(b)) return `${b}/chat/completions`;
    // Otherwise assume root, append /v1/chat/completions
    return `${b}/v1/chat/completions`;
}

export const openAICompatibleAdapter: ProviderAdapter = {
    start(input, options) {
        const controller = new AbortController();
        const signal = options.signal || controller.signal;
        const url = buildEndpointUrl(options.baseURL);
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
            ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}),
            ...(options.headers || {}),
        };

        const body = {
            model: options.model,
            stream: true,
            temperature: options.temperature,
            max_tokens: options.maxTokens,
            messages: input.messages
                ? input.messages.map((m) => ({ role: 'user', content: m }))
                : [{ role: 'user', content: input.prompt || '' }],
        } as any;

        // Debug: request preview with redacted secrets
        try {
            const debugHeaders: Record<string, string> = { ...headers };
            if (debugHeaders.Authorization) {
                const v = debugHeaders.Authorization;
                const tail = v.slice(Math.max(0, v.length - 6));
                debugHeaders.Authorization = `Bearer ********${tail}`;
            }
            const firstMsg = Array.isArray(body.messages) && body.messages.length > 0 ? String(body.messages[0]?.content || '') : '';
            console.debug('[AI][openai-compatible] request', {
                url,
                model: body.model,
                temperature: body.temperature,
                max_tokens: body.max_tokens,
                messagesCount: Array.isArray(body.messages) ? body.messages.length : 0,
                firstMessagePreview: firstMsg.slice(0, 80),
                headers: debugHeaders,
            });
        } catch { /* ignore debug errors */ }

        const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const promise = fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal })
            .then(async (res) => {
                try {
                    const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                    const ctype = res.headers.get('content-type') || '';
                    console.debug('[AI][openai-compatible] response', { status: res.status, ok: res.ok, contentType: ctype, ms: Math.round(t1 - t0) });
                } catch { /* ignore */ }
                if (!res.ok || !res.body) {
                    let text = '';
                    try { text = await res.text(); } catch { /* ignore */ }
                    try {
                        console.debug('[AI][openai-compatible] error body', (text || '').slice(0, 400));
                    } catch { /* ignore */ }
                    const reason = text || `HTTP ${res.status}`;
                    throw new Error(reason);
                }
                const reader = res.body.getReader();
                return makeTextStream(controller, reader, options.batchingIntervalMs);
            })
            .catch((e) => {
                try { console.debug('[AI][openai-compatible] fetch error', { message: String(e?.message || e), name: e?.name }); } catch { /* ignore */ }
                const isAbort = (e?.name === 'AbortError') || /abort|aborted/i.test(String(e?.message || ''));
                const errStream: TextStream = {
                    [Symbol.asyncIterator]: async function* () {
                        yield { type: 'start' } as const;
                        if (isAbort) {
                            yield { type: 'aborted', reason: 'aborted' } as const;
                        } else {
                            yield { type: 'error', message: e?.message || 'request failed' } as const;
                        }
                    },
                    abort() { try { controller.abort(); } catch { /* ignore */ } },
                } as TextStream;
                return errStream;
            });

        // return a proxy stream that awaits the fetch before delegating iteration
        const proxy: TextStream = {
            [Symbol.asyncIterator]: async function* () {
                const stream = await promise;
                for await (const ev of stream) yield ev;
            },
            abort(reason?: string) { try { controller.abort(reason); } catch { /* ignore */ } },
        } as TextStream;
        return proxy;
    },
};


