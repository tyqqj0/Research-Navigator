import type { StartArgs, StartOptions, TextStream, TextStreamEvent } from './index';
import { providerRegistry } from './providers';
import { resolveAIConfig, resolveAICandidates } from '@/lib/settings/ai';

export function startTextStream(args: StartArgs, options?: StartOptions): TextStream {
    // Candidates-based waterfall; falls back to single-config path when only one
    const bundle = resolveAICandidates({ modelOverride: options?.modelOverride });
    const cfg = resolveAIConfig({ modelOverride: options?.modelOverride });
    const providerName = (cfg.provider || 'openAICompatible').toString();
    const provider = providerRegistry[providerName];
    if (!provider) {
        // 尝试做一次宽松映射
        const alias = providerRegistry[(providerName || '').toLowerCase()] || providerRegistry[(providerName || '').replace(/[-_]/g, '')] || providerRegistry.openAICompatible;
        if (alias) {
            return alias.start('prompt' in args ? { prompt: args.prompt } : { messages: args.messages } as any, {
                model: cfg.model,
                apiKey: cfg.apiKey,
                baseURL: cfg.baseURL,
                headers: cfg.headers,
                temperature: options?.temperature ?? cfg.temperature,
                maxTokens: options?.maxTokens ?? cfg.maxTokens,
                signal: options?.signal,
                batchingIntervalMs: options?.batchingIntervalMs ?? 32,
            });
        }
        return {
            [Symbol.asyncIterator]: async function* () {
                yield { type: 'start' } as const;
                yield { type: 'error', message: `Unknown provider: ${providerName}` } as const;
            },
            abort() { /* noop */ },
        } as TextStream;
    }

    const input = 'prompt' in args ? { prompt: args.prompt } : { messages: args.messages };

    // If there is only one candidate, use the existing path
    const candidates = bundle.candidates || [];
    if (candidates.length <= 1) {
        return provider.start(input as any, {
            model: cfg.model,
            apiKey: cfg.apiKey,
            baseURL: cfg.baseURL,
            headers: cfg.headers,
            temperature: options?.temperature ?? cfg.temperature,
            maxTokens: options?.maxTokens ?? cfg.maxTokens,
            signal: options?.signal,
            batchingIntervalMs: options?.batchingIntervalMs ?? 32,
        });
    }

    // Waterfall: try candidates sequentially until first non-error stream event
    const controller = new AbortController();
    const outerSignal = options?.signal;
    const signal = outerSignal || controller.signal;

    const proxy: TextStream = {
        [Symbol.asyncIterator]: async function* () {
            yield { type: 'start' } as const;
            const inputObj = input as any;
            let lastError: string | undefined;
            for (let i = 0; i < candidates.length; i++) {
                const cand = candidates[i];
                try {
                    // Emit a tiny diagnostic delta to make debugging easier (optional)
                    try { console.debug('[AI] trying candidate', { idx: i, model: cand.model }); } catch { /* ignore */ }
                    const stream = provider.start(inputObj, {
                        model: cand.model,
                        apiKey: cand.apiKey,
                        baseURL: bundle.baseURL,
                        headers: bundle.headers,
                        temperature: options?.temperature ?? bundle.temperature,
                        maxTokens: options?.maxTokens ?? bundle.maxTokens,
                        signal,
                        batchingIntervalMs: options?.batchingIntervalMs ?? 32,
                    });
                    let yieldedAny = false;
                    for await (const ev of stream as AsyncIterable<TextStreamEvent>) {
                        if (ev.type === 'error') {
                            lastError = ev.message;
                            yieldedAny = true; // already started, treat as terminal; stop and bubble error
                            yield ev;
                            return;
                        }
                        yield ev;
                        yieldedAny = true;
                    }
                    // If we reached here without error, stream finished successfully
                    return;
                } catch (e: any) {
                    lastError = e?.message || String(e) || 'unknown error';
                    try { console.debug('[AI] candidate failed', { idx: i, model: cand.model, message: lastError }); } catch { /* ignore */ }
                    // proceed to next candidate
                }
            }
            // All candidates failed
            yield { type: 'error', message: lastError || 'all candidates failed' } as const;
        },
        abort(reason?: string) { try { (outerSignal as any)?.abort?.(reason); } catch { /* ignore */ } try { controller.abort(reason); } catch { /* ignore */ } },
    } as TextStream;
    return proxy;
}


