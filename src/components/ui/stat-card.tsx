"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
    value: string | number;
    label: string;
    color?: "blue" | "green" | "purple" | "orange" | "red" | "yellow";
    className?: string;
}

const colorVariants = {
    blue: "text-blue-600 dark:text-blue-400",
    green: "text-green-600 dark:text-green-400",
    purple: "text-purple-600 dark:text-purple-400",
    orange: "text-orange-600 dark:text-orange-400",
    red: "text-red-600 dark:text-red-400",
    yellow: "text-yellow-600 dark:text-yellow-400"
};

export function StatCard({
    value,
    label,
    color = "blue",
    className
}: StatCardProps) {
    return (
        <Card className={cn("text-center", className)}>
            <CardContent className="p-6">
                <div className={cn("text-2xl font-bold mb-1", colorVariants[color])}>
                    {value}
                </div>
                <div className="text-sm text-muted-foreground">
                    {label}
                </div>
            </CardContent>
        </Card>
    );
}
