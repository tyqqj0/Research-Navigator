"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => {
  // 基础样式
  const baseStyles = "peer h-4 w-4 shrink-0 rounded-sm"

  // 边框和背景 - 这里可以调整边框颜色深度
  const borderStyles = "border-1 border-gray-200 bg-white"

  // 阴影和焦点效果
  const shadowStyles = "shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"

  // 选中状态样式 - 可以单独调整选中时的颜色
  const checkedStyles = "data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500 data-[state=checked]:text-white"

  // 禁用状态
  const disabledStyles = "disabled:cursor-not-allowed disabled:opacity-50"

  // 过渡动画
  const transitionStyles = "transition-all duration-200"

  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        baseStyles,
        borderStyles,
        shadowStyles,
        checkedStyles,
        disabledStyles,
        transitionStyles,
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className={cn("flex items-center justify-center text-current")}
      >
        <Check className="h-4 w-4" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
})
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
