/**
 * 颜色自定义组件
 * 
 * 允许用户自定义主题颜色，包括：
 * 1. 主色调选择
 * 2. 预设颜色方案
 * 3. 自定义颜色设置
 * 4. 实时预览
 */

'use client';

import React, { useState } from 'react';
import { Paintbrush, RotateCcw, Check } from 'lucide-react';
import {

} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useTheme, setCSSVariable } from '@/providers';

// ========== 完整主题配色方案 ==========
const COLOR_PRESETS = [
    {
        name: 'default',
        label: '默认蓝色',
        description: '经典的蓝色主题',
        colors: {
            // 功能色
            primary: '#3b82f6',
            success: '#10b981',
            warning: '#f59e0b',
            error: '#ef4444',
            // 背景色
            backgroundPrimary: '#ffffff',
            backgroundSecondary: '#f8fafc',
            backgroundTertiary: '#f1f5f9',
            // 文字色
            foregroundPrimary: '#0f172a',
            foregroundSecondary: '#475569',
            foregroundTertiary: '#64748b',
            // 边框色
            borderPrimary: '#e2e8f0',
            borderSecondary: '#cbd5e1'
        }
    },
    {
        name: 'purple',
        label: '紫色雅致',
        description: '优雅的紫色调',
        colors: {
            primary: '#8b5cf6',
            success: '#10b981',
            warning: '#f59e0b',
            error: '#ef4444',
            backgroundPrimary: '#fefefe',
            backgroundSecondary: '#faf8ff',
            backgroundTertiary: '#f3f0ff',
            foregroundPrimary: '#1e1b4b',
            foregroundSecondary: '#4c1d95',
            foregroundTertiary: '#6d28d9',
            borderPrimary: '#e9d5ff',
            borderSecondary: '#c4b5fd'
        }
    },
    {
        name: 'green',
        label: '自然绿色',
        description: '清新的绿色主题',
        colors: {
            primary: '#059669',
            success: '#10b981',
            warning: '#f59e0b',
            error: '#ef4444',
            backgroundPrimary: '#ffffff',
            backgroundSecondary: '#f0fdf4',
            backgroundTertiary: '#dcfce7',
            foregroundPrimary: '#064e3b',
            foregroundSecondary: '#065f46',
            foregroundTertiary: '#047857',
            borderPrimary: '#bbf7d0',
            borderSecondary: '#86efac'
        }
    },
    {
        name: 'orange',
        label: '活力橙色',
        description: '充满活力的橙色',
        colors: {
            primary: '#ea580c',
            success: '#10b981',
            warning: '#f59e0b',
            error: '#ef4444',
            backgroundPrimary: '#ffffff',
            backgroundSecondary: '#fff7ed',
            backgroundTertiary: '#ffedd5',
            foregroundPrimary: '#7c2d12',
            foregroundSecondary: '#9a3412',
            foregroundTertiary: '#c2410c',
            borderPrimary: '#fed7aa',
            borderSecondary: '#fdba74'
        }
    },
    {
        name: 'rose',
        label: '玫瑰粉色',
        description: '温柔的粉色调',
        colors: {
            primary: '#e11d48',
            success: '#10b981',
            warning: '#f59e0b',
            error: '#ef4444',
            backgroundPrimary: '#ffffff',
            backgroundSecondary: '#fff1f2',
            backgroundTertiary: '#fce7e7',
            foregroundPrimary: '#881337',
            foregroundSecondary: '#9f1239',
            foregroundTertiary: '#be185d',
            borderPrimary: '#fecaca',
            borderSecondary: '#fca5a5'
        }
    },
    {
        name: 'slate',
        label: '石板灰色',
        description: '专业的灰色主题',
        colors: {
            primary: '#475569',
            success: '#10b981',
            warning: '#f59e0b',
            error: '#ef4444',
            backgroundPrimary: '#ffffff',
            backgroundSecondary: '#f8fafc',
            backgroundTertiary: '#f1f5f9',
            foregroundPrimary: '#0f172a',
            foregroundSecondary: '#334155',
            foregroundTertiary: '#64748b',
            borderPrimary: '#e2e8f0',
            borderSecondary: '#cbd5e1'
        }
    },
    {
        name: 'dark-blue',
        label: '深蓝夜色',
        description: '深色蓝色主题',
        colors: {
            primary: '#60a5fa',
            success: '#34d399',
            warning: '#fbbf24',
            error: '#f87171',
            backgroundPrimary: '#0f172a',
            backgroundSecondary: '#1e293b',
            backgroundTertiary: '#334155',
            foregroundPrimary: '#f8fafc',
            foregroundSecondary: '#e2e8f0',
            foregroundTertiary: '#cbd5e1',
            borderPrimary: '#475569',
            borderSecondary: '#64748b'
        }
    }
] as const;

interface ColorCustomizerProps {
    className?: string;
}

