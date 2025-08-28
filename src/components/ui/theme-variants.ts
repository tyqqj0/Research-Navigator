import { cva } from "class-variance-authority";

/**
 * 通用主题颜色变体
 * 提供统一的颜色样式变体，确保整个应用的视觉一致性
 */

// 文字颜色变体
export const textVariants = cva("", {
    variants: {
        variant: {
            primary: "text-theme-primary",
            secondary: "text-theme-text-secondary",
            muted: "text-theme-text-muted",
            success: "text-theme-success",
            warning: "text-theme-warning",
            error: "text-theme-error",
            info: "text-theme-info",
            default: "text-theme-text",
        },
    },
    defaultVariants: {
        variant: "default",
    },
});

// 背景颜色变体
export const backgroundVariants = cva("", {
    variants: {
        variant: {
            primary: "bg-theme-primary",
            "primary-soft": "bg-theme-primary-soft",
            secondary: "bg-theme-background-secondary",
            muted: "bg-theme-background-muted",
            success: "bg-theme-success",
            warning: "bg-theme-warning",
            error: "bg-theme-error",
            info: "bg-theme-info",
            default: "bg-theme-background",
        },
    },
    defaultVariants: {
        variant: "default",
    },
});

// 边框颜色变体
export const borderVariants = cva("", {
    variants: {
        variant: {
            primary: "border-theme-primary",
            secondary: "border-theme-border-secondary",
            success: "border-theme-success",
            warning: "border-theme-warning",
            error: "border-theme-error",
            info: "border-theme-info",
            default: "border-theme-border",
        },
    },
    defaultVariants: {
        variant: "default",
    },
});

// 图标容器变体 (背景 + 文字色组合)
export const iconContainerVariants = cva(
    "inline-flex items-center justify-center rounded-lg transition-colors",
    {
        variants: {
            variant: {
                primary: "bg-theme-primary-soft text-theme-primary",
                success: "bg-theme-success/10 text-theme-success",
                warning: "bg-theme-warning/10 text-theme-warning",
                error: "bg-theme-error/10 text-theme-error",
                info: "bg-theme-info/10 text-theme-info",
                secondary: "bg-theme-background-secondary text-theme-text",
            },
            size: {
                sm: "p-1.5",
                default: "p-2",
                lg: "p-3",
                xl: "p-4",
            },
        },
        defaultVariants: {
            variant: "primary",
            size: "default",
        },
    }
);

// 状态指示器变体
export const statusVariants = cva(
    "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium",
    {
        variants: {
            variant: {
                success: "bg-theme-success/10 text-theme-success",
                warning: "bg-theme-warning/10 text-theme-warning",
                error: "bg-theme-error/10 text-theme-error",
                info: "bg-theme-info/10 text-theme-info",
                pending: "bg-theme-background-secondary text-theme-text-secondary",
                active: "bg-theme-primary-soft text-theme-primary",
            },
        },
        defaultVariants: {
            variant: "info",
        },
    }
);

// 交互状态变体
export const interactiveVariants = cva(
    "transition-all duration-200 cursor-pointer",
    {
        variants: {
            variant: {
                subtle: "hover:bg-theme-background-secondary",
                primary: "hover:bg-theme-primary/10",
                success: "hover:bg-theme-success/10",
                warning: "hover:bg-theme-warning/10",
                error: "hover:bg-theme-error/10",
                card: "hover:shadow-md hover:bg-theme-background-secondary/50",
            },
        },
        defaultVariants: {
            variant: "subtle",
        },
    }
);

