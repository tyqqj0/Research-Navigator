"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface FeatureCardProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    iconColor?: "blue" | "green" | "purple" | "orange" | "red" | "yellow";
    onClick?: () => void;
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

export function FeatureCard({
    title,
    description,
    icon,
    iconColor = "blue",
    onClick,
    className
}: FeatureCardProps) {
    return (
        <Card
            className={cn(
                "transition-shadow hover:shadow-md cursor-pointer",
                onClick && "hover:shadow-lg",
                className
            )}
            onClick={onClick}
        >
            <CardContent className="p-6">
                <div className="flex items-center">
                    <div className={cn(
                        "p-2 rounded-lg",
                        iconBackgroundVariants[iconColor]
                    )}>
                        <div className={cn("h-6 w-6", iconColorVariants[iconColor])}>
                            {icon}
                        </div>
                    </div>
                    <div className="ml-4">
                        <h3 className="text-sm font-medium">
                            {title}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {description}
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
