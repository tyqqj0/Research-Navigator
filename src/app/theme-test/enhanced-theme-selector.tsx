'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/providers";
import { useUISettings } from "@/features/user/settings/data-access";
import { colorPresets, ColorPreset } from "@/lib/theme/theme-config";
import { Monitor, Sun, Moon, Palette } from "lucide-react";

export function EnhancedThemeSelector() {
    const { theme, themeMode, systemTheme, setThemeMode } = useTheme();
    const { settings, updateSettings } = useUISettings();

    // 当前状态
    const isFollowingSystem = themeMode === 'system';
    const currentColorPreset = settings.customTheme?.colorPresetName || 'default';
    const isDarkMode = themeMode === 'dark';

    // 处理明暗模式切换
    const handleModeChange = (mode: 'light' | 'dark' | 'system') => {
        if (mode === 'system') {
            updateSettings({ theme: 'system' });
        } else {
            updateSettings({
                theme: 'custom',
                customTheme: {
                    colorPresetName: currentColorPreset,
                    isDarkMode: mode === 'dark',
                    customColors: settings.customTheme?.customColors
                }
            });
        }
    };

    // 处理颜色主题切换
    const handleColorPresetChange = (presetName: string) => {
        if (isFollowingSystem) {
            // 如果当前跟随系统，切换到自定义模式
            updateSettings({
                theme: 'custom',
                customTheme: {
                    colorPresetName: presetName,
                    isDarkMode: systemTheme === 'dark',
                    customColors: undefined
                }
            });
        } else {
            // 直接更新颜色预设
            updateSettings({
                theme: 'custom',
                customTheme: {
                    colorPresetName: presetName,
                    isDarkMode: isDarkMode,
                    customColors: undefined
                }
            });
        }
    };

    return (
        <div className="space-y-6">
            {/* 状态显示 */}
            <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2">当前主题状态</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <span className="text-muted-foreground">用户设置: </span>
                        <Badge variant="outline">{themeMode}</Badge>
                    </div>
                    <div>
                        <span className="text-muted-foreground">实际主题: </span>
                        <Badge variant="outline">{theme.name}</Badge>
                    </div>
                    <div>
                        <span className="text-muted-foreground">系统主题: </span>
                        <Badge variant="outline">{systemTheme}</Badge>
                    </div>
                    <div>
                        <span className="text-muted-foreground">颜色方案: </span>
                        <Badge variant="outline">{currentColorPreset}</Badge>
                    </div>
                </div>
            </div>

            {/* 第一部分：明暗模式设置 */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Monitor className="w-5 h-5" />
                        明暗模式设置
                    </CardTitle>
                    <CardDescription>
                        选择浅色、深色主题或跟随系统设置
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                        <Button
                            variant={themeMode === 'light' || (themeMode === 'custom' && !isDarkMode) ? 'default' : 'outline'}
                            onClick={() => handleModeChange('light')}
                            className="flex items-center gap-2"
                        >
                            <Sun className="w-4 h-4" />
                            浅色
                        </Button>
                        <Button
                            variant={themeMode === 'dark' || (themeMode === 'custom' && isDarkMode) ? 'default' : 'outline'}
                            onClick={() => handleModeChange('dark')}
                            className="flex items-center gap-2"
                        >
                            <Moon className="w-4 h-4" />
                            深色
                        </Button>
                        <Button
                            variant={themeMode === 'system' ? 'default' : 'outline'}
                            onClick={() => handleModeChange('system')}
                            className="flex items-center gap-2"
                        >
                            <Monitor className="w-4 h-4" />
                            跟随系统
                        </Button>
                    </div>

                    {/* 跟随系统提示 */}
                    {isFollowingSystem && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                                🌐 当前跟随系统设置，实际显示: <strong>{systemTheme}</strong> 模式
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* 第二部分：颜色主题设置 */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Palette className="w-5 h-5" />
                        颜色主题设置
                    </CardTitle>
                    <CardDescription>
                        选择不同的颜色方案来个性化界面
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {colorPresets.map((preset: ColorPreset) => (
                            <div
                                key={preset.name}
                                className={`relative p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${currentColorPreset === preset.name
                                        ? 'border-primary ring-2 ring-primary/20'
                                        : 'border-border hover:border-primary/50'
                                    }`}
                                onClick={() => handleColorPresetChange(preset.name)}
                            >
                                {/* 选中标识 */}
                                {currentColorPreset === preset.name && (
                                    <div className="absolute top-2 right-2">
                                        <Badge variant="default" className="text-xs">当前</Badge>
                                    </div>
                                )}

                                {/* 颜色预览 */}
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="flex gap-1">
                                        <div
                                            className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                                            style={{ backgroundColor: preset.colors.primary }}
                                        />
                                        <div
                                            className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                                            style={{ backgroundColor: preset.colors.success }}
                                        />
                                        <div
                                            className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                                            style={{ backgroundColor: preset.colors.warning }}
                                        />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold">{preset.label}</h4>
                                    </div>
                                </div>

                                {/* 描述 */}
                                <p className="text-sm text-muted-foreground">
                                    {preset.description}
                                </p>

                                {/* 详细颜色信息 */}
                                <div className="mt-3 text-xs text-muted-foreground">
                                    主色: {preset.colors.primary}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* 颜色切换提示 */}
                    {isFollowingSystem && (
                        <div className="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
                            <p className="text-sm text-orange-700 dark:text-orange-300">
                                💡 选择颜色主题将自动切换到自定义模式，并保持当前的明暗设置
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* 实时效果预览 */}
            <Card>
                <CardHeader>
                    <CardTitle>实时效果预览</CardTitle>
                    <CardDescription>
                        查看当前主题设置的实际效果
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        {/* Tailwind 类效果 */}
                        <div className="space-y-2">
                            <h5 className="font-semibold text-sm">Tailwind 类</h5>
                            <div className="bg-primary text-primary-foreground p-2 rounded text-sm">
                                primary 主色
                            </div>
                            <div className="bg-secondary text-secondary-foreground p-2 rounded text-sm">
                                secondary 次要色
                            </div>
                            <div className="bg-accent text-accent-foreground p-2 rounded text-sm">
                                accent 强调色
                            </div>
                        </div>

                        {/* CSS 变量效果 */}
                        <div className="space-y-2">
                            <h5 className="font-semibold text-sm">CSS 变量</h5>
                            <div
                                className="p-2 rounded text-sm"
                                style={{
                                    backgroundColor: 'var(--color-accent)',
                                    color: 'var(--color-foreground-inverse)'
                                }}
                            >
                                --color-accent
                            </div>
                            <div
                                className="p-2 rounded text-sm"
                                style={{
                                    backgroundColor: 'var(--color-background-secondary)',
                                    color: 'var(--color-foreground-primary)'
                                }}
                            >
                                --color-background-secondary
                            </div>
                            <div
                                className="p-2 rounded text-sm border"
                                style={{
                                    borderColor: 'var(--color-border-primary)',
                                    color: 'var(--color-success)'
                                }}
                            >
                                --color-success
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
