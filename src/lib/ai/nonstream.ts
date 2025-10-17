import { resolveAIConfig } from '@/lib/settings/ai';

export interface CompletionArgs {
    messages?: string[];
    prompt?: string;
}

export interface CompletionOptions {
    temperature?: number;
    maxTokens?: number;
    modelOverride?: string; // 'task' | 'thinking' | 'summary' or a real model id
    signal?: AbortSignal;
}

export interface CompletionResult {
    text: string;
    raw?: any;
}

export async function completeOnce(args: CompletionArgs, options?: CompletionOptions): Promise<CompletionResult> {
    const cfg = resolveAIConfig({ modelOverride: options?.modelOverride });
    const baseURL = (cfg.baseURL || '').replace(/\/+$/, '');
    const url = /\/(chat\/completions|responses)$/i.test(baseURL)
        ? baseURL
        : /\/v\d+$/i.test(baseURL)
            ? `${baseURL}/chat/completions`
            : `${baseURL || 'https://api.openai.com/v1'}/chat/completions`;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
        ...(cfg.headers || {}),
    };

    const body: any = {
        model: cfg.model,
        stream: false,
        temperature: options?.temperature ?? cfg.temperature,
        max_tokens: options?.maxTokens ?? cfg.maxTokens,
        messages: args.messages
            ? args.messages.map((m) => ({ role: 'user', content: m }))
            : [{ role: 'user', content: args.prompt || '' }],
    };

    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: options?.signal });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `HTTP ${res.status}`);
    }
    const json = await res.json().catch(() => ({}));
    const text = json?.choices?.[0]?.message?.content
        ?? json?.choices?.[0]?.text
        ?? '';
    return { text, raw: json };
}


