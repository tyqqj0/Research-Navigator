/**
 * AI Settings Tab - AI设置选项卡
 */

'use client';

import { useState } from 'react';
import { Bot, Eye, EyeOff, RefreshCw, AlertTriangle } from 'lucide-react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';

import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

import { useAISettings } from '../../data-access';

const AI_PROVIDERS = [
    { value: 'google', label: 'Google Gemini', status: 'stable' },
    { value: 'openai', label: 'OpenAI', status: 'stable' },
    { value: 'anthropic', label: 'Anthropic Claude', status: 'stable' },
    { value: 'deepseek', label: 'DeepSeek', status: 'beta' },
    { value: 'openrouter', label: 'OpenRouter', status: 'stable' },
    { value: 'mistral', label: 'Mistral AI', status: 'stable' },
    { value: 'xai', label: 'xAI Grok', status: 'beta' },
    { value: 'azure', label: 'Azure OpenAI', status: 'stable' },
    { value: 'ollama', label: 'Ollama (本地)', status: 'experimental' },
    { value: 'pollinations', label: 'Pollinations', status: 'experimental' }
];

const MODEL_MODES = [
    { value: 'local', label: '本地模式' },
    { value: 'cloud', label: '云端模式' }
];

const getStatusColor = (status: string) => {
    switch (status) {
        case 'stable': return 'bg-green-100 text-green-800';
        case 'beta': return 'bg-blue-100 text-blue-800';
        case 'experimental': return 'bg-orange-100 text-orange-800';
        default: return 'bg-gray-100 text-gray-800';
    }
};

export function AISettingsTab() {
    const { settings, updateSettings } = useAISettings();
    const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
    const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});

    const toggleApiKeyVisibility = (provider: string) => {
        setShowApiKeys(prev => ({
            ...prev,
            [provider]: !prev[provider]
        }));
    };

    const toggleProviderExpansion = (provider: string) => {
        setExpandedProviders(prev => ({
            ...prev,
            [provider]: !prev[provider]
        }));
    };

    const currentProvider = AI_PROVIDERS.find(p => p.value === settings.provider);

    return (
        <div className="space-y-6">
            {/* 基础设置 */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Bot className="w-5 h-5 text-blue-600" />
                        基础配置
                    </CardTitle>
                    <CardDescription>
                        选择AI服务提供商和运行模式
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="provider">AI 提供商</Label>
                            <Select
                                value={settings.provider}
                                onValueChange={(value: string) => updateSettings({ provider: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="选择AI提供商" />
                                </SelectTrigger>
                                <SelectContent>
                                    {AI_PROVIDERS.map(provider => (
                                        <SelectItem key={provider.value} value={provider.value}>
                                            <div className="flex items-center justify-between w-full">
                                                <span>{provider.label}</span>
                                                <Badge className={getStatusColor(provider.status)}>
                                                    {provider.status}
                                                </Badge>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="mode">运行模式</Label>
                            <Select
                                value={settings.mode}
                                onValueChange={(value: string) => updateSettings({ mode: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="选择运行模式" />
                                </SelectTrigger>
                                <SelectContent>
                                    {MODEL_MODES.map(mode => (
                                        <SelectItem key={mode.value} value={mode.value}>
                                            {mode.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {currentProvider && (
                        <Alert>
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                                当前使用: <strong>{currentProvider.label}</strong>
                                {currentProvider.status !== 'stable' && (
                                    <span className="text-orange-600 ml-2">
                                        ({currentProvider.status === 'beta' ? '测试版' : '实验性'})
                                    </span>
                                )}
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {/* 当前提供商详细设置 */}
            {settings.provider && (
                <Card>
                    <CardHeader>
                        <CardTitle>
                            {AI_PROVIDERS.find(p => p.value === settings.provider)?.label} 设置
                        </CardTitle>
                        <CardDescription>
                            配置当前AI提供商的API密钥和模型选择
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 gap-4">
                            {/* API Key */}
                            <div className="space-y-2">
                                <Label htmlFor="apiKey">API 密钥</Label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Input
                                            type={showApiKeys[settings.provider] ? 'text' : 'password'}
                                            value={settings.apiKey}
                                            onChange={(e) => updateSettings({ apiKey: e.target.value })}
                                            placeholder="输入API密钥"
                                        />
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => toggleApiKeyVisibility(settings.provider)}
                                    >
                                        {showApiKeys[settings.provider] ? (
                                            <EyeOff className="w-4 h-4" />
                                        ) : (
                                            <Eye className="w-4 h-4" />
                                        )}
                                    </Button>
                                </div>
                            </div>

                            {/* API Proxy */}
                            <div className="space-y-2">
                                <Label htmlFor="apiProxy">API 代理地址 (可选)</Label>
                                <Input
                                    value={settings.apiProxy}
                                    onChange={(e) => updateSettings({ apiProxy: e.target.value })}
                                    placeholder="https://api.example.com"
                                />
                            </div>

                            {/* 模型选择 */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="thinkingModel">思考模型</Label>
                                    <Input
                                        value={settings.thinkingModel}
                                        onChange={(e) => updateSettings({ thinkingModel: e.target.value })}
                                        placeholder="选择思考模型"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="networkingModel">网络模型</Label>
                                    <Input
                                        value={settings.networkingModel}
                                        onChange={(e) => updateSettings({ networkingModel: e.target.value })}
                                        placeholder="选择网络模型"
                                    />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* 其他提供商设置 */}
            <Card>
                <CardHeader>
                    <CardTitle>其他提供商配置</CardTitle>
                    <CardDescription>
                        预配置其他AI提供商，便于快速切换
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    {AI_PROVIDERS.filter(p => p.value !== settings.provider).map(provider => (
                        <Collapsible
                            key={provider.value}
                            open={expandedProviders[provider.value]}
                            onOpenChange={() => toggleProviderExpansion(provider.value)}
                        >
                            <CollapsibleTrigger asChild>
                                <Button variant="ghost" className="w-full justify-between p-3 h-auto">
                                    <div className="flex items-center gap-2">
                                        <span>{provider.label}</span>
                                        <Badge className={getStatusColor(provider.status)}>
                                            {provider.status}
                                        </Badge>
                                    </div>
                                    <RefreshCw className="w-4 h-4" />
                                </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="px-3 pb-3">
                                <div className="space-y-3 pt-2">
                                    <div className="space-y-2">
                                        <Label>API 密钥</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                type={showApiKeys[provider.value] ? 'text' : 'password'}
                                                placeholder="输入API密钥"
                                                className="text-sm"
                                            />
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => toggleApiKeyVisibility(provider.value)}
                                            >
                                                {showApiKeys[provider.value] ? (
                                                    <EyeOff className="w-3 h-3" />
                                                ) : (
                                                    <Eye className="w-3 h-3" />
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>API 代理</Label>
                                        <Input placeholder="https://api.example.com" className="text-sm" />
                                    </div>
                                </div>
                            </CollapsibleContent>
                        </Collapsible>
                    ))}
                </CardContent>
            </Card>

            {/* 安全设置 */}
            <Card>
                <CardHeader>
                    <CardTitle>安全设置</CardTitle>
                    <CardDescription>
                        保护您的设置和数据安全
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        <Label htmlFor="accessPassword">访问密码</Label>
                        <Input
                            type="password"
                            value={settings.accessPassword}
                            onChange={(e) => updateSettings({ accessPassword: e.target.value })}
                            placeholder="设置访问密码"
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
