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

// ========== 颜色转换工具 ==========
/**
 * 将HEX颜色转换为HSL格式（不带单位，用于CSS变量）
 */
function hexToHsl(hex: string): string {
    // 移除 # 前缀
    const cleanHex = hex.replace('#', '');

    // 转换为RGB
    const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
    const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
    const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    // 转换为CSS格式（不带单位）
    const hue = Math.round(h * 360);
    const saturation = Math.round(s * 100);
    const lightness = Math.round(l * 100);

    return `${hue} ${saturation}% ${lightness}%`;
}

// ========== CSS变量生成器 ==========
export function generateCSSVariables(theme: ThemeConfig): Record<string, string> {
    // 根据主要颜色生成色阶
    const generateColorScale = (baseColor: string) => {
        // 这是一个简化的实现，实际上可以使用颜色处理库来生成准确的色阶
        return {
            50: '#f0f9ff',
            100: '#e0f2fe',
            200: '#bae6fd',
            300: '#7dd3fc',
            400: '#38bdf8',
            500: baseColor,
            600: '#0284c7',
            700: '#0369a1',
            800: '#075985',
            900: '#0c4a6e',
            950: '#082f49'
        };
    };

    return {
        // ========== shadcn/ui 标准变量 ==========
        // 主要颜色（HSL格式，不带单位）
        '--background': hexToHsl(theme.colors.background.primary),
        '--foreground': hexToHsl(theme.colors.foreground.primary),
        '--card': hexToHsl(theme.colors.background.secondary),
        '--card-foreground': hexToHsl(theme.colors.foreground.primary),
        '--popover': hexToHsl(theme.colors.background.primary),
        '--popover-foreground': hexToHsl(theme.colors.foreground.primary),
        '--primary': hexToHsl(theme.colors.accent), // 主色：蓝色
        '--primary-foreground': hexToHsl(theme.colors.foreground.inverse),
        '--secondary': hexToHsl(theme.colors.muted), // 次要色：灰色背景
        '--secondary-foreground': hexToHsl(theme.colors.foreground.primary),
        '--muted': hexToHsl(theme.colors.muted),
        '--muted-foreground': hexToHsl(theme.colors.foreground.secondary),
        '--accent': hexToHsl(theme.colors.success), // 强调色：绿色
        '--accent-foreground': hexToHsl(theme.colors.foreground.inverse),
        '--destructive': hexToHsl(theme.colors.destructive),
        '--destructive-foreground': hexToHsl(theme.colors.foreground.inverse),
        '--border': hexToHsl(theme.colors.border.primary),
        '--input': hexToHsl(theme.colors.border.primary),
        '--ring': hexToHsl(theme.colors.border.focus),

        // ========== 兼容性变量（保持向后兼容）==========
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
    };
}

// ========== 颜色预设系统 ==========
export interface ColorPreset {
    name: string;
    label: string;
    description: string;
    colors: {
        primary: string;
        success: string;
        warning: string;
        error: string;
        backgroundPrimary: string;
        backgroundSecondary: string;
        backgroundTertiary: string;
        foregroundPrimary: string;
        foregroundSecondary: string;
        foregroundTertiary: string;
        borderPrimary: string;
        borderSecondary: string;
    };
}

export interface ColorPresetWithPreview extends ColorPreset {
    preview: {
        primary: string;
        secondary: string;
        accent: string;
        text: string;
    };
}

export const colorPresets: ColorPresetWithPreview[] = [
    {
        name: 'default',
        label: '默认蓝色',
        description: '经典的蓝色主题，适合商务和专业场景',
        colors: {
            primary: '#3b82f6',
            success: '#10b981',
            warning: '#f59e0b',
            error: '#ef4444',
            backgroundPrimary: '#ffffff',
            backgroundSecondary: '#f8fafc',
            backgroundTertiary: '#f1f5f9',
            foregroundPrimary: '#0f172a',
            foregroundSecondary: '#475569',
            foregroundTertiary: '#64748b',
            borderPrimary: '#e2e8f0',
            borderSecondary: '#cbd5e1'
        },
        preview: {
            primary: '#ffffff',
            secondary: '#f8fafc',
            accent: '#3b82f6',
            text: '#0f172a'
        }
    },
    {
        name: 'purple',
        label: '紫色雅致',
        description: '优雅的紫色主题，创意和设计感十足',
        colors: {
            primary: '#8b5cf6',
            success: '#10b981',
            warning: '#f59e0b',
            error: '#ef4444',
            backgroundPrimary: '#fefefe',
            backgroundSecondary: '#faf8ff',
            backgroundTertiary: '#f3f0ff',
            foregroundPrimary: '#1f1b2e',
            foregroundSecondary: '#5b5470',
            foregroundTertiary: '#776b87',
            borderPrimary: '#e9e5f5',
            borderSecondary: '#d8d0eb'
        },
        preview: {
            primary: '#fefefe',
            secondary: '#faf8ff',
            accent: '#8b5cf6',
            text: '#1f1b2e'
        }
    },
    {
        name: 'green',
        label: '自然绿色',
        description: '清新的绿色主题，代表成长和活力',
        colors: {
            primary: '#059669',
            success: '#10b981',
            warning: '#f59e0b',
            error: '#ef4444',
            backgroundPrimary: '#fefefe',
            backgroundSecondary: '#f0fdf4',
            backgroundTertiary: '#e7f5e9',
            foregroundPrimary: '#0c1e0f',
            foregroundSecondary: '#365c3e',
            foregroundTertiary: '#4d7857',
            borderPrimary: '#d1f2db',
            borderSecondary: '#a7e9b8'
        },
        preview: {
            primary: '#fefefe',
            secondary: '#f0fdf4',
            accent: '#059669',
            text: '#0c1e0f'
        }
    },
    {
        name: 'orange',
        label: '活力橙色',
        description: '温暖的橙色主题，充满活力和热情',
        colors: {
            primary: '#ea580c',
            success: '#10b981',
            warning: '#f59e0b',
            error: '#ef4444',
            backgroundPrimary: '#fffffe',
            backgroundSecondary: '#fff7ed',
            backgroundTertiary: '#fed7aa',
            foregroundPrimary: '#1c1009',
            foregroundSecondary: '#9a3412',
            foregroundTertiary: '#c2410c',
            borderPrimary: '#fed7aa',
            borderSecondary: '#fdba74'
        },
        preview: {
            primary: '#fffffe',
            secondary: '#fff7ed',
            accent: '#ea580c',
            text: '#1c1009'
        }
    },
    {
        name: 'rose',
        label: '玫瑰粉色',
        description: '温柔的粉色主题，浪漫而优雅',
        colors: {
            primary: '#e11d48',
            success: '#10b981',
            warning: '#f59e0b',
            error: '#ef4444',
            backgroundPrimary: '#fffffe',
            backgroundSecondary: '#fff1f2',
            backgroundTertiary: '#ffe4e6',
            foregroundPrimary: '#1f0a0d',
            foregroundSecondary: '#881337',
            foregroundTertiary: '#be185d',
            borderPrimary: '#fecdd3',
            borderSecondary: '#fda4af'
        },
        preview: {
            primary: '#fffffe',
            secondary: '#fff1f2',
            accent: '#e11d48',
            text: '#1f0a0d'
        }
    },
    {
        name: 'slate',
        label: '现代灰色',
        description: '简约的灰色主题，专业而现代',
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
        },
        preview: {
            primary: '#ffffff',
            secondary: '#f8fafc',
            accent: '#475569',
            text: '#0f172a'
        }
    }
];

