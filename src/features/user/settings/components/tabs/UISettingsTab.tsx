/**
 * UI Settings Tab - 界面设置选项卡
 * 使用增强版主题选择器和现代化UI设计
 */

'use client';

import React from 'react';
import {
    Globe,
    Eye,
    Bug,
    Languages,
    Image,
    Link,
    Sparkles,
    Settings,
    Info,
    Palette,
    Sliders
} from 'lucide-react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Switch,
    Separator,
    Badge,
    Alert,
    AlertDescription,
    Slider
} from '@/components/ui';


import { useUISettings } from '../../data-access';
import { EnhancedThemeSelector } from './EnhancedThemeSelector';

const LANGUAGES = [
    { value: 'system', label: '跟随系统', flag: '🌐' },
    { value: 'zh', label: '中文', flag: '🇨🇳' },
    { value: 'en', label: 'English', flag: '🇺🇸' },
    { value: 'ja', label: '日本語', flag: '🇯🇵' },
    { value: 'ko', label: '한국어', flag: '🇰🇷' },
    { value: 'fr', label: 'Français', flag: '🇫🇷' },
    { value: 'de', label: 'Deutsch', flag: '🇩🇪' },
    { value: 'es', label: 'Español', flag: '🇪🇸' }
];

export function UISettingsTab() {
    const { settings, updateSettings } = useUISettings();

    return (
        <div className="space-y-8">
            {/* 主题设置 - 使用新的增强版选择器 */}
            <EnhancedThemeSelector
                settings={settings}
                onSettingsChange={updateSettings}
            />

            {/* 语言和本地化设置 */}
            <Card className="overflow-hidden">
                {/* 测试theme-card-blue颜色是否刷新 */}
                {/* <div className="theme-card-blue">   123123123</div> */}
                <CardHeader variant="blue" animated={true}>
                    <CardTitle className="flex items-center gap-2">
                        <Languages className="w-5 h-5 text-blue-600" />
                        语言设置
                    </CardTitle>
                    <CardDescription>
                        选择您的首选语言和地区设置
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="space-y-4">
                        <div className="space-y-3">
                            <Label htmlFor="language" className="flex items-center gap-2">
                                <Globe className="w-4 h-4" />
                                界面语言
                            </Label>
                            <Select
                                value={settings.language}
                                onValueChange={(value) => updateSettings({ language: value })}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="选择语言" />
                                </SelectTrigger>
                                <SelectContent>
                                    {LANGUAGES.map(lang => (
                                        <SelectItem key={lang.value} value={lang.value}>
                                            <div className="flex items-center gap-3">
                                                <span className="text-lg">{lang.flag}</span>
                                                <span>{lang.label}</span>
                                                {lang.value === 'system' && (
                                                    <Badge variant="outline" className="ml-auto text-xs">
                                                        推荐
                                                    </Badge>
                                                )}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <Alert>
                            <Info className="h-4 w-4" />
                            <AlertDescription>
                                选择"跟随系统"将根据您的操作系统语言设置自动选择最合适的语言。
                            </AlertDescription>
                        </Alert>
                    </div>
                </CardContent>
            </Card>

            {/* 界面功能设置 */}
            <Card className="overflow-hidden">
                <CardHeader variant="green" animated={true}>
                    <CardTitle className="flex items-center gap-2">
                        <Eye className="w-5 h-5 text-green-600" />
                        界面功能
                    </CardTitle>
                    <CardDescription>
                        控制界面功能的显示和行为方式
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    {/* 引用显示设置 */}
                    <div className="space-y-4">
                        <div className="flex items-start justify-between">
                            <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-2">
                                    <Link className="w-4 h-4 text-blue-600" />
                                    <Label htmlFor="references" className="font-medium">
                                        显示引用链接
                                    </Label>
                                    <Badge variant="success" className="text-xs">
                                        推荐
                                    </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    在AI回答中显示来源引用和参考链接，提高信息的可信度和可追溯性
                                </p>
                            </div>
                            <Switch
                                id="references"
                                checked={settings.references === 'enable'}
                                onCheckedChange={(checked) =>
                                    updateSettings({ references: checked ? 'enable' : 'disable' })
                                }
                                className="ml-4"
                            />
                        </div>

                        <Separator />

                        <div className="flex items-start justify-between">
                            <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-2">
                                    <Image className="w-4 h-4 text-purple-600" />
                                    <Label htmlFor="citationImage" className="font-medium">
                                        引用图片预览
                                    </Label>
                                    <Badge variant="warning" className="text-xs">
                                        实验性
                                    </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    在引用中显示网站截图和预览图片，提供更丰富的视觉信息
                                </p>
                            </div>
                            <Switch
                                id="citationImage"
                                checked={settings.citationImage === 'enable'}
                                onCheckedChange={(checked) =>
                                    updateSettings({ citationImage: checked ? 'enable' : 'disable' })
                                }
                                className="ml-4"
                            />
                        </div>
                    </div>

                    <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20">
                        <Sparkles className="h-4 w-4 text-blue-600" />
                        <AlertDescription className="text-blue-800 dark:text-blue-200">
                            这些功能可以帮助您更好地理解和验证AI提供的信息。
                            您可以随时在这里调整这些设置。
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>

            {/* 开发者设置 */}
            <Card className="overflow-hidden border-orange-200 dark:border-orange-800">
                <CardHeader variant="orange" animated={true}>
                    <CardTitle className="flex items-center gap-2">
                        <Bug className="w-5 h-5 text-orange-600" />
                        开发者选项
                    </CardTitle>
                    <CardDescription>
                        高级调试和开发相关的设置选项
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="space-y-4">
                        <div className="flex items-start justify-between">
                            <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-2">
                                    <Settings className="w-4 h-4 text-orange-600" />
                                    <Label htmlFor="debug" className="font-medium">
                                        调试模式
                                    </Label>
                                    <Badge variant="destructive" className="text-xs">
                                        开发者
                                    </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    启用详细的调试信息和错误日志，帮助诊断问题和优化性能
                                </p>
                            </div>
                            <Switch
                                id="debug"
                                checked={settings.debug === 'enable'}
                                onCheckedChange={(checked) =>
                                    updateSettings({ debug: checked ? 'enable' : 'disable' })
                                }
                                className="ml-4"
                            />
                        </div>

                        <Alert className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20">
                            <Bug className="h-4 w-4 text-orange-600" />
                            <AlertDescription className="text-orange-800 dark:text-orange-200">
                                <strong>注意：</strong> 调试模式会显示额外的技术信息，
                                建议仅在需要排查问题时启用。
                            </AlertDescription>
                        </Alert>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
