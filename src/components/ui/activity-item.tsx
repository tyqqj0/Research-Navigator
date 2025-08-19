"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ActivityItemProps {
    title: string;
    timestamp: string;
    icon: React.ReactNode;
    iconColor?: "blue" | "green" | "purple" | "orange" | "red" | "yellow";
    className?: string;
}

const iconBackgroundVariants = {
    blue: "bg-blue-100 dark:bg-blue-900/20",
    green: "bg-green-100 dark:bg-green-900/20",
    purple: "bg-purple-100 dark:bg-purple-900/20",
    orange: "bg-orange-100 dark:bg-orange-900/20",
    red: "bg-red-100 dark:bg-red-900/20",
    yellow: "bg-yellow-100 dark:bg-yellow-900/20"
};

const iconColorVariants = {
    blue: "text-blue-600 dark:text-blue-400",
    green: "text-green-600 dark:text-green-400",
    purple: "text-purple-600 dark:text-purple-400",
    orange: "text-orange-600 dark:text-orange-400",
    red: "text-red-600 dark:text-red-400",
    yellow: "text-yellow-600 dark:text-yellow-400"
};

export function ActivityItem({
    title,
    timestamp,
    icon,
    iconColor = "blue",
    className
}: ActivityItemProps) {
    return (
        <div className={cn("flex items-center space-x-3", className)}>
            <div className="flex-shrink-0">
                <div className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center",
                    iconBackgroundVariants[iconColor]
                )}>
                    <div className={cn("h-4 w-4", iconColorVariants[iconColor])}>
                        {icon}
                    </div>
                </div>
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                    {title}
                </p>
                <p className="text-sm text-muted-foreground">
                    {timestamp}
                </p>
            </div>
        </div>
    );
}
