export type TextStreamEvent =
    | { type: 'start' }
    | { type: 'delta'; text: string }
    | { type: 'done' }
    | { type: 'aborted'; reason?: string }
    | { type: 'error'; message: string; retryable?: boolean };

export interface TextStream extends AsyncIterable<TextStreamEvent> {
    abort(reason?: string): void;
}

export type MessageInput = string;

export interface StartOptions {
    temperature?: number;
    maxTokens?: number;
    modelOverride?: string;
    batchingIntervalMs?: number;
    signal?: AbortSignal;
}

export type StartArgs =
    | { prompt: string; messages?: never }
    | { prompt?: never; messages: MessageInput[] };

export type ProviderName =
    | 'openAICompatible';

export interface ProviderAdapter {
    start(
        input: { prompt?: string; messages?: string[] },
        options: { model: string; apiKey?: string; baseURL?: string; headers?: Record<string, string>; temperature?: number; maxTokens?: number; signal?: AbortSignal; batchingIntervalMs?: number }
    ): TextStream;
}

export { providerRegistry } from './providers';
export type { ProviderAdapter as AIProviderAdapter };


