// Hardcoded presets for ZJU API (OpenAI-compatible)

export type AIPurpose = 'thinking' | 'task' | 'summary';

export type AIPresetName = 'zju_default' | 'zju_test';

export interface AIPresetConfig {
    provider: string;
    baseURL: string;
    credentials: Record<AIPurpose, { apiKey: string; model: string }>;
    headers?: Record<string, string>;
    temperature?: number;
    maxTokens?: number;
}

export const presets: Record<AIPresetName, AIPresetConfig> = {
    zju_default: {
        provider: 'openAICompatible',
        baseURL: 'https://zjuapi.com/v1/chat/completions',
        credentials: {
            // task → gpt-5
            task: { apiKey: 'sk-h23ccKj22huAfX2VRE3SKg8Dz3Y2Jterhjbcpu5jczf5421w', model: 'gpt-5' },
            // thinking → gemini-2.5-flash
            thinking: { apiKey: 'sk-ObUPynbwDvm3o7s1JZLbmKnRv88x3P0LOPYYtv0iNhp0ebn4', model: 'gemini-2.5-flash' },
            // summary → gemini-2.5-pro
            summary: { apiKey: 'sk-ObUPynbwDvm3o7s1JZLbmKnRv88x3P0LOPYYtv0iNhp0ebn4', model: 'gemini-2.5-pro' },
        },
        temperature: 0.4
    },
    zju_test: {
        provider: 'openAICompatible',
        baseURL: 'https://zjuapi.com/v1/chat/completions',
        credentials: {
            // task-test → gpt-4o with key sk-h23...
            task: { apiKey: 'sk-h23ccKj22huAfX2VRE3SKg8Dz3Y2Jterhjbcpu5jczf5421w', model: 'gpt-4o' },
            // thinking-test → gemini-2.5-flash with key sk-ObU...
            thinking: { apiKey: 'sk-ObUPynbwDvm3o7s1JZLbmKnRv88x3P0LOPYYtv0iNhp0ebn4', model: 'gemini-2.5-flash' },
            // summary-test → gemini-2.5-pro
            summary: { apiKey: 'sk-ObUPynbwDvm3o7s1JZLbmKnRv88x3P0LOPYYtv0iNhp0ebn4', model: 'gemini-2.5-flash' },
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
    const cred = conf.credentials[purpose];
    return {
        provider: conf.provider,
        baseURL: conf.baseURL,
        apiKey: cred.apiKey,
        model: cred.model,
        headers: conf.headers,
        temperature: conf.temperature,
        maxTokens: conf.maxTokens,
    };
}


