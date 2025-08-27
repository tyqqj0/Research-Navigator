/**
 * Settings Domain Types - 设置领域类型定义
 */

// ========== 基础类型 ==========

export interface DomainLimit {
    predefined: string[];
    custom: string[];
}

// ========== AI Provider 配置 ==========

export interface AIProviderConfig {
    apiKey: string;
    apiProxy: string;
    thinkingModel: string;
    networkingModel: string;
}

export interface AzureConfig extends AIProviderConfig {
    resourceName: string;
    apiVersion: string;
}

export interface AISettings {
    // 主要设置
    provider: string;
    mode: string;
    apiKey: string;
    apiProxy: string;
    thinkingModel: string;
    networkingModel: string;

    // 各个 Provider 配置
    openRouter: AIProviderConfig;
    openAI: AIProviderConfig;
    anthropic: AIProviderConfig;
    deepseek: AIProviderConfig;
    xAI: AIProviderConfig;
    mistral: AIProviderConfig;
    azure: AzureConfig;
    openAICompatible: AIProviderConfig;
    pollinations: Omit<AIProviderConfig, 'apiKey'>;
    ollama: Omit<AIProviderConfig, 'apiKey'>;

    // 访问控制
    accessPassword: string;
}

// ========== 搜索引擎配置 ==========

export interface SearchProviderConfig {
    apiKey?: string;
    apiProxy: string;
    scope: string;
}

export interface SearchSettings {
    enableSearch: boolean;
    searchProvider: string;
    parallelSearch: number;
    searchMaxResult: number;
    crawler: string;

    // 各个搜索引擎配置
    tavily: SearchProviderConfig & { apiKey: string };
    firecrawl: SearchProviderConfig & { apiKey: string };
    exa: SearchProviderConfig & { apiKey: string };
    bocha: SearchProviderConfig & { apiKey: string };
    searxng: SearchProviderConfig;

    // 域名策略
    searchDomainStrategy: {
        [provider: string]: {
            domains: DomainLimit;
        };
    };
}

// ========== 界面设置 ==========

export interface UISettings {
    language: string;
    theme: 'light' | 'dark' | 'system' | 'custom';
    debug: 'enable' | 'disable';
    references: 'enable' | 'disable';
    citationImage: 'enable' | 'disable';
}

// ========== 研究设置 ==========

export interface ResearchSettings {
    enableTaskWaitingTime: boolean;
    taskWaitingTime: number;
    // 可以添加更多研究相关的设置
    autoSaveInterval?: number;
    maxTreeDepth?: number;
    defaultExpansionStrategy?: string;
}

// ========== 主设置接口 ==========

export interface UserSettings {
    ai: AISettings;
    search: SearchSettings;
    ui: UISettings;
    research: ResearchSettings;

    // 元数据
    version: string;
    createdAt: Date;
    updatedAt: Date;
}

// ========== 设置操作接口 ==========

export interface SettingsActions {
    // 基础操作
    updateSettings: (settings: Partial<UserSettings>) => void;
    resetSettings: () => void;

    // 分类操作
    updateAISettings: (settings: Partial<AISettings>) => void;
    updateSearchSettings: (settings: Partial<SearchSettings>) => void;
    updateUISettings: (settings: Partial<UISettings>) => void;
    updateResearchSettings: (settings: Partial<ResearchSettings>) => void;

    // 高级操作
    exportSettings: () => string;
    importSettings: (settingsJson: string) => void;
    validateSettings: (settings: Partial<UserSettings>) => boolean;
}

// ========== 兼容性类型 (用于迁移) ==========

export interface LegacySettingStore {
    provider: string;
    mode: string;
    apiKey: string;
    apiProxy: string;
    openRouterApiKey: string;
    openRouterApiProxy: string;
    openRouterThinkingModel: string;
    openRouterNetworkingModel: string;
    openAIApiKey: string;
    openAIApiProxy: string;
    openAIThinkingModel: string;
    openAINetworkingModel: string;
    anthropicApiKey: string;
    anthropicApiProxy: string;
    anthropicThinkingModel: string;
    anthropicNetworkingModel: string;
    deepseekApiKey: string;
    deepseekApiProxy: string;
    deepseekThinkingModel: string;
    deepseekNetworkingModel: string;
    xAIApiKey: string;
    xAIApiProxy: string;
    xAIThinkingModel: string;
    xAINetworkingModel: string;
    mistralApiKey: string;
    mistralApiProxy: string;
    mistralThinkingModel: string;
    mistralNetworkingModel: string;
    azureApiKey: string;
    azureResourceName: string;
    azureApiVersion: string;
    azureThinkingModel: string;
    azureNetworkingModel: string;
    openAICompatibleApiKey: string;
    openAICompatibleApiProxy: string;
    openAICompatibleThinkingModel: string;
    openAICompatibleNetworkingModel: string;
    pollinationsApiProxy: string;
    pollinationsThinkingModel: string;
    pollinationsNetworkingModel: string;
    ollamaApiProxy: string;
    ollamaThinkingModel: string;
    ollamaNetworkingModel: string;
    accessPassword: string;
    thinkingModel: string;
    networkingModel: string;
    enableSearch: string;
    searchProvider: string;
    tavilyApiKey: string;
    tavilyApiProxy: string;
    tavilyScope: string;
    firecrawlApiKey: string;
    firecrawlApiProxy: string;
    exaApiKey: string;
    exaApiProxy: string;
    exaScope: string;
    bochaApiKey: string;
    bochaApiProxy: string;
    searxngApiProxy: string;
    searxngScope: string;
    parallelSearch: number;
    searchMaxResult: number;
    crawler: string;
    language: string;
    theme: string;
    debug: string;
    references: string;
    citationImage: string;
    searchDomainStrategy: {
        [provider: string]: {
            domains: DomainLimit;
        };
    };
    enableTaskWaitingTime: boolean;
    taskWaitingTime: number;
}
