/**
 * Theme Mode Toggle - 主题模式切换组件
 * 支持浅色/深色/跟随系统模式
 */

'use client';

import React from 'react';
import { Sun, Moon, Monitor, Palette } from 'lucide-react';
import { Button } from './button';
import { Card, CardContent } from './card';
import { Label } from './label';
import { Switch } from './switch';
import { Badge } from './badge';
import { cn } from '@/lib/utils';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeModeToggleProps {
    currentMode: ThemeMode;
    onModeChange: (mode: ThemeMode) => void;
    className?: string;
    variant?: 'buttons' | 'switch' | 'card';
}

export function ThemeModeToggle({
    currentMode,
    onModeChange,
    className,
    variant = 'buttons'
}: ThemeModeToggleProps) {
    const modes = [
        {
            key: 'light' as ThemeMode,
            label: '浅色模式',
            icon: Sun,
            description: '明亮的界面主题'
        },
        {
            key: 'dark' as ThemeMode,
            label: '深色模式',
            icon: Moon,
            description: '深色的界面主题'
        },
        {
            key: 'system' as ThemeMode,
            label: '跟随系统',
            icon: Monitor,
            description: '自动跟随系统设置'
        }
    ];

    if (variant === 'buttons') {
        return (
            <div className={cn("flex gap-2", className)}>
                {modes.map((mode) => {
                    const Icon = mode.icon;
                    const isSelected = currentMode === mode.key;

                    return (
                        <Button
                            key={mode.key}
                            variant={isSelected ? "default" : "outline"}
                            size="sm"
                            onClick={() => onModeChange(mode.key)}
                            className={cn(
                                "flex-1 flex items-center gap-2",
                                isSelected && "shadow-md"
                            )}
                        >
                            <Icon className="w-4 h-4" />
                            <span className="hidden sm:inline">{mode.label}</span>
                        </Button>
                    );
                })}
            </div>
        );
    }

    if (variant === 'switch') {
        return (
            <div className={cn("space-y-4", className)}>
                {modes.map((mode) => {
                    const Icon = mode.icon;
                    const isSelected = currentMode === mode.key;

                    return (
                        <div
                            key={mode.key}
                            className="flex items-center justify-between p-3 rounded-lg border bg-muted/20"
                        >
                            <div className="flex items-center gap-3">
                                <Icon className="w-5 h-5 text-muted-foreground" />
                                <div>
                                    <Label className="font-medium">{mode.label}</Label>
                                    <p className="text-xs text-muted-foreground">
                                        {mode.description}
                                    </p>
                                </div>
                            </div>
                            <Switch
                                checked={isSelected}
                                onCheckedChange={(checked) => {
                                    if (checked) {
                                        onModeChange(mode.key);
                                    }
                                }}
                            />
                        </div>
                    );
                })}
            </div>
        );
    }

    if (variant === 'card') {
        return (
            <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-3", className)}>
                {modes.map((mode) => {
                    const Icon = mode.icon;
                    const isSelected = currentMode === mode.key;

                    return (
                        <Card
                            key={mode.key}
                            className={cn(
                                "cursor-pointer transition-all duration-200 hover:shadow-md",
                                "border-2",
                                isSelected
                                    ? "border-primary shadow-md ring-2 ring-primary/20"
                                    : "border-border hover:border-primary/50"
                            )}
                            onClick={() => onModeChange(mode.key)}
                        >
                            <CardContent className="p-4 text-center">
                                <div className="flex flex-col items-center gap-2">
                                    <Icon className={cn(
                                        "w-8 h-8",
                                        isSelected ? "text-primary" : "text-muted-foreground"
                                    )} />
                                    <div>
                                        <p className="font-medium text-sm">{mode.label}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {mode.description}
                                        </p>
                                    </div>
                                    {isSelected && (
                                        <Badge variant="default" className="text-xs">
                                            当前
                                        </Badge>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        );
    }

    return null;
}

interface QuickThemeToggleProps {
    isDark: boolean;
    onToggle: () => void;
    className?: string;
}

export function QuickThemeToggle({ isDark, onToggle, className }: QuickThemeToggleProps) {
    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className={cn("w-9 h-9 p-0", className)}
        >
            {isDark ? (
                <Moon className="w-4 h-4" />
            ) : (
                <Sun className="w-4 h-4" />
            )}
            <span className="sr-only">切换主题</span>
        </Button>
    );
}
