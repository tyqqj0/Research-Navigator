"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

interface FeatureCardProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    variant?: "blue" | "green" | "yellow" | "red" | "cyan" | "gray" | "purple" | "pink" | "orange";
    onClick?: () => void;
    className?: string;
}

const iconBackgroundVariants = cva(
    "p-2 rounded-lg transition-colors",
    {
        variants: {
            variant: {
                blue: "theme-icon-blue-soft",
                green: "theme-icon-green-soft",
                yellow: "theme-icon-yellow-soft",
                red: "theme-icon-red-soft",
                cyan: "theme-icon-cyan-soft",
                gray: "theme-icon-gray-soft",
                purple: "theme-icon-purple-soft",
                pink: "theme-icon-pink-soft",
                orange: "theme-icon-orange-soft",
            },
        },
        defaultVariants: {
            variant: "blue",
        },
    }
);

const iconColorVariants = cva(
    "h-6 w-6 transition-colors",
    {
        variants: {
            variant: {
                blue: "theme-icon-blue-soft",
                green: "theme-icon-green",
                yellow: "theme-icon-yellow",
                red: "theme-icon-red",
                cyan: "theme-icon-cyan",
                gray: "theme-icon-gray",
                purple: "theme-icon-purple",
                pink: "theme-icon-pink",
                orange: "theme-icon-orange",
            },
        },
        defaultVariants: {
            variant: "blue",
        },
    }
);

export function FeatureCard({
    title,
    description,
    icon,
    variant = "blue",
    onClick,
    className
}: FeatureCardProps) {
    return (
        <Card
            className={cn(
                "transition-all duration-200 hover:shadow-md",
                onClick && "cursor-pointer hover:shadow-lg hover:scale-[1.02]",
                className
            )}
            onClick={onClick}
        >
            <CardContent className="p-6">
                <div className="flex items-center">
                    <div className={cn(iconBackgroundVariants({ variant }))}>
                        <span className={cn(iconColorVariants({ variant }))} >
                            {icon}
                        </span>
                    </div>
                    <div className="ml-4">
                        <h3 className="text-sm font-medium theme-text">
                            {title}
                        </h3>
                        <p className="text-sm theme-text-secondary">
                            {description}
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
