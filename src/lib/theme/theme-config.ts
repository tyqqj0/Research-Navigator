/**
 * 全局主题配置系统
 * 
 * 这个文件是整个应用的主题配置中心，定义了：
 * 1. 颜色系统 (浅色/深色主题)
 * 2. 设计令牌 (间距、圆角、阴影等)
 * 3. 组件样式变量
 * 4. 响应式断点
 */

// ========== 颜色系统 ==========
export const colors = {
    // 主色调系统
    primary: {
        50: '#eff6ff',
        100: '#dbeafe',
        200: '#bfdbfe',
        300: '#93c5fd',
        400: '#60a5fa',
        500: '#3b82f6',  // 主蓝色
        600: '#2563eb',
        700: '#1d4ed8',
        800: '#1e40af',
        900: '#1e3a8a',
        950: '#172554'
    },

    // 功能色彩
    semantic: {
        success: {
            light: '#10b981',
            dark: '#34d399'
        },
        warning: {
            light: '#f59e0b',
            dark: '#fbbf24'
        },
        error: {
            light: '#ef4444',
            dark: '#f87171'
        },
        info: {
            light: '#3b82f6',
            dark: '#60a5fa'
        }
    },

    // 中性色系统
    neutral: {
        light: {
            50: '#fafafa',
            100: '#f5f5f5',
            200: '#e5e5e5',
            300: '#d4d4d4',
            400: '#a3a3a3',
            500: '#737373',
            600: '#525252',
            700: '#404040',
            800: '#262626',
            900: '#171717',
            950: '#0a0a0a'
        },
        dark: {
            50: '#fafafa',
            100: '#f4f4f5',
            200: '#e4e4e7',
            300: '#d4d4d8',
            400: '#a1a1aa',
            500: '#71717a',
            600: '#52525b',
            700: '#3f3f46',
            800: '#27272a',
            900: '#18181b',
            950: '#09090b'
        }
    }
} as const;

// ========== 主题定义 ==========
export interface ThemeConfig {
    colors: {
        // 背景色系统
        background: {
            primary: string;
            secondary: string;
            tertiary: string;
            inverse: string;
        };

        // 前景色/文本系统  
        foreground: {
            primary: string;
            secondary: string;
            tertiary: string;
            inverse: string;
        };

        // 边框色系统
        border: {
            primary: string;
            secondary: string;
            focus: string;
        };

        // 功能色
        accent: string;
        muted: string;
        destructive: string;

        // 状态色
        success: string;
        warning: string;
        error: string;
        info: string;
    };

    // 阴影系统
    shadows: {
        sm: string;
        md: string;
        lg: string;
        xl: string;
    };

    // 圆角系统
    radius: {
        none: string;
        sm: string;
        md: string;
        lg: string;
        xl: string;
        full: string;
    };

    // 间距系统
    spacing: {
        xs: string;
        sm: string;
        md: string;
        lg: string;
        xl: string;
    };
}

// ========== 浅色主题 ==========
export const lightTheme: ThemeConfig = {
    colors: {
        background: {
            primary: '#ffffff',
            secondary: '#f8fafc',
            tertiary: '#f1f5f9',
            inverse: '#0f172a'
        },
        foreground: {
            primary: '#0f172a',
            secondary: '#475569',
            tertiary: '#64748b',
            inverse: '#f8fafc'
        },
        border: {
            primary: '#e2e8f0',
            secondary: '#cbd5e1',
            focus: colors.primary[500]
        },
        accent: colors.primary[500],
        muted: '#f1f5f9',
        destructive: colors.semantic.error.light,
        success: colors.semantic.success.light,
        warning: colors.semantic.warning.light,
        error: colors.semantic.error.light,
        info: colors.semantic.info.light
    },
    shadows: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)'
    },
    radius: {
        none: '0',
        sm: '0.125rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        full: '9999px'
    },
    spacing: {
        xs: '0.5rem',
        sm: '0.75rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem'
    }
};

