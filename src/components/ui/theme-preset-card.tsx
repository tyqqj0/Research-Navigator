/**
 * Theme Preset Card - 主题预设卡片组件
 * 用于展示和选择主题颜色预设
 */

'use client';

import React from 'react';
import { Check, Palette } from 'lucide-react';
import { Card, CardContent } from './card';
import { Badge } from './badge';
import { cn } from '@/lib/utils';
import type { ColorPreset } from '@/lib/theme/theme-config';
import { getColorForTheme } from '@/lib/theme/theme-config';

interface ThemePresetCardProps {
    preset: ColorPreset;
    isSelected: boolean;
    onSelect: () => void;
    className?: string;
    showPreview?: boolean;
    isDark?: boolean;
}

export function ThemePresetCard({
    preset,
    isSelected,
    onSelect,
    className,
    showPreview = true,
    isDark = false
}: ThemePresetCardProps) {
    return (
        <Card
            className={cn(
                "relative cursor-pointer transition-all duration-200 hover:shadow-md",
                "border-2",
                isSelected
                    ? "border-primary shadow-md ring-2 ring-primary/20"
                    : "border-border hover:border-primary/50",
                className
            )}
            onClick={onSelect}
        >
            <CardContent className="p-4">
                {/* 选中状态指示器 */}
                {isSelected && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-primary-foreground" />
                    </div>
                )}

                {/* 主题名称和描述 */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <h3 className="font-medium text-sm">{preset.label}</h3>
                        <Badge variant="outline" className="text-xs">
                            {preset.name}
                        </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2">
                        {preset.description}
                    </p>
                </div>

                {/* 颜色预览 */}
                {showPreview && (
                    <div className="mt-3 space-y-2">
                        {/* 主色调预览 */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">主色调</span>
                            <div className="flex gap-1">
                                <div
                                    className="w-4 h-4 rounded-full border border-border"
                                    style={{ backgroundColor: isDark ? getColorForTheme(preset.colors.primary) : preset.colors.primary }}
                                />
                                <div
                                    className="w-4 h-4 rounded-full border border-border"
                                    style={{ backgroundColor: isDark ? getColorForTheme(preset.colors.success) : preset.colors.success }}
                                />
                                <div
                                    className="w-4 h-4 rounded-full border border-border"
                                    style={{ backgroundColor: isDark ? getColorForTheme(preset.colors.warning) : preset.colors.warning }}
                                />
                                <div
                                    className="w-4 h-4 rounded-full border border-border"
                                    style={{ backgroundColor: isDark ? getColorForTheme(preset.colors.error) : preset.colors.error }}
                                />
                            </div>
                        </div>

                        {/* 背景色预览 */}
                        <div className="grid grid-cols-3 gap-1 h-8 rounded overflow-hidden border border-border">
                            <div
                                className="flex-1"
                                style={{ backgroundColor: isDark ? getColorForTheme(preset.colors.background) : preset.colors.background }}
                            />
                            <div
                                className="flex-1"
                                style={{ backgroundColor: isDark ? getColorForTheme(preset.colors.borderSecondary) : preset.colors.backgroundSecondary }}
                            />
                            <div
                                className="flex-1"
                                style={{ backgroundColor: isDark ? getColorForTheme(preset.colors.primary) : preset.colors.backgroundMuted }}
                            />
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

interface ThemePresetGridProps {
    presets: ColorPreset[];
    selectedPreset: string;
    onPresetChange: (presetName: string) => void;
    className?: string;
    isDark?: boolean;
}

export function ThemePresetGrid({
    presets,
    selectedPreset,
    onPresetChange,
    className,
    isDark = false
}: ThemePresetGridProps) {
    return (
        <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", className)}>
            {presets.map((preset) => (
                <ThemePresetCard
                    key={preset.name}
                    preset={preset}
                    isSelected={selectedPreset === preset.name}
                    onSelect={() => onPresetChange(preset.name)}
                    isDark={isDark}
                />
            ))}
        </div>
    );
}
