"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
    BookOpen,
    Users,
    Calendar,
    TrendingUp,
    FileText,
    Link,
    Star,
    Clock
} from "lucide-react";
import { useLiteratureOperations } from '../../hooks/use-literature-operations';

interface LiteratureStatsPanelProps {
    className?: string;
}

export function LiteratureStatsPanel({ className }: LiteratureStatsPanelProps) {
    const { literatures, uiState } = useLiteratureOperations();
    const items = literatures.map(enhanced => enhanced.literature);
    const isLoading = uiState.isLoading;

    // 计算统计数据
    const stats = useMemo(() => {
        if (!items.length) {
            return {
                total: 0,
                recentlyAdded: 0,
                authorCount: 0,
                yearRange: { min: 0, max: 0 },
                sourceDistribution: {},
                yearDistribution: {},
                topAuthors: [],
                avgYear: 0
            };
        }

        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // 基础统计
        const total = items.length;
        const recentlyAdded = items.filter((item: any) =>
            new Date(item.createdAt) > oneWeekAgo
        ).length;

        // 作者统计
        const allAuthors = items.flatMap((item: any) => item.authors);
        const authorCount = new Set(allAuthors).size;
        const authorFreq = allAuthors.reduce((acc: Record<string, number>, author: string) => {
            acc[author] = (acc[author] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        const topAuthors = Object.entries(authorFreq)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .slice(0, 5)
            .map(([author, count]) => ({ author, count: count as number }));

        // 年份统计
        const years = items.map((item: any) => item.year).filter((year: number) => year > 0);
        const yearRange = {
            min: Math.min(...years),
            max: Math.max(...years)
        };
        const avgYear = years.reduce((sum: number, year: number) => sum + year, 0) / years.length;

        const yearDistribution = years.reduce((acc: Record<number, number>, year: number) => {
            const decade = Math.floor(year / 10) * 10;
            acc[decade] = (acc[decade] || 0) + 1;
            return acc;
        }, {} as Record<number, number>);

        // 来源统计
        const sourceDistribution = items.reduce((acc: Record<string, number>, item: any) => {
            const source = item.source || 'unknown';
            acc[source] = (acc[source] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return {
            total,
            recentlyAdded,
            authorCount,
            yearRange,
            sourceDistribution,
            yearDistribution,
            topAuthors,
            avgYear: Math.round(avgYear)
        };
    }, [items]);

    if (isLoading) {
        return (
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
                {[...Array(4)].map((_, i) => (
                    <Card key={i}>
                        <CardContent className="p-6">
                            <div className="animate-pulse space-y-3">
                                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                                <div className="h-3 bg-gray-200 rounded w-full"></div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    const sourceLabels: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
        manual: { label: '手动添加', color: 'bg-blue-500', icon: <FileText className="h-4 w-4" /> },
        zotero: { label: 'Zotero', color: 'bg-red-500', icon: <Link className="h-4 w-4" /> },
        import: { label: '批量导入', color: 'bg-green-500', icon: <BookOpen className="h-4 w-4" /> },
        search: { label: '搜索添加', color: 'bg-purple-500', icon: <Star className="h-4 w-4" /> },
        unknown: { label: '未知来源', color: 'bg-gray-500', icon: <FileText className="h-4 w-4" /> }
    };

    return (
        <div className={`space-y-6 ${className}`}>
            {/* 主要统计卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">总文献数</p>
                                <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
                            </div>
                            <BookOpen className="h-8 w-8 text-blue-600" />
                        </div>
                        <div className="mt-4 flex items-center text-sm text-muted-foreground">
                            <TrendingUp className="h-4 w-4 mr-1" />
                            <span>本周新增 {stats.recentlyAdded} 篇</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">作者总数</p>
                                <p className="text-3xl font-bold text-green-600">{stats.authorCount}</p>
                            </div>
                            <Users className="h-8 w-8 text-green-600" />
                        </div>
                        <div className="mt-4 flex items-center text-sm text-muted-foreground">
                            <Users className="h-4 w-4 mr-1" />
                            <span>平均每篇 {(stats.authorCount / Math.max(stats.total, 1)).toFixed(1)} 位作者</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">年份跨度</p>
                                <p className="text-3xl font-bold text-purple-600">
                                    {stats.yearRange.max - stats.yearRange.min || 0}
                                </p>
                            </div>
                            <Calendar className="h-8 w-8 text-purple-600" />
                        </div>
                        <div className="mt-4 flex items-center text-sm text-muted-foreground">
                            <Clock className="h-4 w-4 mr-1" />
                            <span>{stats.yearRange.min} - {stats.yearRange.max}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">平均年份</p>
                                <p className="text-3xl font-bold text-orange-600">{stats.avgYear}</p>
                            </div>
                            <Calendar className="h-8 w-8 text-orange-600" />
                        </div>
                        <div className="mt-4 flex items-center text-sm text-muted-foreground">
                            <TrendingUp className="h-4 w-4 mr-1" />
                            <span>文献时效性指标</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* 详细统计 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 来源分布 */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">来源分布</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {Object.entries(stats.sourceDistribution).map(([source, count]) => {
                            const sourceInfo = sourceLabels[source] || sourceLabels.unknown;
                            const percentage = ((count as number) / stats.total) * 100;

                            return (
                                <div key={source} className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {sourceInfo.icon}
                                            <span className="text-sm font-medium">{sourceInfo.label}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-muted-foreground">{count as number}</span>
                                            <Badge variant="secondary" className="text-xs">
                                                {percentage.toFixed(1)}%
                                            </Badge>
                                        </div>
                                    </div>
                                    <Progress
                                        value={percentage}
                                        className="h-2"
                                    />
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>

                {/* 高频作者 */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">高频作者</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {stats.topAuthors.length > 0 ? (
                            stats.topAuthors.map(({ author, count }, index) => (
                                <div key={author} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-600 rounded-full text-xs font-semibold">
                                            {index + 1}
                                        </div>
                                        <span className="text-sm font-medium truncate max-w-[200px]" title={author}>
                                            {author}
                                        </span>
                                    </div>
                                    <Badge variant="outline" className="text-xs">
                                        {count as number} 篇
                                    </Badge>
                                </div>
                            ))
                        ) : (
                            <div className="text-center text-muted-foreground py-8">
                                <Users className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                                <p>暂无作者数据</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* 年份分布 */}
            {Object.keys(stats.yearDistribution).length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">年代分布</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {Object.entries(stats.yearDistribution)
                                .sort(([a], [b]) => Number(a) - Number(b))
                                .map(([decade, count]) => {
                                    const percentage = ((count as number) / stats.total) * 100;
                                    return (
                                        <div key={decade} className="text-center space-y-2">
                                            <div className="text-sm font-medium">{decade}s</div>
                                            <div className="text-2xl font-bold text-blue-600">{count as number}</div>
                                            <Progress value={percentage} className="h-2" />
                                            <div className="text-xs text-muted-foreground">
                                                {percentage.toFixed(1)}%
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
