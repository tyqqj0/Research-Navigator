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

// Purpose-based model resolver (Phase 1)
export type AIPurpose = 'thinking' | 'task';

export function resolveModelForPurpose(purpose: AIPurpose): string {
    const s = useSettingsStore.getState() as any;
    const ai = (s?.ai) || (s?.settings?.ai) || {};

    const provider: string = String(ai.provider || '').toLowerCase();
    const providerKey = provider === 'openrouter'
        ? 'openRouter'
        : provider === 'openai'
            ? 'openAI'
            : provider === 'xai'
                ? 'xAI'
                : provider === 'openaicompatible'
                    ? 'openAICompatible'
                    : provider;

    const providerConf = (ai as any)?.[providerKey] || {};

    const topLevelThinking = (ai as any).thinkingModel;
    const topLevelTask = (ai as any).taskModel;
    const providerThinking = (providerConf as any).thinkingModel;
    const providerTask = (providerConf as any).taskModel;

    // Fallback chain keeps backward compatibility with existing `taskModel` naming
    if (purpose === 'thinking') {
        return providerThinking || topLevelThinking || (ai as any).model || 'gpt-4o-mini';
    }
    return providerTask || topLevelTask || (ai as any).model || 'gpt-4o-mini';
}


