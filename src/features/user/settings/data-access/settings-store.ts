/**
 * Settings Store - 设置状态管理
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
    UserSettings,
    SettingsActions,
    AISettings,
    SearchSettings,
    UISettings,
    ResearchSettings,
    LegacySettingStore
} from './settings-types';

// ========== 默认设置 ==========

const defaultAISettings: AISettings = {
    provider: 'google',
    mode: 'local',
    apiKey: '',
    apiProxy: '',
    thinkingModel: 'Gemini-2.5-Pro-Preview-06-05',
    taskModel: 'Gemini-2.5-Flash-Preview-05-20',

    openRouter: {
        apiKey: '',
        apiProxy: '',
        thinkingModel: '',
        taskModel: ''
    },
    openAI: {
        apiKey: '',
        apiProxy: '',
        thinkingModel: 'gpt-4o',
        taskModel: 'gpt-4o-mini'
    },
    anthropic: {
        apiKey: '',
        apiProxy: '',
        thinkingModel: '',
        taskModel: ''
    },
    deepseek: {
        apiKey: '',
        apiProxy: '',
        thinkingModel: 'deepseek-reasoner',
        taskModel: 'deepseek-chat'
    },
    xAI: {
        apiKey: '',
        apiProxy: '',
        thinkingModel: '',
        taskModel: ''
    },
    mistral: {
        apiKey: '',
        apiProxy: '',
        thinkingModel: 'mistral-large-latest',
        taskModel: 'mistral-medium-latest'
    },
    azure: {
        apiKey: '',
        apiProxy: '',
        thinkingModel: '',
        taskModel: '',
        resourceName: '',
        apiVersion: ''
    },
    openAICompatible: {
        apiKey: '',
        apiProxy: '',
        thinkingModel: '',
        taskModel: ''
    },
    pollinations: {
        apiProxy: '',
        thinkingModel: '',
        taskModel: ''
    },
    ollama: {
        apiProxy: '',
        thinkingModel: '',
        taskModel: ''
    },

    accessPassword: ''
};

const defaultSearchSettings: SearchSettings = {
    enableSearch: true,
    searchProvider: 'tavily',
    parallelSearch: 1,
    searchMaxResult: 5,
    crawler: 'jina',

    tavily: {
        apiKey: '',
        apiProxy: '',
        scope: 'general'
    },
    firecrawl: {
        apiKey: '',
        apiProxy: '',
        scope: 'general'
    },
    exa: {
        apiKey: '',
        apiProxy: '',
        scope: 'research paper'
    },
    bocha: {
        apiKey: '',
        apiProxy: '',
        scope: 'general'
    },
    searxng: {
        apiProxy: '',
        scope: 'all'
    },

    searchDomainStrategy: {
        tavily: {
            domains: {
                predefined: [],
                custom: []
            }
        }
    }
};

const defaultUISettings: UISettings = {
    language: '',
    theme: 'system',
    debug: 'disable',
    references: 'enable',
    citationImage: 'enable',
    customTheme: {
        colorPresetName: 'default',
        isDarkMode: false,
        customColors: undefined
    }
};

const defaultResearchSettings: ResearchSettings = {
    enableTaskWaitingTime: false,
    taskWaitingTime: 10,
    autoSaveInterval: 30,
    maxTreeDepth: 10,
    defaultExpansionStrategy: 'mcts'
};

const defaultSettings: UserSettings = {
    ai: defaultAISettings,
    search: defaultSearchSettings,
    ui: defaultUISettings,
    research: defaultResearchSettings,
    version: '1.0.0',
    createdAt: new Date(),
    updatedAt: new Date()
};

// ========== Store 定义 ==========

interface SettingsStore extends UserSettings, SettingsActions { }

export const useSettingsStore = create<SettingsStore>()(
    persist(
        (set, get) => ({
            // 初始状态
            ...defaultSettings,

            // 基础操作
            updateSettings: (newSettings) => {
                set((state) => ({
                    ...state,
                    ...newSettings,
                    updatedAt: new Date()
                }));
            },

            resetSettings: () => {
                set({
                    ...defaultSettings,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            },

            // 分类操作
            updateAISettings: (newAISettings) => {
                set((state) => ({
                    ...state,
                    ai: { ...state.ai, ...newAISettings },
                    updatedAt: new Date()
                }));
            },

            updateSearchSettings: (newSearchSettings) => {
                set((state) => ({
                    ...state,
                    search: { ...state.search, ...newSearchSettings },
                    updatedAt: new Date()
                }));
            },

            updateUISettings: (newUISettings) => {
                set((state) => ({
                    ...state,
                    ui: { ...state.ui, ...newUISettings },
                    updatedAt: new Date()
                }));
            },

            updateResearchSettings: (newResearchSettings) => {
                set((state) => ({
                    ...state,
                    research: { ...state.research, ...newResearchSettings },
                    updatedAt: new Date()
                }));
            },

            // 高级操作
            exportSettings: () => {
                const state = get();
                return JSON.stringify(state, null, 2);
            },

            importSettings: (settingsJson) => {
                try {
                    const importedSettings = JSON.parse(settingsJson);
                    // 验证设置格式
                    if (get().validateSettings(importedSettings)) {
                        set({
                            ...importedSettings,
                            updatedAt: new Date()
                        });
                    }
                } catch (error) {
                    console.error('Failed to import settings:', error);
                }
            },

            validateSettings: (settings) => {
                // 基础验证逻辑
                return !!(settings && typeof settings === 'object');
            }
        }),
        {
            name: 'user-settings',
            version: 1
        }
    )
);

// ========== 兼容性函数 ==========

/**
 * 将旧的设置格式转换为新的格式
 */
