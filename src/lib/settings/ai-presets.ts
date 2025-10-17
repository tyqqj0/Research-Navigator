// Hardcoded presets for ZJU API (OpenAI-compatible)

export type AIPurpose = 'thinking' | 'task' | 'summary';

export type AIPresetName = 'zju_default' | 'zju_test';

export interface AICredential {
    apiKey: string;
    model: string;
}

export interface AIPresetConfig {
    provider: string;
    baseURL: string;
    // Allow single or multiple candidates per purpose (waterfall)
    credentials: Record<AIPurpose, AICredential | AICredential[]>;
    headers?: Record<string, string>;
    temperature?: number;
    maxTokens?: number;
}

// Read backend proxy config from env. Note: NEXT_PUBLIC_* will be exposed in browser
const ENV_BASE_URL = (process.env.NEXT_PUBLIC_AI_BASE_URL || '').trim();
const ENV_API_KEY = (process.env.NEXT_PUBLIC_AI_API_KEY || '').trim();

export const presets: Record<AIPresetName, AIPresetConfig> = {
    zju_default: {
        provider: 'openAICompatible',
        // If user passes full endpoint like http://host:port/v1/chat/completions, adapter keeps as-is
        baseURL: ENV_BASE_URL || 'http://175.24.200.253:3000/v1/chat/completions',
        credentials: {
            // Backend handles all fallbacks. We just select purpose → model alias
            task: { apiKey: ENV_API_KEY, model: 'task' },
            thinking: { apiKey: ENV_API_KEY, model: 'thinking' },
            summary: { apiKey: ENV_API_KEY, model: 'summary' },
        },
        temperature: 0.4
    },
    zju_test: {
        provider: 'openAICompatible',
        baseURL: ENV_BASE_URL || 'http://175.24.200.253:3000/v1/chat/completions',
        credentials: {
            task: { apiKey: ENV_API_KEY, model: 'task' },
            thinking: { apiKey: ENV_API_KEY, model: 'thinking' },
            summary: { apiKey: ENV_API_KEY, model: 'summary' },
        },
        temperature: 0.5
    }
};

// Allow overriding active preset via env; default to 'zju_default' when empty/invalid
const RAW_ACTIVE_PRESET = (process.env.NEXT_PUBLIC_ACTIVE_PRESET || '').trim();
export const ACTIVE_PRESET: AIPresetName = (
    (RAW_ACTIVE_PRESET === 'zju_default' || RAW_ACTIVE_PRESET === 'zju_test')
        ? RAW_ACTIVE_PRESET
        : 'zju_default'
) as AIPresetName;

export function resolveAIForPurpose(purpose: AIPurpose): { provider: string; baseURL: string; apiKey: string; model: string; headers?: Record<string, string>; temperature?: number; maxTokens?: number } {
    const conf = presets[ACTIVE_PRESET];
    const raw = conf.credentials[purpose];
    const first = Array.isArray(raw) ? (raw[0] as AICredential) : (raw as AICredential);
    return {
        provider: conf.provider,
        baseURL: conf.baseURL,
        apiKey: first.apiKey,
        model: first.model,
        headers: conf.headers,
        temperature: conf.temperature,
        maxTokens: conf.maxTokens,
    };
}

export function resolveAICandidatesForPurpose(purpose: AIPurpose): { provider: string; baseURL: string; headers?: Record<string, string>; temperature?: number; maxTokens?: number; candidates: AICredential[] } {
    const conf = presets[ACTIVE_PRESET];
    const raw = conf.credentials[purpose];
    const list = Array.isArray(raw) ? raw : [raw];
    return {
        provider: conf.provider,
        baseURL: conf.baseURL,
        headers: conf.headers,
        temperature: conf.temperature,
        maxTokens: conf.maxTokens,
        candidates: list,
    };
}