// ========== 深色主题 ==========
export const darkTheme: ThemeConfig = {
    colors: {
        background: {
            primary: '#0f172a',
            secondary: '#1e293b',
            tertiary: '#334155',
            inverse: '#f8fafc'
        },
        foreground: {
            primary: '#f8fafc',
            secondary: '#cbd5e1',
            tertiary: '#94a3b8',
            inverse: '#0f172a'
        },
        border: {
            primary: '#334155',
            secondary: '#475569',
            focus: colors.primary[400]
        },
        accent: colors.primary[400],
        muted: '#1e293b',
        destructive: colors.semantic.error.dark,
        success: colors.semantic.success.dark,
        warning: colors.semantic.warning.dark,
        error: colors.semantic.error.dark,
        info: colors.semantic.info.dark
    },
    shadows: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.3)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.4)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.4), 0 4px 6px -4px rgb(0 0 0 / 0.4)',
        xl: '0 20px 25px -5px rgb(0 0 0 / 0.4), 0 8px 10px -6px rgb(0 0 0 / 0.4)'
    },
    radius: lightTheme.radius,  // 复用圆角设置
    spacing: lightTheme.spacing  // 复用间距设置
};

// ========== 主题映射 ==========
export const themes = {
    light: lightTheme,
    dark: darkTheme
} as const;

export type ThemeName = keyof typeof themes;

// ========== CSS变量生成器 ==========
export function generateCSSVariables(theme: ThemeConfig): Record<string, string> {
    return {
        // 背景色变量
        '--color-background-primary': theme.colors.background.primary,
        '--color-background-secondary': theme.colors.background.secondary,
        '--color-background-tertiary': theme.colors.background.tertiary,
        '--color-background-inverse': theme.colors.background.inverse,

        // 前景色变量
        '--color-foreground-primary': theme.colors.foreground.primary,
        '--color-foreground-secondary': theme.colors.foreground.secondary,
        '--color-foreground-tertiary': theme.colors.foreground.tertiary,
        '--color-foreground-inverse': theme.colors.foreground.inverse,

        // 边框色变量
        '--color-border-primary': theme.colors.border.primary,
        '--color-border-secondary': theme.colors.border.secondary,
        '--color-border-focus': theme.colors.border.focus,

        // 功能色变量
        '--color-accent': theme.colors.accent,
        '--color-muted': theme.colors.muted,
        '--color-destructive': theme.colors.destructive,
        '--color-success': theme.colors.success,
        '--color-warning': theme.colors.warning,
        '--color-error': theme.colors.error,
        '--color-info': theme.colors.info,

        // 阴影变量
        '--shadow-sm': theme.shadows.sm,
        '--shadow-md': theme.shadows.md,
        '--shadow-lg': theme.shadows.lg,
        '--shadow-xl': theme.shadows.xl,

        // 圆角变量
        '--radius-none': theme.radius.none,
        '--radius-sm': theme.radius.sm,
        '--radius-md': theme.radius.md,
        '--radius-lg': theme.radius.lg,
        '--radius-xl': theme.radius.xl,
        '--radius-full': theme.radius.full,

        // 间距变量
        '--spacing-xs': theme.spacing.xs,
        '--spacing-sm': theme.spacing.sm,
        '--spacing-md': theme.spacing.md,
        '--spacing-lg': theme.spacing.lg,
        '--spacing-xl': theme.spacing.xl
    };
}

// ========== 预设主题选择器 ==========
export const themePresets = [
    {
        name: 'light',
        label: '浅色模式',
        icon: '☀️',
        description: '明亮清爽的界面',
        preview: {
            primary: '#ffffff',
            secondary: '#f8fafc',
            accent: '#3b82f6'
        }
    },
    {
        name: 'dark',
        label: '深色模式',
        icon: '🌙',
        description: '护眼的暗色界面',
        preview: {
            primary: '#0f172a',
            secondary: '#1e293b',
            accent: '#60a5fa'
        }
    },
    {
        name: 'system',
        label: '跟随系统',
        icon: '🌐',
        description: '根据系统设置自动切换',
        preview: {
            primary: 'auto',
            secondary: 'auto',
            accent: 'auto'
        }
    }
] as const;

export default {
    colors,
    themes,
    themePresets,
    generateCSSVariables
};
