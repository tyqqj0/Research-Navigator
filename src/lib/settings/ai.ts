// Centralized AI config resolver using hardcoded presets
import { presets, ACTIVE_PRESET, resolveAIForPurpose, type AIPurpose } from './ai-presets';

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
    const preset = presets[ACTIVE_PRESET];
    // Decide purpose by model override when provided; otherwise default to task
    let purpose: AIPurpose = 'task';
    const overrideModel = overrides?.modelOverride?.toLowerCase();
    if (overrideModel) {
        const thinkingModel = preset.credentials.thinking.model.toLowerCase();
        const taskModel = preset.credentials.task.model.toLowerCase();
        const summaryModel = (preset.credentials as any).summary?.model?.toLowerCase?.() || '';
        if (summaryModel && overrideModel === summaryModel) purpose = 'summary';
        else if (overrideModel === taskModel) purpose = 'task';
        else if (overrideModel === thinkingModel) purpose = 'thinking';
        else {
            // Heuristics: gemini+pro → summary; gemini → thinking; otherwise task
            if (overrideModel.includes('gemini') && overrideModel.includes('pro')) purpose = 'summary' as AIPurpose;
            else if (overrideModel.includes('gemini')) purpose = 'thinking' as AIPurpose;
            else purpose = 'task';
        }
    }
    const conf = resolveAIForPurpose(purpose);
    const model = overrides?.modelOverride || conf.model;
    return {
        provider: conf.provider,
        model,
        apiKey: conf.apiKey,
        baseURL: conf.baseURL,
        headers: conf.headers,
        temperature: conf.temperature,
        maxTokens: conf.maxTokens,
    };
}

// Purpose-based model resolver (Phase 1)
export type { AIPurpose };

export function resolveModelForPurpose(purpose: AIPurpose): string {
    return resolveAIForPurpose(purpose).model;
}