// 焦点状态变体
export const focusVariants = cva("", {
    variants: {
        variant: {
            primary: "focus-visible:ring-2 focus-visible:ring-theme-primary focus-visible:ring-offset-2 focus-visible:ring-offset-theme-background",
            success: "focus-visible:ring-2 focus-visible:ring-theme-success focus-visible:ring-offset-2 focus-visible:ring-offset-theme-background",
            warning: "focus-visible:ring-2 focus-visible:ring-theme-warning focus-visible:ring-offset-2 focus-visible:ring-offset-theme-background",
            error: "focus-visible:ring-2 focus-visible:ring-theme-error focus-visible:ring-offset-2 focus-visible:ring-offset-theme-background",
            info: "focus-visible:ring-2 focus-visible:ring-theme-info focus-visible:ring-offset-2 focus-visible:ring-offset-theme-background",
        },
    },
    defaultVariants: {
        variant: "primary",
    },
});

/**
 * 组合变体 - 常用的颜色组合
 */

// 卡片变体
export const cardVariants = cva(
    "rounded-lg border transition-all duration-200",
    {
        variants: {
            variant: {
                default: "border-theme-border bg-theme-background text-theme-text hover:shadow-md",
                elevated: "border-theme-border bg-theme-background text-theme-text shadow-sm hover:shadow-lg",
                outlined: "border-2 border-theme-border bg-transparent text-theme-text hover:bg-theme-background-secondary/50",
                primary: "border-theme-primary bg-theme-primary-soft text-theme-primary",
                success: "border-theme-success bg-theme-success/5 text-theme-success",
                warning: "border-theme-warning bg-theme-warning/5 text-theme-warning",
                error: "border-theme-error bg-theme-error/5 text-theme-error",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
);

// 输入框变体
export const inputVariants = cva(
    "flex w-full rounded-md border px-3 py-1 text-sm transition-all duration-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
    {
        variants: {
            variant: {
                default: "border-theme-border bg-theme-background text-theme-text placeholder:text-theme-text-muted focus-visible:ring-2 focus-visible:ring-theme-primary focus-visible:ring-offset-2 focus-visible:ring-offset-theme-background",
                error: "border-theme-error bg-theme-background text-theme-text placeholder:text-theme-text-muted focus-visible:ring-2 focus-visible:ring-theme-error focus-visible:ring-offset-2 focus-visible:ring-offset-theme-background",
                success: "border-theme-success bg-theme-background text-theme-text placeholder:text-theme-text-muted focus-visible:ring-2 focus-visible:ring-theme-success focus-visible:ring-offset-2 focus-visible:ring-offset-theme-background",
            },
            size: {
                sm: "h-8 text-xs",
                default: "h-9",
                lg: "h-10 text-base",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
);

/**
 * 语义化颜色映射
 */
export const semanticColors = {
    primary: "theme-primary",
    secondary: "theme-text-secondary",
    success: "theme-success",
    warning: "theme-warning",
    error: "theme-error",
    info: "theme-info",
    muted: "theme-text-muted",
} as const;

/**
 * 常用组合工具函数
 */
export function getSemanticClasses(variant: keyof typeof semanticColors, type: "text" | "bg" | "border" = "text") {
    const colorVar = semanticColors[variant];
    const prefix = type === "text" ? "text-" : type === "bg" ? "bg-" : "border-";
    return `${prefix}${colorVar}`;
}

/**
 * 导出类型
 */
export type TextVariant = NonNullable<Parameters<typeof textVariants>[0]>["variant"];
export type BackgroundVariant = NonNullable<Parameters<typeof backgroundVariants>[0]>["variant"];
export type BorderVariant = NonNullable<Parameters<typeof borderVariants>[0]>["variant"];
export type IconContainerVariant = NonNullable<Parameters<typeof iconContainerVariants>[0]>["variant"];
export type StatusVariant = NonNullable<Parameters<typeof statusVariants>[0]>["variant"];
export type InteractiveVariant = NonNullable<Parameters<typeof interactiveVariants>[0]>["variant"];
export type FocusVariant = NonNullable<Parameters<typeof focusVariants>[0]>["variant"];
export type CardVariant = NonNullable<Parameters<typeof cardVariants>[0]>["variant"];
export type InputVariant = NonNullable<Parameters<typeof inputVariants>[0]>["variant"];
