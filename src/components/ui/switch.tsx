"use client"

import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => {
  // 基础布局样式
  const baseStyles = "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full"

  // 边框和背景 - 可以调整边框和内阴影
  const borderStyles = "border-1 border-gray-200 bg-gray-200 shadow-inner"

  // 焦点状态
  const focusStyles = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"

  // 开关状态颜色 - 方便单独调整开启/关闭时的颜色
  const stateStyles = "data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500 data-[state=unchecked]:bg-gray-200 data-[state=unchecked]:border-gray-300"

  // 禁用状态
  const disabledStyles = "disabled:cursor-not-allowed disabled:opacity-50"

  // 过渡动画
  const transitionStyles = "transition-all duration-1000"

  // 滑块样式
  const thumbBaseStyles = "pointer-events-none block h-5 w-5 rounded-full bg-white ring-0"
  const thumbShadowStyles = "shadow-lg border border-gray-200"
  const thumbMovementStyles = "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
  const thumbTransitionStyles = "transition-all duration-1000"

  return (
    <SwitchPrimitives.Root
      className={cn(
        baseStyles,
        borderStyles,
        focusStyles,
        stateStyles,
        disabledStyles,
        transitionStyles,
        className
      )}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          thumbBaseStyles,
          thumbShadowStyles,
          thumbMovementStyles,
          thumbTransitionStyles
        )}
      />
    </SwitchPrimitives.Root>
  )
})
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }