/**
 * Theme Selector - 统一的主题选择器组件
 * 包含深色模式开关和颜色主题卡片选择
 */

'use client';

import React from 'react';
import { Palette, Sun, Moon, Monitor, Check } from 'lucide-react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

import { useUISettings } from '../../data-access';
import { useTheme } from '@/providers';
import { colorPresets, generatePreviewColors } from '@/lib/theme/theme-config';

interface ThemeState {
    colorScheme: string;  // 颜色方案 (default, green, orange, purple, etc.)
    darkMode: boolean;    // 深色模式
    followSystem: boolean; // 跟随系统
}

export function ThemeSelector() {
    const { settings, updateSettings } = useUISettings();
    const { systemTheme } = useTheme();

    // 计算当前状态
    const currentState: ThemeState = {
        colorScheme: settings.customTheme?.colorPresetName || 'default',
        darkMode: settings.customTheme?.isDarkMode || false,
        followSystem: settings.theme === 'system'
    };

    // 处理跟随系统开关
    const handleFollowSystemChange = (follow: boolean) => {
        if (follow) {
            // 开启跟随系统
            updateSettings({ theme: 'system' });
        } else {
            // 关闭跟随系统，切换到自定义主题
            updateSettings({
                theme: 'custom',
                customTheme: {
                    colorPresetName: currentState.colorScheme,
                    isDarkMode: currentState.darkMode,
                    customColors: settings.customTheme?.customColors
                }
            });
        }
    };

    // 处理深色模式开关
    const handleDarkModeChange = (dark: boolean) => {
        if (currentState.followSystem) {
            // 如果在跟随系统模式，先切换到自定义模式
            updateSettings({
                theme: 'custom',
                customTheme: {
                    colorPresetName: currentState.colorScheme,
                    isDarkMode: dark,
                    customColors: settings.customTheme?.customColors
                }
            });
        } else {
            // 直接更新深色模式
            updateSettings({
                theme: 'custom',
                customTheme: {
                    colorPresetName: currentState.colorScheme,
                    isDarkMode: dark,
                    customColors: settings.customTheme?.customColors
                }
            });
        }
    };

    // 处理颜色主题选择
    const handleColorSchemeChange = (colorPresetName: string) => {
        if (currentState.followSystem) {
            // 如果在跟随系统模式，先切换到自定义模式
            updateSettings({
                theme: 'custom',
                customTheme: {
                    colorPresetName,
                    isDarkMode: systemTheme === 'dark', // 使用当前系统主题
                    customColors: undefined // 重置自定义颜色
                }
            });
        } else {
            // 直接更新颜色方案
            updateSettings({
                theme: 'custom',
                customTheme: {
                    colorPresetName,
                    isDarkMode: currentState.darkMode,
                    customColors: undefined // 重置自定义颜色
                }
            });
        }
    };

    // 获取当前实际生效的主题状态（考虑跟随系统）
    const effectiveTheme = {
        darkMode: currentState.followSystem ? systemTheme === 'dark' : currentState.darkMode,
        colorScheme: currentState.colorScheme
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Palette className="w-5 h-5 text-primary" />
                    主题设置
                </CardTitle>
                <CardDescription>
                    选择您喜欢的主题外观和颜色方案
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* 深色模式控制区域 */}
                <div className="space-y-4">
                    <h3 className="text-sm font-medium">模式控制</h3>

                    {/* 跟随系统开关 */}
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                        <div className="flex items-center gap-3">
                            <Monitor className="w-5 h-5 text-slate-600" />
                            <div>
                                <Label htmlFor="follow-system" className="font-medium">
                                    跟随系统
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    自动根据系统设置切换浅色/深色模式
                                </p>
                            </div>
                        </div>
                        <Switch
                            id="follow-system"
                            checked={currentState.followSystem}
                            onCheckedChange={handleFollowSystemChange}
                        />
                    </div>

                    {/* 深色模式开关 */}
                    <div className={`flex items-center justify-between p-3 rounded-lg border transition-opacity ${currentState.followSystem ? 'opacity-50' : 'bg-muted/20'
                        }`}>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <Sun className="w-4 h-4 text-orange-500" />
                                <Moon className="w-4 h-4 text-slate-600" />
                            </div>
                            <div>
                                <Label htmlFor="dark-mode" className="font-medium">
                                    深色模式
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    {currentState.followSystem
                                        ? `当前: ${systemTheme === 'dark' ? '深色' : '浅色'} (跟随系统)`
                                        : '手动控制界面明暗'
                                    }
                                </p>
                            </div>
                        </div>
                        <Switch
                            id="dark-mode"
                            checked={effectiveTheme.darkMode}
                            onCheckedChange={handleDarkModeChange}
                            disabled={currentState.followSystem}
                        />
                    </div>
                </div>

                <Separator />

                {/* 颜色主题选择区域 */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium">颜色主题</h3>
                        <Badge variant="outline" className="text-xs">
                            {colorPresets.find(p => p.name === effectiveTheme.colorScheme)?.label}
                        </Badge>
                    </div>

                    {/* 主题卡片网格 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {colorPresets.map((preset) => {
                            const isSelected = effectiveTheme.colorScheme === preset.name;
                            const lightColors = generatePreviewColors(preset, false);
                            const darkColors = generatePreviewColors(preset, true);

                            return (
                                <Card
                                    key={preset.name}
                                    className={`cursor-pointer transition-all duration-200 hover:shadow-md relative ${isSelected
                                        ? 'ring-2 ring-blue-500 shadow-md'
                                        : 'hover:ring-1 hover:ring-gray-300'
                                        }`}
                                    onClick={() => handleColorSchemeChange(preset.name)}
                                >
                                    <CardContent className="p-4">
                                        {/* 选中标识 */}
                                        {isSelected && (
                                            <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                                                <Check className="w-3 h-3 text-white" />
                                            </div>
                                        )}

                                        {/* 双色预览 */}
                                        <div className="space-y-2 mb-3">
                                            <div className="flex h-12 rounded-md overflow-hidden border">
                                                {/* 浅色版本 */}
                                                <div className="flex-1 flex flex-col">
                                                    <div
                                                        className="flex-1"
                                                        style={{ backgroundColor: lightColors.primary }}
                                                    />
                                                    <div
                                                        className="flex-1"
                                                        style={{ backgroundColor: lightColors.secondary }}
                                                    />
                                                </div>
                                                {/* 深色版本 */}
                                                <div className="flex-1 flex flex-col">
                                                    <div
                                                        className="flex-1"
                                                        style={{ backgroundColor: darkColors.primary }}
                                                    />
                                                    <div
                                                        className="flex-1"
                                                        style={{ backgroundColor: darkColors.secondary }}
                                                    />
                                                </div>
                                                {/* 主色调示 */}
                                                <div
                                                    className="w-3"
                                                    style={{ backgroundColor: preset.colors.primary }}
                                                />
                                            </div>

                                            {/* 颜色点预览 */}
                                            <div className="flex justify-center gap-1">
                                                <div
                                                    className="w-2 h-2 rounded-full"
                                                    style={{ backgroundColor: preset.colors.primary }}
                                                />
                                                <div
                                                    className="w-2 h-2 rounded-full"
                                                    style={{ backgroundColor: preset.colors.success }}
                                                />
                                                <div
                                                    className="w-2 h-2 rounded-full"
                                                    style={{ backgroundColor: preset.colors.warning }}
                                                />
                                                <div
                                                    className="w-2 h-2 rounded-full"
                                                    style={{ backgroundColor: preset.colors.error }}
                                                />
                                            </div>
                                        </div>

                                        {/* 主题信息 */}
                                        <div className="space-y-1">
                                            <h4 className="text-sm font-medium">{preset.label}</h4>
                                            <p className="text-xs text-muted-foreground line-clamp-2">
                                                {preset.description}
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>

                {/* 当前状态显示 */}
                <div className="pt-4 border-t bg-muted/10 rounded-lg p-3">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">当前主题:</span>
                        <div className="flex items-center gap-2">
                            <span className="font-medium">
                                {colorPresets.find(p => p.name === effectiveTheme.colorScheme)?.label}
                            </span>
                            <Badge variant={effectiveTheme.darkMode ? "default" : "secondary"} className="text-xs">
                                {effectiveTheme.darkMode ? '深色' : '浅色'}
                            </Badge>
                            {currentState.followSystem && (
                                <Badge variant="outline" className="text-xs">
                                    跟随系统
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
