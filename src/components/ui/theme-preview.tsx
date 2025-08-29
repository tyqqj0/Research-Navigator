/**
 * Theme Preview - 主题预览组件
 * 实时预览主题效果
 */

'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Button } from './button';
import { Badge } from './badge';
import { Progress } from './progress';
import { Switch } from './switch';
import { Input } from './input';
import { Alert, AlertDescription } from './alert';
import { Separator } from './separator';
import { Info, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ColorPreset } from '@/lib/theme/theme-config';

interface ThemePreviewProps {
    preset: ColorPreset;
    isDark: boolean;
    className?: string;
    compact?: boolean;
}

export function ThemePreview({ preset, isDark, className, compact = false }: ThemePreviewProps) {
    const previewStyle = {
        '--preview-primary': preset.colors.primary,
        '--preview-success': preset.colors.success,
        '--preview-warning': preset.colors.warning,
        '--preview-error': preset.colors.error,
        '--preview-info': preset.colors.info,
        '--preview-background': isDark ? (preset.darkColors?.background || '#0f0f0f') : preset.colors.background,
        '--preview-background-secondary': isDark ? (preset.darkColors?.backgroundSecondary || '#1a1a1a') : preset.colors.backgroundSecondary,
        '--preview-text': isDark ? (preset.darkColors?.text || '#ffffff') : preset.colors.text,
        '--preview-text-secondary': isDark ? (preset.darkColors?.textSecondary || '#a3a3a3') : preset.colors.textSecondary,
        '--preview-border': isDark ? (preset.darkColors?.border || '#333333') : preset.colors.border,
    } as React.CSSProperties;

    if (compact) {
        return (
            <div
                className={cn("rounded-lg border p-4 space-y-3", className)}
                style={previewStyle}
            >
                <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm" style={{ color: 'var(--preview-text)' }}>
                        {preset.label} {isDark ? '(深色)' : '(浅色)'}
                    </h4>
                    <div className="flex gap-1">
                        <div
                            className="w-3 h-3 rounded-full border"
                            style={{ backgroundColor: 'var(--preview-primary)' }}
                        />
                        <div
                            className="w-3 h-3 rounded-full border"
                            style={{ backgroundColor: 'var(--preview-success)' }}
                        />
                        <div
                            className="w-3 h-3 rounded-full border"
                            style={{ backgroundColor: 'var(--preview-warning)' }}
                        />
                        <div
                            className="w-3 h-3 rounded-full border"
                            style={{ backgroundColor: 'var(--preview-error)' }}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-1 h-4 rounded overflow-hidden border">
                    <div style={{ backgroundColor: 'var(--preview-background)' }} />
                    <div style={{ backgroundColor: 'var(--preview-background-secondary)' }} />
                    <div style={{ backgroundColor: 'var(--preview-primary)', opacity: 0.1 }} />
                </div>
            </div>
        );
    }

    return (
        <div
            className={cn(
                "rounded-lg border shadow-sm overflow-hidden",
                className
            )}
            style={{
                ...previewStyle,
                backgroundColor: 'var(--preview-background)',
                borderColor: 'var(--preview-border)',
                color: 'var(--preview-text)'
            }}
        >
            {/* 预览标题 */}
            <div
                className="px-4 py-3 border-b"
                style={{
                    borderColor: 'var(--preview-border)',
                    backgroundColor: 'var(--preview-background-secondary)'
                }}
            >
                <h3 className="font-medium text-sm">
                    {preset.label} - {isDark ? '深色模式' : '浅色模式'}
                </h3>
                <p className="text-xs mt-1" style={{ color: 'var(--preview-text-secondary)' }}>
                    {preset.description}
                </p>
            </div>

            {/* 预览内容 */}
            <div className="p-4 space-y-4">
                {/* 按钮组 */}
                <div className="space-y-2">
                    <p className="text-xs font-medium" style={{ color: 'var(--preview-text-secondary)' }}>
                        按钮组件
                    </p>
                    <div className="flex gap-2 flex-wrap">
                        <button
                            className="px-3 py-1 rounded text-xs font-medium text-white"
                            style={{ backgroundColor: 'var(--preview-primary)' }}
                        >
                            主要按钮
                        </button>
                        <button
                            className="px-3 py-1 rounded text-xs font-medium border"
                            style={{
                                borderColor: 'var(--preview-border)',
                                color: 'var(--preview-text)'
                            }}
                        >
                            次要按钮
                        </button>
                        <button
                            className="px-3 py-1 rounded text-xs font-medium text-white"
                            style={{ backgroundColor: 'var(--preview-success)' }}
                        >
                            成功
                        </button>
                        <button
                            className="px-3 py-1 rounded text-xs font-medium text-white"
                            style={{ backgroundColor: 'var(--preview-error)' }}
                        >
                            危险
                        </button>
                    </div>
                </div>

                {/* 状态徽章 */}
                <div className="space-y-2">
                    <p className="text-xs font-medium" style={{ color: 'var(--preview-text-secondary)' }}>
                        状态徽章
                    </p>
                    <div className="flex gap-2 flex-wrap">
                        <span
                            className="px-2 py-1 rounded text-xs font-medium"
                            style={{
                                backgroundColor: 'var(--preview-primary)',
                                color: 'white'
                            }}
                        >
                            主要
                        </span>
                        <span
                            className="px-2 py-1 rounded text-xs font-medium"
                            style={{
                                backgroundColor: 'var(--preview-success)',
                                color: 'white'
                            }}
                        >
                            成功
                        </span>
                        <span
                            className="px-2 py-1 rounded text-xs font-medium"
                            style={{
                                backgroundColor: 'var(--preview-warning)',
                                color: 'white'
                            }}
                        >
                            警告
                        </span>
                        <span
                            className="px-2 py-1 rounded text-xs font-medium"
                            style={{
                                backgroundColor: 'var(--preview-error)',
                                color: 'white'
                            }}
                        >
                            错误
                        </span>
                    </div>
                </div>

                {/* 输入框和进度条 */}
                <div className="space-y-2">
                    <p className="text-xs font-medium" style={{ color: 'var(--preview-text-secondary)' }}>
                        表单元素
                    </p>
                    <div className="space-y-2">
                        <input
                            className="w-full px-3 py-2 text-xs rounded border"
                            style={{
                                borderColor: 'var(--preview-border)',
                                backgroundColor: 'var(--preview-background)',
                                color: 'var(--preview-text)'
                            }}
                            placeholder="输入框示例"
                            disabled
                        />
                        <div className="space-y-1">
                            <div
                                className="w-full h-2 rounded overflow-hidden"
                                style={{ backgroundColor: 'var(--preview-background-secondary)' }}
                            >
                                <div
                                    className="h-full rounded"
                                    style={{
                                        backgroundColor: 'var(--preview-primary)',
                                        width: '65%'
                                    }}
                                />
                            </div>
                            <p className="text-xs" style={{ color: 'var(--preview-text-secondary)' }}>
                                进度条 65%
                            </p>
                        </div>
                    </div>
                </div>

                {/* 提示框 */}
                <div className="space-y-2">
                    <p className="text-xs font-medium" style={{ color: 'var(--preview-text-secondary)' }}>
                        提示框
                    </p>
                    <div
                        className="p-3 rounded border-l-4 text-xs"
                        style={{
                            borderLeftColor: 'var(--preview-info)',
                            backgroundColor: 'var(--preview-background-secondary)',
                            color: 'var(--preview-text)'
                        }}
                    >
                        这是一个信息提示框的示例
                    </div>
                </div>
            </div>
        </div>
    );
}

interface ThemePreviewGridProps {
    presets: ColorPreset[];
    selectedPreset: string;
    isDark: boolean;
    className?: string;
}

export function ThemePreviewGrid({
    presets,
    selectedPreset,
    isDark,
    className
}: ThemePreviewGridProps) {
    const currentPreset = presets.find(p => p.name === selectedPreset);

    if (!currentPreset) return null;

    return (
        <div className={cn("space-y-4", className)}>
            <h3 className="font-medium text-sm text-muted-foreground">主题预览</h3>
            <ThemePreview preset={currentPreset} isDark={isDark} />
        </div>
    );
}
