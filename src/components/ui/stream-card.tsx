"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Skeleton } from "./skeleton";
import { cn } from "@/lib/utils";

type StreamStatus = "idle" | "streaming" | "done" | "error" | "aborted";

interface StreamCardProps {
    title?: string;
    status?: StreamStatus;
    headerVariant?: React.ComponentProps<typeof CardHeader>["variant"];
    headerRight?: React.ReactNode;
    children?: React.ReactNode;
    className?: string;
    contentClassName?: string;
    footer?: React.ReactNode;
}

export const StreamCard: React.FC<StreamCardProps> = ({
    title,
    status = "idle",
    headerVariant = "default",
    headerRight,
    children,
    className,
    contentClassName,
    footer,
}) => {
    const streaming = status === "streaming";
    const errored = status === "error";

    return (
        <Card className={cn("border rounded-md", className)}>
            {(title || status || headerRight) && (
                <CardHeader className="py-3" variant={headerVariant}>
                    <div className="flex items-center justify-between">
                        {title && <CardTitle className="text-sm">{title}</CardTitle>}
                        <div className="flex items-center gap-2">
                            {status && (
                                <div className={cn("text-xs", errored ? "text-red-600" : "text-muted-foreground")}>
                                    {status === "streaming"
                                        ? "生成中…"
                                        : status === "done"
                                            ? "已完成"
                                            : status === "error"
                                                ? "失败"
                                                : status === "aborted"
                                                    ? "已中止"
                                                    : ""}
                                </div>
                            )}
                            {headerRight}
                        </div>
                    </div>
                </CardHeader>
            )}
            <CardContent className={cn("text-sm space-y-2", contentClassName)}>
                {children}
                {streaming && (
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-5/6" />
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-4 w-1/2" />
                    </div>
                )}
                {footer && <div className="pt-2 border-t mt-2">{footer}</div>}
            </CardContent>
        </Card>
    );
};

export default StreamCard;