export function ColorCustomizer({ className }: ColorCustomizerProps) {
    const { currentTheme } = useTheme();
    const [selectedPreset, setSelectedPreset] = useState('default');
    const [isCustomizing, setIsCustomizing] = useState(false);

    // ========== 应用颜色预设 ==========
    const applyColorPreset = (preset: (typeof COLOR_PRESETS)[number]) => {
        const { colors } = preset;

        // 应用功能色到CSS变量
        setCSSVariable('--color-accent', colors.primary);
        setCSSVariable('--color-success', colors.success);
        setCSSVariable('--color-warning', colors.warning);
        setCSSVariable('--color-error', colors.error);

        // 应用背景色
        setCSSVariable('--color-background-primary', colors.backgroundPrimary);
        setCSSVariable('--color-background-secondary', colors.backgroundSecondary);
        setCSSVariable('--color-background-tertiary', colors.backgroundTertiary);

        // 应用文字色
        setCSSVariable('--color-foreground-primary', colors.foregroundPrimary);
        setCSSVariable('--color-foreground-secondary', colors.foregroundSecondary);
        setCSSVariable('--color-foreground-tertiary', colors.foregroundTertiary);

        // 应用边框色
        setCSSVariable('--color-border-primary', colors.borderPrimary);
        setCSSVariable('--color-border-secondary', colors.borderSecondary);

        setSelectedPreset(preset.name);

        // 显示应用成功的反馈
        setIsCustomizing(true);
        setTimeout(() => setIsCustomizing(false), 1000);
    };

    // ========== 重置为默认颜色 ==========
    const resetToDefault = () => {
        const defaultPreset = COLOR_PRESETS[0];
        applyColorPreset(defaultPreset);
    };

    return (
        <div className={className}>
            <div className="flex items-center gap-2 mb-4">
                <Paintbrush className="w-4 h-4 text-purple-600" />
                <span className="font-medium">颜色自定义</span>
                {isCustomizing && (
                    <Badge variant="outline" className="ml-2">
                        <Check className="w-3 h-3 mr-1" />
                        已应用
                    </Badge>
                )}
            </div>
            <div className="space-y-4">
                {/* 预设颜色方案 */}
                <div className="space-y-3">
                    <Label className="text-base font-medium">预设颜色方案</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {COLOR_PRESETS.map((preset) => (
                            <div
                                key={preset.name}
                                className="p-3 border rounded-lg cursor-pointer transition-all hover:shadow-md"
                                style={{
                                    backgroundColor: preset.colors.backgroundPrimary,
                                    borderColor: selectedPreset === preset.name ? preset.colors.primary : preset.colors.borderPrimary,
                                    color: preset.colors.foregroundPrimary
                                }}
                                onClick={() => applyColorPreset(preset)}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-medium text-sm">{preset.label}</h4>
                                    {selectedPreset === preset.name && (
                                        <Check className="w-4 h-4" style={{ color: preset.colors.success }} />
                                    )}
                                </div>
                                <p className="text-xs mb-2 opacity-75">
                                    {preset.description}
                                </p>

                                {/* 背景色层叠示例 */}
                                <div className="mb-2 relative h-5">
                                    <div
                                        className="absolute inset-0 rounded border"
                                        style={{ backgroundColor: preset.colors.backgroundSecondary, borderColor: preset.colors.borderPrimary }}
                                    />
                                    <div
                                        className="absolute left-1 top-1 right-6 bottom-1 rounded"
                                        style={{ backgroundColor: preset.colors.backgroundTertiary }}
                                    />
                                </div>

                                {/* 功能色示例 */}
                                <div className="flex gap-1">
                                    <div
                                        className="w-3 h-3 rounded border"
                                        style={{ backgroundColor: preset.colors.primary, borderColor: preset.colors.borderPrimary }}
                                        title="主色"
                                    />
                                    <div
                                        className="w-3 h-3 rounded border"
                                        style={{ backgroundColor: preset.colors.success, borderColor: preset.colors.borderPrimary }}
                                        title="成功色"
                                    />
                                    <div
                                        className="w-3 h-3 rounded border"
                                        style={{ backgroundColor: preset.colors.warning, borderColor: preset.colors.borderPrimary }}
                                        title="警告色"
                                    />
                                    <div
                                        className="w-3 h-3 rounded border"
                                        style={{ backgroundColor: preset.colors.error, borderColor: preset.colors.borderPrimary }}
                                        title="错误色"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <Separator />

                {/* 实时预览区域 */}
                <div className="space-y-3">
                    <Label className="text-base font-medium">实时预览</Label>
                    <div className="p-4 border rounded-lg bg-muted/20">
                        <h4 className="font-medium mb-3">组件预览</h4>
                        <div className="space-y-3">
                            {/* 按钮预览 */}
                            <div className="flex gap-2 flex-wrap">
                                <Button
                                    size="sm"
                                    style={{
                                        backgroundColor: 'var(--color-accent)',
                                        borderColor: 'var(--color-accent)'
                                    }}
                                >
                                    主要按钮
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    style={{
                                        borderColor: 'var(--color-accent)',
                                        color: 'var(--color-accent)'
                                    }}
                                >
                                    次要按钮
                                </Button>
                            </div>

                            {/* 状态指示器 */}
                            <div className="flex gap-2 flex-wrap">
                                <Badge style={{ backgroundColor: 'var(--color-success)' }}>
                                    成功状态
                                </Badge>
                                <Badge style={{ backgroundColor: 'var(--color-warning)' }}>
                                    警告状态
                                </Badge>
                                <Badge style={{ backgroundColor: 'var(--color-error)' }}>
                                    错误状态
                                </Badge>
                            </div>

                            {/* 颜色值显示 */}
                            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-3 h-3 rounded"
                                        style={{ backgroundColor: 'var(--color-accent)' }}
                                    />
                                    <span>主色调</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-3 h-3 rounded"
                                        style={{ backgroundColor: 'var(--color-success)' }}
                                    />
                                    <span>成功色</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-3 h-3 rounded"
                                        style={{ backgroundColor: 'var(--color-warning)' }}
                                    />
                                    <span>警告色</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-3 h-3 rounded"
                                        style={{ backgroundColor: 'var(--color-error)' }}
                                    />
                                    <span>错误色</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <Separator />

                {/* 操作按钮 */}
                <div className="flex items-center justify-between">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={resetToDefault}
                        className="flex items-center gap-2"
                    >
                        <RotateCcw className="w-4 h-4" />
                        重置默认
                    </Button>

                    <div className="text-xs text-muted-foreground">
                        当前主题: <span className="font-medium">{currentTheme}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ColorCustomizer;
