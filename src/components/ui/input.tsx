import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Input 组件
 * 
 * 用法:
 * <Input placeholder="请输入..." />
 * 
 * 说明:
 * - 支持所有原生 input 属性
 * - 通过 `className` 自定义样式
 * - 点击时的外显边框提示较为细腻和柔和
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          // 主结构样式
          "flex h-9 w-full rounded-md border border-theme-border bg-theme-background px-3 py-1 text-base shadow-sm transition-all duration-200",
          // 文件类型特殊样式
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-theme-text",
          // placeholder
          "placeholder:text-theme-text-muted",
          // 禁用状态
          "disabled:cursor-not-allowed disabled:opacity-50",
          // 悬停时边框二级色
          "hover:border-theme-border-secondary",
          // 轻微且细致的focus样式：淡化宽度和颜色
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-theme-primary/30 focus-visible:ring-offset-1 focus-visible:ring-offset-theme-background focus-visible:border-theme-primary",
          // 响应式字号
          "md:text-sm",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
