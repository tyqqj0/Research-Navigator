/**
 * 简化主题系统
 * 
 * 新的设计理念：
 * 1. 移除复杂的 HSL 转换和映射
 * 2. 直接使用简单的 CSS 变量
 * 3. 专注于用户体验而非技术复杂性
 */

// ========== 颜色预设 ==========
export interface ColorPreset {
    name: string;
    label: string;
    description: string;
    colors: {
        // 主要颜色
        primary: string;
        success: string;
        warning: string;
        error: string;
        info: string;

        // 背景色（浅色主题）
        background: string;
        backgroundSecondary: string;
        backgroundMuted: string;

        // 文字色（浅色主题）
        text: string;
        textSecondary: string;
        textMuted: string;

        // 边框色
        border: string;
        borderSecondary: string;
    };
    // 深色主题的颜色覆盖（可选）
    darkColors?: Partial<ColorPreset['colors']>;
}

// ========== 颜色预设定义 ==========
export const colorPresets: ColorPreset[] = [
    {
        name: 'blue',
        label: '默认蓝色',
        description: '经典的蓝色主题，适合商务和专业场景',
        colors: {
            primary: '#3b82f6',
            success: '#10b981',
            warning: '#f59e0b',
            error: '#ef4444',
            info: '#3b82f6',

            background: '#ffffff',
            backgroundSecondary: '#f8fafc',
            backgroundMuted: '#f1f5f9',

            text: '#0f172a',
            textSecondary: '#475569',
            textMuted: '#64748b',

            border: '#e2e8f0',
            borderSecondary: '#cbd5e1',
        },
        darkColors: {
            primary: '#60a5fa',
            background: '#0f172a',
            backgroundSecondary: '#1e293b',
            backgroundMuted: '#334155',
            text: '#f8fafc',
            textSecondary: '#cbd5e1',
            textMuted: '#94a3b8',
            border: '#334155',
            borderSecondary: '#475569',
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
            info: '#8b5cf6',

            background: '#ffffff',
            backgroundSecondary: '#faf8ff',
            backgroundMuted: '#f3f0ff',

            text: '#1f1b2e',
            textSecondary: '#5b5470',
            textMuted: '#776b87',

            border: '#e9e5f5',
            borderSecondary: '#d8d0eb',
        },
        darkColors: {
            primary: '#c084fc',
            background: '#1a1625',
            backgroundSecondary: '#2d2438',
            backgroundMuted: '#3f3451',
            text: '#f8f6ff',
            textSecondary: '#d8d0eb',
            textMuted: '#b4a5c7',
            border: '#3f3451',
            borderSecondary: '#524364',
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
            info: '#059669',

            background: '#ffffff',
            backgroundSecondary: '#f0fdf4',
            backgroundMuted: '#e7f5e9',

            text: '#0c1e0f',
            textSecondary: '#365c3e',
            textMuted: '#4d7857',

            border: '#d1f2db',
            borderSecondary: '#a7e9b8',
        },
        darkColors: {
            primary: '#34d399',
            background: '#0c1910',
            backgroundSecondary: '#1a2e20',
            backgroundMuted: '#27432f',
            text: '#f0fdf4',
            textSecondary: '#d1f2db',
            textMuted: '#a7e9b8',
            border: '#27432f',
            borderSecondary: '#356a42',
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
            info: '#ea580c',

            background: '#ffffff',
            backgroundSecondary: '#fff7ed',
            backgroundMuted: '#fed7aa',

            text: '#1c1009',
            textSecondary: '#9a3412',
            textMuted: '#c2410c',

            border: '#fed7aa',
            borderSecondary: '#fdba74',
        },
        darkColors: {
            primary: '#fb923c',
            background: '#1c1009',
            backgroundSecondary: '#2c1810',
            backgroundMuted: '#3d2317',
            text: '#fff7ed',
            textSecondary: '#fed7aa',
            textMuted: '#fdba74',
            border: '#3d2317',
            borderSecondary: '#4d2e1f',
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
            info: '#e11d48',

            background: '#ffffff',
            backgroundSecondary: '#fff1f2',
            backgroundMuted: '#ffe4e6',

            text: '#1f0a0d',
            textSecondary: '#881337',
            textMuted: '#be185d',

            border: '#fecdd3',
            borderSecondary: '#fda4af',
        },
        darkColors: {
            primary: '#f87171',
            background: '#1f0a0d',
            backgroundSecondary: '#2f1114',
            backgroundMuted: '#3f171a',
            text: '#fff1f2',
            textSecondary: '#fecdd3',
            textMuted: '#fda4af',
            border: '#3f171a',
            borderSecondary: '#4f1d21',
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
            info: '#475569',

            background: '#ffffff',
            backgroundSecondary: '#f8fafc',
            backgroundMuted: '#f1f5f9',

            text: '#0f172a',
            textSecondary: '#334155',
            textMuted: '#64748b',

            border: '#e2e8f0',
            borderSecondary: '#cbd5e1',
        },
        darkColors: {
            primary: '#94a3b8',
            background: '#0f172a',
            backgroundSecondary: '#1e293b',
            backgroundMuted: '#334155',
            text: '#f8fafc',
            textSecondary: '#cbd5e1',
            textMuted: '#94a3b8',
            border: '#334155',
            borderSecondary: '#475569',
        }
    }
];

