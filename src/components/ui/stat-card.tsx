"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

interface StatCardProps {
    value: string | number;
    label: string;
    variant?: "blue" | "green" | "yellow" | "red" | "cyan" | "gray" | "purple" | "pink" | "orange";
    className?: string;
}

const statCardVariants = cva(
    "text-2xl font-bold mb-1 transition-colors",
    {
        variants: {
            variant: {
                blue: "theme-text-blue",
                green: "theme-text-green",
                yellow: "theme-text-yellow",
                red: "theme-text-red",
                cyan: "theme-text-cyan",
                gray: "theme-text-gray",
                purple: "theme-text-purple",
                pink: "theme-text-pink",
                orange: "theme-text-orange",
            },
        },
        defaultVariants: {
            variant: "blue",
        },
    }
);

export function StatCard({
    value,
    label,
    variant = "blue",
    className
}: StatCardProps) {
    return (
        <Card className={cn("text-center transition-all duration-200 hover:shadow-lg", className)}>
            <CardContent className="p-6">
                <span className={cn(statCardVariants({ variant }))}>
                    {value}
                </span>
                <div className="text-sm" style={{ color: 'var(--color-foreground-secondary)' }}>
                    {label}
                </div>
            </CardContent>
        </Card>
    );
}
