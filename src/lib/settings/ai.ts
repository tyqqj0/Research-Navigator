// Centralized AI config resolver using hardcoded presets
import { presets, ACTIVE_PRESET, resolveAIForPurpose, resolveAICandidatesForPurpose, type AIPurpose } from './ai-presets';
import type { AICredential } from './ai-presets';

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
        const getFirstModel = (c: AICredential | AICredential[]) => (Array.isArray(c) ? c[0] : c).model.toLowerCase();
        const thinkingModel = getFirstModel(preset.credentials.thinking);
        const taskModel = getFirstModel(preset.credentials.task);
        const summaryModel = (Array.isArray((preset.credentials as any).summary)
            ? (preset.credentials as any).summary?.[0]?.model
            : (preset.credentials as any).summary?.model)?.toLowerCase?.() || '';
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

export function resolveAICandidates(overrides?: { modelOverride?: string }): {
    provider: string;
    baseURL?: string;
    headers?: Record<string, string>;
    temperature?: number;
    maxTokens?: number;
    candidates: AICredential[];
    purpose: AIPurpose;
} {
    const preset = presets[ACTIVE_PRESET];
    const overrideModel = overrides?.modelOverride?.toLowerCase();
    const purposes: AIPurpose[] = ['task', 'thinking', 'summary'];
    let purpose: AIPurpose = 'task';
    if (overrideModel) {
        // Prefer exact match across any candidate list
        const match = purposes.find((p) => {
            const raw = preset.credentials[p];
            const list = Array.isArray(raw) ? raw : [raw];
            return list.some((c) => c.model.toLowerCase() === overrideModel);
        });
        if (match) purpose = match;
        else {
            // Heuristics fallback
            if (overrideModel.includes('gemini') && overrideModel.includes('pro')) purpose = 'summary';
            else if (overrideModel.includes('gemini')) purpose = 'thinking';
            else purpose = 'task';
        }
    }
    const base = resolveAICandidatesForPurpose(purpose);
    let list = base.candidates.slice();
    if (overrideModel) {
        // Move exact-match model to front if present
        const idx = list.findIndex((c) => c.model.toLowerCase() === overrideModel);
        if (idx > 0) {
            const [hit] = list.splice(idx, 1);
            list.unshift(hit);
        }
    }
    return {
        provider: base.provider,
        baseURL: base.baseURL,
        headers: base.headers,
        temperature: base.temperature,
        maxTokens: base.maxTokens,
        candidates: list,
        purpose,
    };
}