// ========== 主题接口 ==========
export interface Theme {
    name: string;
    isDark: boolean;
    colors: ColorPreset['colors'];
}

// ========== CSS变量生成器 ==========
export function generateCSSVariables(theme: Theme): Record<string, string> {
    const { colors } = theme;

    // console.log('🎨 [DEBUG] 开始生成CSS变量:', {
    //     themeName: theme.name,
    //     isDark: theme.isDark,
    //     timestamp: new Date().toLocaleTimeString()
    // });

    return {
        // ========== 主题系统变量 ==========
        '--color-primary': colors.primary,
        '--color-success': colors.success,
        '--color-warning': colors.warning,
        '--color-error': colors.error,
        '--color-info': colors.info,

        // 使用与 globals.css 匹配的变量名
        '--color-background-primary': colors.background,
        '--color-background-secondary': colors.backgroundSecondary,
        '--color-background-tertiary': colors.backgroundMuted,
        '--color-background-inverse': theme.isDark ? '#ffffff' : '#0f172a',

        '--color-foreground-primary': colors.text,
        '--color-foreground-secondary': colors.textSecondary,
        '--color-foreground-tertiary': colors.textMuted,
        '--color-foreground-inverse': theme.isDark ? '#0f172a' : '#ffffff',

        '--color-border-primary': colors.border,
        '--color-border-secondary': colors.borderSecondary,
        '--color-border-focus': colors.primary,

        // 保留旧的变量名以兼容现有代码
        '--color-background': colors.background,
        '--color-background-muted': colors.backgroundMuted,
        '--color-text': colors.text,
        '--color-text-secondary': colors.textSecondary,
        '--color-text-muted': colors.textMuted,
        '--color-border': colors.border,

        // ========== shadcn/ui 兼容性变量 ==========
        // 使用简单的颜色值而不是复杂的 HSL 转换
        '--primary': colors.primary,
        '--primary-foreground': theme.isDark ? colors.background : '#ffffff',
        '--secondary': colors.backgroundSecondary,
        '--secondary-foreground': colors.text,
        '--muted': colors.backgroundMuted,
        '--muted-foreground': colors.textMuted,
        '--accent': colors.primary,
        '--accent-foreground': theme.isDark ? colors.background : '#ffffff',
        '--destructive': colors.error,
        '--destructive-foreground': '#ffffff',
        '--background': colors.background,
        '--foreground': colors.text,
        '--card': colors.background,
        '--card-foreground': colors.text,
        '--popover': colors.background,
        '--popover-foreground': colors.text,
        '--border': colors.border,
        '--input': colors.border,
        '--ring': colors.primary,

        // ========== 图标颜色变量（自动深浅切换）==========

        '--icon-blue': theme.isDark ? getColorForTheme('#60a5fa') : '#60a5fa',       // 深色模式使用更亮的蓝色
        '--icon-green': theme.isDark ? getColorForTheme('#34d399') : '#34d399',      // 深色模式使用更亮的绿色
        '--icon-yellow': theme.isDark ? getColorForTheme('#fbbf24') : '#fbbf24',     // 深色模式使用更亮的黄色
        '--icon-red': theme.isDark ? getColorForTheme('#f87171') : '#f87171',        // 深色模式使用更亮的红色
        '--icon-cyan': theme.isDark ? getColorForTheme('#22d3ee') : '#22d3ee',       // 深色模式使用更亮的青色
        '--icon-gray': theme.isDark ? getColorForTheme('#9ca3af') : '#9ca3af',       // 深色模式使用更亮的灰色
        '--icon-purple': theme.isDark ? getColorForTheme('#c084fc') : '#c084fc',     // 深色模式使用更亮的紫色
        '--icon-pink': theme.isDark ? getColorForTheme('#f472b6') : '#f472b6',       // 深色模式使用更亮的粉色
        '--icon-orange': theme.isDark ? getColorForTheme('#fb923c') : '#fb923c',     // 深色模式使用更亮的橙色



        // ========== 设计令牌 ==========
        '--radius': '0.375rem',
        '--shadow-sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        '--shadow-md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        '--shadow-lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        '--shadow-xl': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    };
}

// ========== 颜色深浅工具 ==========
export function getColorForTheme(color: string, factor: number = 0.5): string {
    // 深色模式使用更亮的颜色，浅色模式使用更暗的颜色, factor 越大，颜色越亮

    // 移除 # 前缀
    const hex = color.replace('#', '');

    // 解析 RGB 值
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // 转换为 HSV
    const { h, s, v } = rgbToHsv(r, g, b);

    let newV = v * factor;

    if (newV > 1) {
        newV = 1;
    }

    // 转换回 RGB
    const { r: newR, g: newG, b: newB } = hsvToRgb(h, s, newV);

    // 转换为十六进制
    return `#${Math.round(newR).toString(16).padStart(2, '0')}${Math.round(newG).toString(16).padStart(2, '0')}${Math.round(newB).toString(16).padStart(2, '0')}`;
}

// RGB 转 HSV
function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;

    let h = 0;
    let s = max === 0 ? 0 : diff / max;
    let v = max;

    if (diff !== 0) {
        switch (max) {
            case r:
                h = ((g - b) / diff) % 6;
                break;
            case g:
                h = (b - r) / diff + 2;
                break;
            case b:
                h = (r - g) / diff + 4;
                break;
        }
        h *= 60;
        if (h < 0) h += 360;
    }

    return { h, s, v };
}