export function migrateLegacySettings(legacySettings: LegacySettingStore): UserSettings {
    return {
        ai: {
            provider: legacySettings.provider,
            mode: legacySettings.mode,
            apiKey: legacySettings.apiKey,
            apiProxy: legacySettings.apiProxy,
            thinkingModel: legacySettings.thinkingModel,
            taskModel: legacySettings.taskModel,

            openRouter: {
                apiKey: legacySettings.openRouterApiKey,
                apiProxy: legacySettings.openRouterApiProxy,
                thinkingModel: legacySettings.openRouterThinkingModel,
                taskModel: legacySettings.openRouterNetworkingModel
            },
            openAI: {
                apiKey: legacySettings.openAIApiKey,
                apiProxy: legacySettings.openAIApiProxy,
                thinkingModel: legacySettings.openAIThinkingModel,
                taskModel: legacySettings.openAINetworkingModel
            },
            anthropic: {
                apiKey: legacySettings.anthropicApiKey,
                apiProxy: legacySettings.anthropicApiProxy,
                thinkingModel: legacySettings.anthropicThinkingModel,
                taskModel: legacySettings.anthropicNetworkingModel
            },
            deepseek: {
                apiKey: legacySettings.deepseekApiKey,
                apiProxy: legacySettings.deepseekApiProxy,
                thinkingModel: legacySettings.deepseekThinkingModel,
                taskModel: legacySettings.deepseekNetworkingModel
            },
            xAI: {
                apiKey: legacySettings.xAIApiKey,
                apiProxy: legacySettings.xAIApiProxy,
                thinkingModel: legacySettings.xAIThinkingModel,
                taskModel: legacySettings.xAINetworkingModel
            },
            mistral: {
                apiKey: legacySettings.mistralApiKey,
                apiProxy: legacySettings.mistralApiProxy,
                thinkingModel: legacySettings.mistralThinkingModel,
                taskModel: legacySettings.mistralNetworkingModel
            },
            azure: {
                apiKey: legacySettings.azureApiKey,
                apiProxy: '',
                thinkingModel: legacySettings.azureThinkingModel,
                taskModel: legacySettings.azureNetworkingModel,
                resourceName: legacySettings.azureResourceName,
                apiVersion: legacySettings.azureApiVersion
            },
            openAICompatible: {
                apiKey: legacySettings.openAICompatibleApiKey,
                apiProxy: legacySettings.openAICompatibleApiProxy,
                thinkingModel: legacySettings.openAICompatibleThinkingModel,
                taskModel: legacySettings.openAICompatibleNetworkingModel
            },
            pollinations: {
                apiProxy: legacySettings.pollinationsApiProxy,
                thinkingModel: legacySettings.pollinationsThinkingModel,
                taskModel: legacySettings.pollinationsNetworkingModel
            },
            ollama: {
                apiProxy: legacySettings.ollamaApiProxy,
                thinkingModel: legacySettings.ollamaThinkingModel,
                taskModel: legacySettings.ollamaNetworkingModel
            },

            accessPassword: legacySettings.accessPassword
        },

        search: {
            enableSearch: legacySettings.enableSearch === '1',
            searchProvider: legacySettings.searchProvider,
            parallelSearch: legacySettings.parallelSearch,
            searchMaxResult: legacySettings.searchMaxResult,
            crawler: legacySettings.crawler,

            tavily: {
                apiKey: legacySettings.tavilyApiKey,
                apiProxy: legacySettings.tavilyApiProxy,
                scope: legacySettings.tavilyScope
            },
            firecrawl: {
                apiKey: legacySettings.firecrawlApiKey,
                apiProxy: legacySettings.firecrawlApiProxy,
                scope: 'general'
            },
            exa: {
                apiKey: legacySettings.exaApiKey,
                apiProxy: legacySettings.exaApiProxy,
                scope: legacySettings.exaScope
            },
            bocha: {
                apiKey: legacySettings.bochaApiKey,
                apiProxy: legacySettings.bochaApiProxy,
                scope: 'general'
            },
            searxng: {
                apiProxy: legacySettings.searxngApiProxy,
                scope: legacySettings.searxngScope
            },

            searchDomainStrategy: legacySettings.searchDomainStrategy
        },

        ui: {
            language: legacySettings.language,
            theme: legacySettings.theme as 'light' | 'dark' | 'system',
            debug: legacySettings.debug as 'enable' | 'disable',
            references: legacySettings.references as 'enable' | 'disable',
            citationImage: legacySettings.citationImage as 'enable' | 'disable'
        },

        research: {
            enableTaskWaitingTime: legacySettings.enableTaskWaitingTime,
            taskWaitingTime: legacySettings.taskWaitingTime
        },

        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date()
    };
}

// ========== 便捷 Hooks ==========

export const useAISettings = () => {
    const settings = useSettingsStore((state) => state.ai);
    const updateSettings = useSettingsStore((state) => state.updateAISettings);
    return { settings, updateSettings };
};

export const useSearchSettings = () => {
    const settings = useSettingsStore((state) => state.search);
    const updateSettings = useSettingsStore((state) => state.updateSearchSettings);
    return { settings, updateSettings };
};

export const useUISettings = () => {
    const settings = useSettingsStore((state) => state.ui);
    const updateSettings = useSettingsStore((state) => state.updateUISettings);
    return { settings, updateSettings };
};

export const useResearchSettings = () => {
    const settings = useSettingsStore((state) => state.research);
    const updateSettings = useSettingsStore((state) => state.updateResearchSettings);
    return { settings, updateSettings };
};
