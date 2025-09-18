import type { StartArgs, StartOptions, TextStream } from './index';
import { providerRegistry } from './providers';
import { resolveAIConfig } from '@/lib/settings/ai';

export function startTextStream(args: StartArgs, options?: StartOptions): TextStream {
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