// HSV 转 RGB
function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
    const c = v * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = v - c;

    let r = 0, g = 0, b = 0;

    if (h >= 0 && h < 60) {
        r = c; g = x; b = 0;
    } else if (h >= 60 && h < 120) {
        r = x; g = c; b = 0;
    } else if (h >= 120 && h < 180) {
        r = 0; g = c; b = x;
    } else if (h >= 180 && h < 240) {
        r = 0; g = x; b = c;
    } else if (h >= 240 && h < 300) {
        r = x; g = 0; b = c;
    } else if (h >= 300 && h < 360) {
        r = c; g = 0; b = x;
    }

    return {
        r: (r + m) * 255,
        g: (g + m) * 255,
        b: (b + m) * 255
    };
}

// ========== 主题创建工具 ==========
export function createTheme(
    presetName: string,
    isDark: boolean = false,
    customColors?: Partial<ColorPreset['colors']>
): Theme | null {
    const preset = colorPresets.find(p => p.name === presetName);
    if (!preset) return null;

    // 合并基础颜色和深色主题颜色
    let colors = { ...preset.colors };
    if (isDark && preset.darkColors) {
        colors = { ...colors, ...preset.darkColors };
    }

    // 应用自定义颜色
    if (customColors) {
        colors = { ...colors, ...customColors };
    }

    return {
        name: `${presetName}-${isDark ? 'dark' : 'light'}`,
        isDark,
        colors
    };
}

