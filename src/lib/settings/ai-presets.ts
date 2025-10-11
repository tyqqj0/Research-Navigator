// Hardcoded presets for ZJU API (OpenAI-compatible)

export type AIPurpose = 'thinking' | 'task';

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
            // task → gpt5 with key sk-h23...
            task: { apiKey: 'sk-h23ccKj22huAfX2VRE3SKg8Dz3Y2Jterhjbcpu5jczf5421w', model: 'gpt-5' },
            // thinking → gemini-2.5-pro with key sk-ObU...
            thinking: { apiKey: 'sk-ObUPynbwDvm3o7s1JZLbmKnRv88x3P0LOPYYtv0iNhp0ebn4', model: 'gemini-2.5-pro' },
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
        },
        temperature: 0.5
    }
};

export const ACTIVE_PRESET: AIPresetName = 'zju_test';

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


