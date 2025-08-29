/**
 * 简化版主题提供者组件
 * 
 * 新的设计理念：
 * 1. 移除复杂的HSL转换和映射逻辑
 * 2. 直接使用简单的CSS变量
 * 3. 专注于用户体验而非技术复杂性
 * 4. 与现有系统兼容，支持渐进式迁移
 */

'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { useUISettings } from '@/features/user/settings/data-access';
import {
    colorPresets,
    createTheme,
    generateCSSVariables,
    detectSystemTheme,
    type Theme,
    type ColorPreset
} from '@/lib/theme/theme-config';

// ========== 上下文类型 ==========
interface ThemeContextType {
    // 当前主题
    theme: Theme;
    // 用户设置的主题模式
    themeMode: 'light' | 'dark' | 'system' | 'custom';
    // 系统检测到的主题
    systemTheme: 'light' | 'dark';
    // 可用的颜色预设
    availablePresets: ColorPreset[];
    // 主题切换函数
    setThemeMode: (mode: 'light' | 'dark' | 'system' | 'custom') => void;
    // 颜色预设切换函数
    setColorPreset: (presetName: string) => void;
    // 是否正在加载
    isLoading: boolean;
    // 应用主题到DOM
    applyTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// ========== 主题提供者组件 ==========
interface ThemeProviderProps {
    children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
    // 从设置中获取用户主题偏好
    const { settings, updateSettings } = useUISettings();

    // 系统主题检测
    const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light');
    const [isLoading, setIsLoading] = useState(true);
    const [isMounted, setIsMounted] = useState(false);

    // 客户端挂载检测
    useEffect(() => {
        setIsMounted(true);
        setSystemTheme(detectSystemTheme());
        setIsLoading(false);
    }, []);

    // 系统主题变化监听
    useEffect(() => {
        if (!isMounted) return;

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const handleChange = (e: MediaQueryListEvent) => {
            setSystemTheme(e.matches ? 'dark' : 'light');
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [isMounted]);

    // 计算当前应该使用的主题
    const currentTheme: Theme = useMemo(() => {
        // 确定是否应该使用深色模式
        const shouldUseDark = (() => {
            if (settings.theme === 'dark') return true;
            if (settings.theme === 'light') return false;
            if (settings.theme === 'system') return systemTheme === 'dark';
            if (settings.theme === 'custom' && settings.customTheme) {
                return settings.customTheme.isDarkMode;
            }
            return false;
        })();

        // 确定颜色预设
        const presetName = settings.customTheme?.colorPresetName || 'blue';

        // 创建主题
        const theme = createTheme(presetName, shouldUseDark);

        if (!theme) {
            // 回退到默认主题
            return createTheme('blue', shouldUseDark) || {
                name: 'blue-light',
                isDark: false,
                colors: colorPresets[0].colors
            };
        }

        return theme;
    }, [settings.theme, settings.customTheme, systemTheme]);

    // 应用主题到DOM的函数
    const applyTheme = useCallback((theme: Theme) => {
        if (typeof window === 'undefined') return;

        console.log('🎨 [DEBUG] 应用主题:', theme);

        const variables = generateCSSVariables(theme);
        const root = document.documentElement;
        // 记录应用前的状态
        const beforeState = {
            darkClass: root.classList.contains('dark'),
            lightClass: root.classList.contains('light'),
            dataTheme: root.getAttribute('data-theme'),
            iconBlue: root.style.getPropertyValue('--icon-blue'),
            iconGreen: root.style.getPropertyValue('--icon-green'),
        };


        // 应用CSS变量
        Object.entries(variables).forEach(([property, value]) => {
            root.style.setProperty(property, value);
        });

        // 设置主题属性和类
        root.setAttribute('data-theme', theme.name);
        root.classList.toggle('dark', theme.isDark);
        root.classList.toggle('light', !theme.isDark);

        // 为新系统添加标识
        root.classList.add('simplified-theme');
        const afterState = {
            darkClass: root.classList.contains('dark'),
            lightClass: root.classList.contains('light'),
            dataTheme: root.getAttribute('data-theme'),
            iconBlue: root.style.getPropertyValue('--icon-blue'),
            iconGreen: root.style.getPropertyValue('--icon-green'),
        };

        console.log('🎨 [DEBUG] 主题应用完成:', {
            themeName: theme.name,
            isDark: theme.isDark,
            variablesCount: Object.keys(variables).length,
            classChanges: {
                before: beforeState,
                after: afterState,
                darkClassChanged: beforeState.darkClass !== afterState.darkClass,
                colorChanged: beforeState.iconBlue !== afterState.iconBlue
            },
            iconColors: {
                blue: variables['--icon-blue'],
                green: variables['--icon-green'],
                red: variables['--icon-red']
            }
        });

        // if (process.env.NODE_ENV === 'development') {
        //     console.log('🎨 简化主题已应用:', {
        //         theme: theme.name,
        //         isDark: theme.isDark,
        //         variablesCount: Object.keys(variables).length,
        //         iconColors: {
        //             blue: variables['--icon-blue'],
        //             green: variables['--icon-green'],
        //             yellow: variables['--icon-yellow'],
        //             red: variables['--icon-red'],
        //             cyan: variables['--icon-cyan'],
        //             gray: variables['--icon-gray'],
        //             purple: variables['--icon-purple'],
        //             pink: variables['--icon-pink'],
        //             orange: variables['--icon-orange'],
        //         },
        //         note: `🌈 Icon颜色已自动适配${theme.isDark ? '深色' : '浅色'}模式`
        //     });
        // }
    }, []);

    // 应用当前主题
    useEffect(() => {
        if (isLoading || !isMounted) return;
        applyTheme(currentTheme);
    }, [currentTheme, isLoading, isMounted, applyTheme]);

    // 主题模式切换函数
    const setThemeMode = useCallback((mode: 'light' | 'dark' | 'system' | 'custom') => {
        updateSettings({ theme: mode });
    }, [updateSettings]);

    // 颜色预设切换函数
    const setColorPreset = useCallback((presetName: string) => {
        updateSettings({
            customTheme: {
                ...settings.customTheme,
                colorPresetName: presetName,
                isDarkMode: settings.customTheme?.isDarkMode ?? false
            }
        });
    }, [updateSettings, settings.customTheme]);

    // 上下文值
    const contextValue: ThemeContextType = {
        theme: currentTheme,
        themeMode: settings.theme,
        systemTheme,
        availablePresets: colorPresets,
        setThemeMode,
        setColorPreset,
        isLoading,
        applyTheme
    };

    // 加载状态
    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-white">
                <div className="animate-pulse">
                    <div className="w-8 h-8 bg-blue-600 rounded-full"></div>
                </div>
            </div>
        );
    }

