/**
 * Settings Store - 设置状态管理
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authStoreUtils } from '@/stores/auth.store';
import type {
    UserSettings,
    SettingsActions,
    AISettings,
    SearchSettings,
    UISettings,
    ResearchSettings,
    DatasetSettings,
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
    dataset: {
        provider: 'zotero',
        apiKey: '',
        apiBase: '',
        libraryId: ''
    } as DatasetSettings,
    version: '1.0.0',
    createdAt: new Date(),
    updatedAt: new Date()
};

// ========== Store 定义 ==========

interface SettingsStore extends UserSettings, SettingsActions { }

type PerUserProfiles = Record<string, UserSettings>;

export const useSettingsStore = create<SettingsStore & { __profiles?: PerUserProfiles; __activeUserId?: string }>()(
    persist(
        (set, get) => ({
            // 初始状态（镜像当前用户配置，如果无用户则使用默认）
            ...defaultSettings,
            __profiles: {} as PerUserProfiles,
            __activeUserId: undefined,

            // 基础操作
            updateSettings: (newSettings) => {
                set((state) => {
                    const userId = state.__activeUserId || authStoreUtils.getStoreInstance().getCurrentUserId() || 'anonymous';
                    const profiles = { ...(state.__profiles || {}) } as PerUserProfiles;
                    const base = profiles[userId] || { ...defaultSettings };
                    const merged: UserSettings = { ...(base as any), ...(newSettings as any), updatedAt: new Date() };
                    profiles[userId] = merged;
                    // 镜像到顶层字段，维持现有API
                    return { ...(merged as any), __profiles: profiles, __activeUserId: userId } as any;
                });
            },

            resetSettings: () => {
                set((state) => {
                    const userId = state.__activeUserId || authStoreUtils.getStoreInstance().getCurrentUserId() || 'anonymous';
                    const profiles = { ...(state.__profiles || {}) } as PerUserProfiles;
                    const fresh = { ...defaultSettings, createdAt: new Date(), updatedAt: new Date() } as UserSettings;
                    profiles[userId] = fresh;
                    return { ...(fresh as any), __profiles: profiles, __activeUserId: userId } as any;
                });
            },

            // 分类操作
            updateAISettings: (newAISettings) => {
                set((state) => {
                    const userId = state.__activeUserId || authStoreUtils.getStoreInstance().getCurrentUserId() || 'anonymous';
                    const profiles = { ...(state.__profiles || {}) } as PerUserProfiles;
                    const base = profiles[userId] || { ...defaultSettings };
                    const next: UserSettings = { ...(base as any), ai: { ...base.ai, ...newAISettings }, updatedAt: new Date() };
                    profiles[userId] = next;
                    return { ...(next as any), __profiles: profiles, __activeUserId: userId } as any;
                });
            },

            updateSearchSettings: (newSearchSettings) => {
                set((state) => {
                    const userId = state.__activeUserId || authStoreUtils.getStoreInstance().getCurrentUserId() || 'anonymous';
                    const profiles = { ...(state.__profiles || {}) } as PerUserProfiles;
                    const base = profiles[userId] || { ...defaultSettings };
                    const next: UserSettings = { ...(base as any), search: { ...base.search, ...newSearchSettings }, updatedAt: new Date() };
                    profiles[userId] = next;
                    return { ...(next as any), __profiles: profiles, __activeUserId: userId } as any;
                });
            },

            updateUISettings: (newUISettings) => {
                set((state) => {
                    const userId = state.__activeUserId || authStoreUtils.getStoreInstance().getCurrentUserId() || 'anonymous';
                    const profiles = { ...(state.__profiles || {}) } as PerUserProfiles;
                    const base = profiles[userId] || { ...defaultSettings };
                    const next: UserSettings = { ...(base as any), ui: { ...base.ui, ...newUISettings }, updatedAt: new Date() };
                    profiles[userId] = next;
                    return { ...(next as any), __profiles: profiles, __activeUserId: userId } as any;
                });
            },

            updateResearchSettings: (newResearchSettings) => {
                set((state) => {
                    const userId = state.__activeUserId || authStoreUtils.getStoreInstance().getCurrentUserId() || 'anonymous';
                    const profiles = { ...(state.__profiles || {}) } as PerUserProfiles;
                    const base = profiles[userId] || { ...defaultSettings };
                    const next: UserSettings = { ...(base as any), research: { ...base.research, ...newResearchSettings }, updatedAt: new Date() };
                    profiles[userId] = next;
                    return { ...(next as any), __profiles: profiles, __activeUserId: userId } as any;
                });
            },

            updateDatasetSettings: (newDatasetSettings) => {
                set((state) => {
                    const userId = state.__activeUserId || authStoreUtils.getStoreInstance().getCurrentUserId() || 'anonymous';
                    const profiles = { ...(state.__profiles || {}) } as PerUserProfiles;
                    const base = profiles[userId] || { ...defaultSettings };
                    const next: UserSettings = {
                        ...(base as any),
                        dataset: { ...(base.dataset || { provider: 'zotero', apiKey: '', apiBase: '', libraryId: '' }), ...newDatasetSettings },
                        updatedAt: new Date()
                    };
                    profiles[userId] = next;
                    return { ...(next as any), __profiles: profiles, __activeUserId: userId } as any;
                });
            },

            // 高级操作
            exportSettings: () => {
                const state: any = get();
                const userId = state.__activeUserId || authStoreUtils.getStoreInstance().getCurrentUserId() || 'anonymous';
                const profile = (state.__profiles && state.__profiles[userId]) || {
                    ai: state.ai,
                    search: state.search,
                    ui: state.ui,
                    research: state.research,
                    dataset: state.dataset,
                    version: state.version,
                    createdAt: state.createdAt,
                    updatedAt: state.updatedAt
                };
                return JSON.stringify(profile, null, 2);
            },

            importSettings: (settingsJson) => {
                try {
                    const importedSettings = JSON.parse(settingsJson);
                    if (get().validateSettings(importedSettings)) {
                        set((state: any) => {
                            const userId = state.__activeUserId || authStoreUtils.getStoreInstance().getCurrentUserId() || 'anonymous';
                            const profiles = { ...(state.__profiles || {}) } as PerUserProfiles;
                            const next: UserSettings = { ...(importedSettings as any), updatedAt: new Date() };
                            profiles[userId] = next;
                            return { ...(next as any), __profiles: profiles, __activeUserId: userId } as any;
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
            name: 'user-settings-v2',
            version: 2,
            migrate: (persistedState: any, version: number) => {
                // v1 -> v2: wrap previous single profile into per-user profiles using current user
                if (version < 2 && persistedState) {
                    try {
                        const uid = authStoreUtils.getStoreInstance().getCurrentUserId() || 'anonymous';
                        const { ai, search, ui, research, dataset, createdAt, updatedAt } = persistedState || {};
                        const profile: UserSettings = {
                            ai: ai || defaultAISettings,
                            search: search || defaultSearchSettings,
                            ui: ui || defaultUISettings,
                            research: research || defaultResearchSettings,
                            dataset: dataset || (defaultSettings as any).dataset,
                            version: '1.0.0',
                            createdAt: createdAt ? new Date(createdAt) : new Date(),
                            updatedAt: new Date()
                        };
                        const wrapped = { ...profile, __profiles: { [uid]: profile }, __activeUserId: uid } as any;
                        return wrapped;
                    } catch { /* ignore */ }
                }
                return persistedState;
            }
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