// ========== 自定义主题创建工具 ==========

// 深度合并对象的工具函数
function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
    const result = { ...target };

    for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = deepMerge(
                result[key] as Record<string, unknown>,
                source[key] as Record<string, unknown>
            ) as T[typeof key];
        } else if (source[key] !== undefined) {
            result[key] = source[key] as T[typeof key];
        }
    }

    return result;
}

export function createCustomTheme(
    colorPreset: ColorPreset,
    isDark: boolean = false,
    customOverrides?: Partial<ThemeConfig['colors']>
): ThemeConfig {
    const { colors } = colorPreset;

    let baseTheme: ThemeConfig;

    if (isDark) {
        // 深色模式的颜色调整
        baseTheme = {
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
                    focus: colors.primary
                },
                accent: colors.primary,
                muted: '#1e293b',
                destructive: colors.error,
                success: colors.success,
                warning: colors.warning,
                error: colors.error,
                info: colors.primary
            },
            shadows: darkTheme.shadows,
            radius: darkTheme.radius,
            spacing: darkTheme.spacing
        };
    } else {
        // 浅色模式使用预设颜色
        baseTheme = {
            colors: {
                background: {
                    primary: colors.backgroundPrimary,
                    secondary: colors.backgroundSecondary,
                    tertiary: colors.backgroundTertiary,
                    inverse: colors.foregroundPrimary
                },
                foreground: {
                    primary: colors.foregroundPrimary,
                    secondary: colors.foregroundSecondary,
                    tertiary: colors.foregroundTertiary,
                    inverse: colors.backgroundPrimary
                },
                border: {
                    primary: colors.borderPrimary,
                    secondary: colors.borderSecondary,
                    focus: colors.primary
                },
                accent: colors.primary,
                muted: colors.backgroundTertiary,
                destructive: colors.error,
                success: colors.success,
                warning: colors.warning,
                error: colors.error,
                info: colors.primary
            },
            shadows: lightTheme.shadows,
            radius: lightTheme.radius,
            spacing: lightTheme.spacing
        };
    }

    // 如果有自定义覆盖，应用深度合并
    if (customOverrides) {
        baseTheme.colors = deepMerge(baseTheme.colors, customOverrides);
    }

    return baseTheme;
}

// ========== 颜色预设查找工具 ==========
export function getColorPreset(name: string): ColorPresetWithPreview | undefined {
    return colorPresets.find(preset => preset.name === name);
}

// ========== 预览颜色生成工具 ==========
export function generatePreviewColors(preset: ColorPresetWithPreview, isDark: boolean): typeof preset.preview {
    if (isDark) {
        return {
            primary: '#0f172a',
            secondary: '#1e293b',
            accent: preset.colors.primary,
            text: '#f8fafc'
        };
    }
    return preset.preview;
}

// ========== 预设主题选择器 ==========
// export const themePresets = [
//     {
//         name: 'light',
//         label: '浅色模式',
//         icon: '☀️',
//         description: '明亮清爽的界面',
//         preview: {
//             primary: '#ffffff',
//             secondary: '#f8fafc',
//             accent: '#3b82f6'
//         }
//     },
//     {
//         name: 'dark',
//         label: '深色模式',
//         icon: '🌙',
//         description: '护眼的暗色界面',
//         preview: {
//             primary: '#0f172a',
//             secondary: '#1e293b',
//             accent: '#60a5fa'
//         }
//     },
//     {
//         name: 'system',
//         label: '跟随系统',
//         icon: '🌐',
//         description: '根据系统设置自动切换',
//         preview: {
//             primary: 'auto',
//             secondary: 'auto',
//             accent: 'auto'
//         }
//     }
// ] as const;

const themeConfig = {
    colors,
    themes,
    // themePresets,
    colorPresets,
    generateCSSVariables,
    createCustomTheme,
    getColorPreset,
    generatePreviewColors
};

export default themeConfig;
