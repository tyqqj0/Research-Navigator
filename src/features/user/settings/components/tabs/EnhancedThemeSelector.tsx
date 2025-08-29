/**
 * Enhanced Theme Selector - 增强版主题选择器
 * 集成了所有主题相关的功能
 */

'use client';

import React, { useState } from 'react';
import { Palette, Settings, Eye, Sparkles } from 'lucide-react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    ThemePresetGrid,
    ThemeModeToggle,
    ThemePreview,
    Alert,
    AlertDescription,
    Button,
    Badge,
    Separator,
    Switch,
    Label
} from '@/components/ui';


import { cn } from '@/lib/utils';
import { colorPresets, type ColorPreset } from '@/lib/theme/theme-config';
import type { UISettings } from '../../data-access/settings-types';

interface EnhancedThemeSelectorProps {
    settings: UISettings;
    onSettingsChange: (settings: Partial<UISettings>) => void;
    className?: string;
}

export function EnhancedThemeSelector({
    settings,
    onSettingsChange,
    className
}: EnhancedThemeSelectorProps) {
    const [activeTab, setActiveTab] = useState('presets');

    // 计算当前状态
    const currentPreset = settings.customTheme?.colorPresetName || 'blue';
    const isDark = settings.theme === 'dark' ||
        (settings.theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) ||
        (settings.theme === 'custom' && settings.customTheme?.isDarkMode);

    const isSystemMode = settings.theme === 'system';
    const isCustomMode = settings.theme === 'custom';

    // 处理主题模式切换
    const handleModeChange = (mode: 'light' | 'dark' | 'system') => {
        if (mode === 'system') {
            onSettingsChange({ theme: 'system' });
        } else {
            onSettingsChange({
                theme: 'custom',
                customTheme: {
                    ...settings.customTheme,
                    colorPresetName: currentPreset,
                    isDarkMode: mode === 'dark'
                }
            });
        }
    };

    // 处理颜色预设切换
    const handlePresetChange = (presetName: string) => {
        onSettingsChange({
            theme: 'custom',
            customTheme: {
                ...settings.customTheme,
                colorPresetName: presetName,
                isDarkMode: isDark || false
            }
        });
    };

    // 获取当前预设
    const getCurrentPreset = (): ColorPreset => {
        return colorPresets.find(p => p.name === currentPreset) || colorPresets[0];
    };

    // 获取当前预设的深色模式
    const getCurrentPresetDarkMode = (): boolean => {
        return isDark || false;
    };

    // 获取预设的主要颜色
    const getPresetColors = (preset: ColorPreset) => [
        { color: preset.colors.primary, label: '主色调', key: 'primary' },
        { color: preset.colors.success, label: '成功', key: 'success' },
        { color: preset.colors.warning, label: '警告', key: 'warning' },
        { color: preset.colors.error, label: '错误', key: 'error' },
        { color: preset.colors.info, label: '信息', key: 'info' },
    ];

    return (
        <Card className={cn("overflow-hidden", className)}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    主题定制
                </CardTitle>
                <CardDescription>
                    个性化您的界面外观，打造专属的视觉体验
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
                {/* 快速模式切换 */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <Label className="font-medium">主题模式</Label>
                        {isSystemMode && (
                            <Badge variant="outline" className="text-xs">
                                自动
                            </Badge>
                        )}
                        {isCustomMode && (
                            <Badge variant="default" className="text-xs">
                                自定义
                            </Badge>
                        )}
                    </div>

                    <ThemeModeToggle
                        currentMode={settings.theme as 'light' | 'dark' | 'system'}
                        onModeChange={handleModeChange}
                        variant="card"
                    />
                </div>

                <Separator />

                {/* 主题定制选项卡 */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="presets" className="flex items-center gap-2">
                            <Palette className="w-4 h-4" />
                            <span className="hidden sm:inline">预设</span>
                        </TabsTrigger>
                        <TabsTrigger value="preview" className="flex items-center gap-2">
                            <Eye className="w-4 h-4" />
                            <span className="hidden sm:inline">预览</span>
                        </TabsTrigger>
                        <TabsTrigger value="advanced" className="flex items-center gap-2">
                            <Settings className="w-4 h-4" />
                            <span className="hidden sm:inline">高级</span>
                        </TabsTrigger>
                    </TabsList>

                    {/* 颜色预设选择 */}
                    <TabsContent value="presets" className="space-y-4">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="font-medium">颜色方案</Label>
                                <Badge variant="outline" className="text-xs">
                                    {colorPresets.length} 个预设
                                </Badge>
                            </div>

                            <ThemePresetGrid
                                presets={colorPresets}
                                selectedPreset={currentPreset}
                                onPresetChange={handlePresetChange}
                                isDark={getCurrentPresetDarkMode()}
                            />
                        </div>

                        {/* 当前选中预设的颜色展示 */}
                        {/* <div className="space-y-3">
                            <Label className="font-medium">当前配色</Label>
                            <ColorPalette
                                colors={getPresetColors(getCurrentPreset())}
                                swatchSize="md"
                                columns={5}
                            />
                        </div> */}
                    </TabsContent>

                    {/* 主题预览 */}
                    <TabsContent value="preview" className="space-y-4">
                        <div className="space-y-3">
                            <Label className="font-medium">实时预览</Label>
                            <ThemePreview
                                preset={getCurrentPreset()}
                                isDark={isDark || false}
                            />
                        </div>

                        {/* 预览提示 */}
                        <Alert>
                            <Eye className="h-4 w-4" />
                            <AlertDescription>
                                预览显示当前主题在不同组件上的效果。
                                切换主题模式或颜色预设可以实时查看变化。
                            </AlertDescription>
                        </Alert>
                    </TabsContent>

                    {/* 高级设置 */}
                    <TabsContent value="advanced" className="space-y-4">
                        <div className="space-y-4">
                            {/* 主题同步设置 */}
                            <div className="space-y-3">
                                <Label className="font-medium">同步设置</Label>

                                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                                    <div className="space-y-1">
                                        <Label htmlFor="sync-system" className="font-medium">
                                            跟随系统主题
                                        </Label>
                                        <p className="text-xs text-muted-foreground">
                                            自动根据操作系统的主题设置切换浅色/深色模式
                                        </p>
                                    </div>
                                    <Switch
                                        id="sync-system"
                                        checked={isSystemMode}
                                        onCheckedChange={(checked) => {
                                            if (checked) {
                                                handleModeChange('system');
                                            } else {
                                                handleModeChange(isDark ? 'dark' : 'light');
                                            }
                                        }}
                                    />
                                </div>
                            </div>

                            <Separator />

                            {/* 主题信息 */}
                            <div className="space-y-3">
                                <Label className="font-medium">当前主题信息</Label>

                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">主题模式:</span>
                                        <Badge variant="outline">
                                            {isSystemMode ? '跟随系统' :
                                                isCustomMode ? '自定义' :
                                                    settings.theme === 'dark' ? '深色' : '浅色'}
                                        </Badge>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">颜色方案:</span>
                                        <Badge variant="outline">
                                            {getCurrentPreset().label}
                                        </Badge>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">当前显示:</span>
                                        <Badge variant={isDark ? "secondary" : "default"}>
                                            {isDark ? '深色模式' : '浅色模式'}
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* 重置选项 */}
                            <div className="space-y-3">
                                <Label className="font-medium">重置选项</Label>

                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            onSettingsChange({
                                                theme: 'system',
                                                customTheme: {
                                                    colorPresetName: 'blue',
                                                    isDarkMode: false
                                                }
                                            });
                                        }}
                                    >
                                        恢复默认
                                    </Button>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            handlePresetChange('blue');
                                        }}
                                    >
                                        重置颜色
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>

                {/* 快速操作 */}
                {/* <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">快速切换</span>
                    </div>

                    <div className="flex gap-2">
                        <Button
                            variant={isDark ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleModeChange('dark')}
                        >
                            深色
                        </Button>
                        <Button
                            variant={!isDark ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleModeChange('light')}
                        >
                            浅色
                        </Button>
                    </div>
                </div> */}
            </CardContent>
        </Card>
    );
}
