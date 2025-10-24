"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "@/lib/utils";

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverAnchor = PopoverPrimitive.Anchor;

const PopoverClose = PopoverPrimitive.Close;

/**
 * NOTE 关于 theme-primary-background: 
 * 主题类应该只影响背景色，不应修改文字颜色。
 * .theme-primary-background 默认包含 background-color 和 color,
 * 但 color 设的是 `color: var(--color-background)`，可能导致内容文本也变成了背景色。
 * 理想用法: 
 *   - 只取 background，不覆盖 color
 *   - 或者同时使用 .theme-primary-background 和 .theme-text-primary 以保证文字可读性
 * 所以这里用: "theme-primary-background theme-text-primary"
 */
const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> & {
    unstyled?: boolean;
    disableAnimations?: boolean;
  }
>(({ className, align = "center", sideOffset = 4, unstyled = false, disableAnimations = false, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      forceMount
      align={align}
      sideOffset={sideOffset}
      className={cn(
        !unstyled && "theme-primary-background theme-text-primary",
        !unstyled && "z-50 w-72 rounded-md border p-4 shadow-md outline-none",
        !disableAnimations && "data-[state=open]:animate-in data-[state=closed]:animate-out",
        !disableAnimations && "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        !disableAnimations && "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        !disableAnimations && "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        !unstyled && "origin-[--radix-popover-content-transform-origin]",
        !disableAnimations && "transition-opacity transition-transform duration-200 ease-out",
        !disableAnimations && "data-[state=open]:opacity-100 data-[state=closed]:opacity-0",
        !disableAnimations && "data-[state=open]:scale-100 data-[state=closed]:scale-95",
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent, PopoverClose, PopoverAnchor };
