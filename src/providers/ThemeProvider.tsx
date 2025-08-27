/**
 * 主题提供者组件
 * 
 * 这个组件负责：
 * 1. 监听用户设置中的主题配置
 * 2. 监听系统主题变化（当设置为'system'时）
 * 3. 应用CSS变量到DOM
 * 4. 提供主题上下文给子组件
 */

'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useUISettings } from '@/features/user/settings/data-access';
import {
    themes,
    generateCSSVariables,
    type ThemeName,
    type ThemeConfig
} from '@/lib/theme/theme-config';

// ========== 上下文类型定义 ==========
interface ThemeContextType {
    // 当前应用的主题名称
    currentTheme: ThemeName;
    // 当前主题配置对象
    themeConfig: ThemeConfig;
    // 用户设置的主题（可能是'system'或'custom'）
    userTheme: 'light' | 'dark' | 'system' | 'custom';
    // 系统检测到的主题
    systemTheme: 'light' | 'dark';
    // 主题切换函数
    setTheme: (theme: 'light' | 'dark' | 'system' | 'custom') => void;
    // 是否正在加载
    isLoading: boolean;
    // 是否是自定义主题模式
    isCustomTheme: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// ========== 主题提供者组件 ==========
interface ThemeProviderProps {
    children: React.ReactNode;
    defaultTheme?: 'light' | 'dark' | 'system' | 'custom';
}

export function ThemeProvider({ children }: ThemeProviderProps) {
    // 从设置中获取用户主题偏好
    const { settings, updateSettings } = useUISettings();

    // 系统主题检测
    const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light');
    const [isLoading, setIsLoading] = useState(true);

    // 计算当前应该应用的主题
    const currentTheme: ThemeName = (() => {
        if (settings.theme === 'system') return systemTheme;
        if (settings.theme === 'custom') return systemTheme; // 自定义主题基于系统主题
        return settings.theme;
    })();

    const themeConfig = themes[currentTheme];
    const isCustomTheme = settings.theme === 'custom';

    // ========== 系统主题检测 ==========
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        // 初始检测
        setSystemTheme(mediaQuery.matches ? 'dark' : 'light');
        setIsLoading(false);

        // 监听变化
        const handleChange = (e: MediaQueryListEvent) => {
            setSystemTheme(e.matches ? 'dark' : 'light');
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    // ========== CSS变量应用 ==========
    useEffect(() => {
        if (!themeConfig || isLoading) return;

        const variables = generateCSSVariables(themeConfig);
        const root = document.documentElement;

        // 应用基础CSS变量（如果不是自定义主题）
        if (!isCustomTheme) {
            Object.entries(variables).forEach(([property, value]) => {
                root.style.setProperty(property, value);
            });
        }

        // 设置data-theme属性，供CSS选择器使用
        const themeAttr = isCustomTheme ? 'custom' : currentTheme;
        root.setAttribute('data-theme', themeAttr);

        // 设置class，兼容Tailwind的dark:前缀
        if (currentTheme === 'dark') {
            root.classList.add('dark');
            root.classList.remove('light');
        } else {
            root.classList.add('light');
            root.classList.remove('dark');
        }

        // 为自定义主题添加额外的class
        if (isCustomTheme) {
            root.classList.add('theme-custom');
        } else {
            root.classList.remove('theme-custom');
        }

        // 调试日志
        if (process.env.NODE_ENV === 'development') {
            console.log('🎨 主题已应用:', {
                userTheme: settings.theme,
                systemTheme,
                currentTheme,
                isCustomTheme,
                variablesCount: Object.keys(variables).length
            });
        }
    }, [themeConfig, currentTheme, systemTheme, isLoading, settings.theme, isCustomTheme]);

    // ========== 主题切换函数 ==========
    const setTheme = (theme: 'light' | 'dark' | 'system' | 'custom') => {
        updateSettings({ theme });
    };

    // ========== 上下文值 ==========
    const contextValue: ThemeContextType = {
        currentTheme,
        themeConfig,
        userTheme: settings.theme,
        systemTheme,
        setTheme,
        isLoading,
        isCustomTheme
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

// ========== 主题Hook ==========
export function useTheme() {
    const context = useContext(ThemeContext);

    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }

    return context;
}

// ========== 主题工具函数 ==========

/**
 * 获取CSS变量值
 */
export function getCSSVariable(name: string): string {
    if (typeof window === 'undefined') return '';
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * 设置CSS变量值
 */
export function setCSSVariable(name: string, value: string): void {
    if (typeof window === 'undefined') return;
    document.documentElement.style.setProperty(name, value);
}

/**
 * 主题颜色获取器
 */
export function useThemeColors() {
    const { themeConfig } = useTheme();

    return {
        // 背景色
        background: {
            primary: getCSSVariable('--color-background-primary'),
            secondary: getCSSVariable('--color-background-secondary'),
            tertiary: getCSSVariable('--color-background-tertiary'),
        },
        // 前景色
        foreground: {
            primary: getCSSVariable('--color-foreground-primary'),
            secondary: getCSSVariable('--color-foreground-secondary'),
            tertiary: getCSSVariable('--color-foreground-tertiary'),
        },
        // 功能色
        accent: getCSSVariable('--color-accent'),
        success: getCSSVariable('--color-success'),
        warning: getCSSVariable('--color-warning'),
        error: getCSSVariable('--color-error'),
        info: getCSSVariable('--color-info'),
        // 完整配置
        config: themeConfig.colors
    };
}

/**
 * 响应式主题检测
 */
export function useSystemTheme() {
    const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light');

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        setSystemTheme(mediaQuery.matches ? 'dark' : 'light');

        const handleChange = (e: MediaQueryListEvent) => {
            setSystemTheme(e.matches ? 'dark' : 'light');
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    return systemTheme;
}

export default ThemeProvider;
