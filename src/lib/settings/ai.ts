// Lightweight resolver to read AI settings from existing user settings store
// Adjust the import path to your actual settings store
import { useSettingsStore } from '@/features/user/settings/data-access/settings-store';

export interface ResolvedAIConfig {
    provider: string;
    model: string;
    apiKey?: string;
    baseURL?: string;
    headers?: Record<string, string>;
    temperature?: number;
    maxTokens?: number;
}

export function resolveAIConfig(overrides?: { modelOverride?: string }): ResolvedAIConfig {
    // Expect settings like: { ai: { provider, model, apiKey, baseURL, headers, temperature, maxTokens } }
    const s = useSettingsStore.getState() as any;
    const ai = (s?.ai) || (s?.settings?.ai) || {};
    return {
        provider: ai.provider || 'openAICompatible',
        model: overrides?.modelOverride || ai.model || 'gpt-4o-mini',
        apiKey: ai.apiKey || undefined,
        baseURL: ai.apiProxy || ai.baseURL || undefined,
        headers: ai.headers || undefined,
        temperature: ai.temperature,
        maxTokens: ai.maxTokens,
    } as ResolvedAIConfig;
}


