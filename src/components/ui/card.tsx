import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-xl border shadow-sm transition-shadow hover:shadow-md theme-card",
      className
    )}

    {...props}
  />
))
Card.displayName = "Card"

// CardHeader 变体样式配置
const cardHeaderVariants = cva(
  "flex flex-col space-y-1.5 p-6 transition-all duration-300",
  {
    variants: {
      variant: {
        default: "bg-background",
        blue: "theme-card-blue-soft",
        green: "theme-card-green-soft",
        purple: "theme-card-purple-soft",
        orange: "theme-card-orange-soft",
        red: "theme-card-red-soft",
        gray: "theme-card-gray-soft",
        gradient: "bg-gradient-to-r from-primary/10 to-secondary/10 theme-card-primary"
      },
      animated: {
        true: "hover:shadow-sm transform-gpu",
        false: ""
      },
      rounded: {
        none: "",
        sm: "rounded-t-sm",
        md: "rounded-t-md",
        lg: "rounded-t-lg",
        xl: "rounded-t-xl"
      }
    },
    defaultVariants: {
      variant: "default",
      animated: false,
      rounded: "sm"
    }
  }
)

// CardContent 变体样式配置，比 CardHeader 整体浅一点，并多一个 rounded 变体
const cardContentVariants = cva(
  "p-6 pt-0", 
  {
    variants: {
      variant: {
        default: "p-6 pt-0",
        blue: "theme-card-blue-softer",
        green: "theme-card-green-softer",
        purple: "theme-card-purple-softer",
        orange: "theme-card-orange-softer",
        red: "theme-card-red-softer",
        gray: "theme-card-gray-softer",
        cyan: "theme-card-cyan-softer",
        pink: "theme-card-pink-softer",
        gradient: "bg-gradient-to-r from-primary/10 to-secondary/10 theme-card-primary"
      },
      rounded: {
        none: "",
        sm: "rounded-b-sm",
        md: "rounded-b-md",
        lg: "rounded-b-lg",
        xl: "rounded-b-xl"
      }
    }
  }
)








export interface CardHeaderProps
  extends React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof cardHeaderVariants> { }

const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, variant, animated, rounded, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardHeaderVariants({ variant, animated, rounded }), className)}
      {...props}
    />
  )
)
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight theme-text", className)}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm theme-text-secondary", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardContentVariants>
>(({ className, variant, rounded, ...props  }, ref) => (
  <div ref={ref} className={cn(cardContentVariants({ variant, rounded }), className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  cardHeaderVariants,
  cardContentVariants
}
