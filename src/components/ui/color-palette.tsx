/**
 * Color Palette - 颜色调色板组件
 * 用于展示和选择颜色
 */

'use client';

import React from 'react';
import { Check, Copy, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

interface ColorSwatchProps {
    color: string;
    label: string;
    isSelected?: boolean;
    onClick?: () => void;
    showLabel?: boolean;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export function ColorSwatch({
    color,
    label,
    isSelected = false,
    onClick,
    showLabel = true,
    size = 'md',
    className
}: ColorSwatchProps) {
    const sizeClasses = {
        sm: 'w-6 h-6',
        md: 'w-8 h-8',
        lg: 'w-12 h-12'
    };

    const handleCopyColor = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(color);
        } catch (error) {
            console.error('Failed to copy color:', error);
        }
    };

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className={cn("space-y-1", className)}>
                        <div
                            className={cn(
                                "relative rounded-md border-2 cursor-pointer transition-all duration-200",
                                "hover:scale-105 hover:shadow-md",
                                sizeClasses[size],
                                isSelected
                                    ? "border-primary shadow-md ring-2 ring-primary/20"
                                    : "border-border hover:border-primary/50"
                            )}
                            style={{ backgroundColor: color }}
                            onClick={onClick}
                        >
                            {isSelected && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Check className="w-3 h-3 text-white drop-shadow-lg" />
                                </div>
                            )}

                            {/* 复制按钮 */}
                            <Button
                                variant="ghost"
                                size="sm"
                                className="absolute -top-1 -right-1 w-5 h-5 p-0 opacity-0 hover:opacity-100 transition-opacity"
                                onClick={handleCopyColor}
                            >
                                <Copy className="w-3 h-3" />
                            </Button>
                        </div>

                        {showLabel && (
                            <div className="text-center">
                                <p className="text-xs font-medium">{label}</p>
                                <p className="text-xs text-muted-foreground font-mono">{color}</p>
                            </div>
                        )}
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{label}: {color}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

interface ColorPaletteProps {
    colors: Array<{
        color: string;
        label: string;
        key: string;
    }>;
    selectedColor?: string;
    onColorSelect?: (colorKey: string, color: string) => void;
    title?: string;
    className?: string;
    swatchSize?: 'sm' | 'md' | 'lg';
    columns?: number;
}

export function ColorPalette({
    colors,
    selectedColor,
    onColorSelect,
    title,
    className,
    swatchSize = 'md',
    columns = 4
}: ColorPaletteProps) {
    return (
        <div className={cn("space-y-3", className)}>
            {title && (
                <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-muted-foreground" />
                    <h3 className="font-medium text-sm">{title}</h3>
                </div>
            )}

            <div
                className="grid gap-3"
                style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
            >
                {colors.map(({ color, label, key }) => (
                    <ColorSwatch
                        key={key}
                        color={color}
                        label={label}
                        isSelected={selectedColor === color}
                        onClick={() => onColorSelect?.(key, color)}
                        size={swatchSize}
                    />
                ))}
            </div>
        </div>
    );
}

interface ColorGradientProps {
    colors: string[];
    direction?: 'horizontal' | 'vertical';
    className?: string;
    height?: string;
}

export function ColorGradient({
    colors,
    direction = 'horizontal',
    className,
    height = '4rem'
}: ColorGradientProps) {
    const gradientDirection = direction === 'horizontal' ? 'to right' : 'to bottom';
    const gradientStyle = {
        background: `linear-gradient(${gradientDirection}, ${colors.join(', ')})`,
        height
    };

    return (
        <div
            className={cn("rounded-md border border-border", className)}
            style={gradientStyle}
        />
    );
}
