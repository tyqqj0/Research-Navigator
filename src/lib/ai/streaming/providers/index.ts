import type { ProviderAdapter } from '../index';
import { openAICompatibleAdapter } from './openai-compatible';

// 支持多种同义写法，方便与设置面板对齐
export const providerRegistry: Record<string, ProviderAdapter> = {
    openAICompatible: openAICompatibleAdapter,
    openai: openAICompatibleAdapter,
    'openai-compatible': openAICompatibleAdapter,
    openai_compatible: openAICompatibleAdapter,
    openaiCompatible: openAICompatibleAdapter,
};


