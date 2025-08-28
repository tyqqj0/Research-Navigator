"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

interface ActivityItemProps {
    title: string;
    timestamp: string;
    icon: React.ReactNode;
    variant?: "primary" | "success" | "warning" | "error" | "info" | "secondary";
    className?: string;
}

const iconBackgroundVariants = cva(
    "h-8 w-8 rounded-full flex items-center justify-center transition-colors",
    {
        variants: {
            variant: {
                primary: "theme-primary-soft",
                success: "theme-success-soft",
                warning: "theme-warning-soft",
                error: "theme-error-soft",
                info: "theme-info-soft",
                secondary: "theme-surface-secondary",
            },
        },
        defaultVariants: {
            variant: "primary",
        },
    }
);

const iconColorVariants = cva(
    "h-4 w-4 transition-colors",
    {
        variants: {
            variant: {
                primary: "text-theme-primary",
                success: "text-theme-success",
                warning: "text-theme-warning",
                error: "text-theme-error",
                info: "text-theme-info",
                secondary: "text-theme-text-secondary",
            },
        },
        defaultVariants: {
            variant: "primary",
        },
    }
);

export function ActivityItem({
    title,
    timestamp,
    icon,
    variant = "primary",
    className
}: ActivityItemProps) {
    return (
        <div className={cn("flex items-center space-x-3 transition-opacity hover:opacity-80", className)}>
            <div className="flex-shrink-0">
                <div className={cn(iconBackgroundVariants({ variant }))}>
                    <div className={cn(iconColorVariants({ variant }))}>
                        {icon}
                    </div>
                </div>
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-theme-text">
                    {title}
                </p>
                <p className="text-sm text-theme-text-secondary">
                    {timestamp}
                </p>
            </div>
        </div>
    );
}