// ========== 预设查找工具 ==========
export function getColorPreset(name: string): ColorPreset | undefined {
    return colorPresets.find(preset => preset.name === name);
}

// ========== 主题应用工具 ==========
// export function applyTheme(theme: Theme): void {
//     if (typeof window === 'undefined') return;
//     console.log('🎨 [DEBUG] 应用主题:', theme);

//     const variables = generateCSSVariables(theme);
//     const root = document.documentElement;

//     // 记录应用前的状态
//     const beforeState = {
//         darkClass: root.classList.contains('dark'),
//         lightClass: root.classList.contains('light'),
//         dataTheme: root.getAttribute('data-theme'),
//         iconBlue: root.style.getPropertyValue('--icon-blue'),
//         iconGreen: root.style.getPropertyValue('--icon-green'),
//     };

//     // 应用所有CSS变量
//     Object.entries(variables).forEach(([property, value]) => {
//         root.style.setProperty(property, value);
//     });

//     // 设置主题类
//     root.setAttribute('data-theme', theme.name);
//     root.classList.toggle('dark', theme.isDark);
//     root.classList.toggle('light', !theme.isDark);

//     // 记录应用后的状态
//     const afterState = {
//         darkClass: root.classList.contains('dark'),
//         lightClass: root.classList.contains('light'),
//         dataTheme: root.getAttribute('data-theme'),
//         iconBlue: root.style.getPropertyValue('--icon-blue'),
//         iconGreen: root.style.getPropertyValue('--icon-green'),
//     };

//     console.log('🎨 [DEBUG] 主题应用完成:', {
//         themeName: theme.name,
//         isDark: theme.isDark,
//         variablesCount: Object.keys(variables).length,
//         classChanges: {
//             before: beforeState,
//             after: afterState,
//             darkClassChanged: beforeState.darkClass !== afterState.darkClass,
//             colorChanged: beforeState.iconBlue !== afterState.iconBlue
//         },
//         iconColors: {
//             blue: variables['--icon-blue'],
//             green: variables['--icon-green'],
//             red: variables['--icon-red']
//         }
//     });
// }

// ========== 响应式主题检测 ==========
export function detectSystemTheme(): 'light' | 'dark' {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// ========== 主题切换工具 ==========
export function toggleTheme(currentTheme: Theme): Theme {
    return createTheme(
        currentTheme.name.split('-')[0], // 提取预设名称
        !currentTheme.isDark,
        currentTheme.colors
    ) || currentTheme;
}

// ========== 调试工具 ==========
// export function debugThemeSwitch(): void {
//     if (typeof window === 'undefined') return;

//     const root = document.documentElement;
//     const currentIsDark = root.classList.contains('dark');

//     console.log('🔧 [DEBUG] 手动测试主题切换 - 当前状态:', {
//         isDark: currentIsDark,
//         classes: Array.from(root.classList),
//         iconColors: {
//             blue: root.style.getPropertyValue('--icon-blue'),
//             green: root.style.getPropertyValue('--icon-green'),
//             red: root.style.getPropertyValue('--icon-red'),
//         }
//     });

//     // 切换到相反主题
//     const newTheme = createTheme('blue', !currentIsDark);
//     if (newTheme) {
//         console.log('🔧 [DEBUG] 即将切换到:', newTheme);
//         applyTheme(newTheme);
//     }
// }

// // 暴露到window对象用于控制台测试
// if (typeof window !== 'undefined') {
//     (window as any).debugThemeSwitch = debugThemeSwitch;
// }

export default {
    presets: colorPresets,
    createTheme: createTheme,
    // applyTheme: applyTheme,
    detectSystem: detectSystemTheme,
    toggleTheme,
    // debugThemeSwitch
};