    return (
        <ThemeContext.Provider value={contextValue}>
            {children}
        </ThemeContext.Provider>
    );
}

// ========== 简化版主题Hook ==========
export function useTheme() {
    const context = useContext(ThemeContext);

    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }

    return context;
}

// ========== 兼容性Hook（渐进式迁移用）==========
/**
 * 为现有代码提供兼容性接口
 * 可以让现有组件无缝切换到新系统
 */
export function useThemeCompat() {
    const { theme, themeMode, systemTheme, setThemeMode } = useTheme();

    return {
        // 兼容旧接口
        currentTheme: theme.isDark ? 'dark' : 'light',
        themeConfig: theme,
        userTheme: themeMode,
        systemTheme,
        setTheme: setThemeMode,
        isLoading: false,
        isCustomTheme: themeMode === 'custom',

        // 新接口
        simplifiedTheme: theme,
        colors: theme.colors
    };
}

// ========== 主题工具函数 ==========

/**
 * 获取CSS变量值（简化版）
 */
export function getSimpleCSSVariable(name: string): string {
    if (typeof window === 'undefined') return '';
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * 设置CSS变量值（简化版）
 */
export function setSimpleCSSVariable(name: string, value: string): void {
    if (typeof window === 'undefined') return;
    document.documentElement.style.setProperty(name, value);
}

/**
 * 主题颜色获取器（简化版）
 */
// export function useSimpleThemeColors() {
//     const { theme } = useTheme();

//     return {
//         // 直接返回颜色值，无需复杂计算
//         primary: theme.colors.primary,
//         success: theme.colors.success,
//         warning: theme.colors.warning,
//         error: theme.colors.error,
//         info: theme.colors.info,

//         background: theme.colors.background,
//         backgroundSecondary: theme.colors.backgroundSecondary,
//         backgroundMuted: theme.colors.backgroundMuted,

//         text: theme.colors.text,
//         textSecondary: theme.colors.textSecondary,
//         textMuted: theme.colors.textMuted,

//         border: theme.colors.border,
//         borderSecondary: theme.colors.borderSecondary,

//         // 完整主题对象
//         theme: theme
//     };
// }

export default ThemeProvider;
