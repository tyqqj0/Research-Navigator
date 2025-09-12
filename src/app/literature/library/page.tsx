"use client";

import React, { useMemo, useEffect } from 'react';
import { MainLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    BookOpen,
    BarChart3,
    Network,
    Activity,
    RefreshCw,
    Calendar,
    Users
} from "lucide-react";

// 列表组件
import { LiteratureListPanel } from '@/features/literature/management/components/LiteratureListPanel';
import { useLiteratureOperations } from '@/features/literature/hooks/use-literature-operations';
import RequireAuth from '@/components/auth/RequireAuth';
import useAuthStore from '@/stores/auth.store';

export default function LibraryPage() {
    // 使用自定义hooks获取数据和操作
    const {
        literatures,
        uiState,
        loadLiteratures
    } = useLiteratureOperations();

    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

    // 首次加载数据
    useEffect(() => {
        if (isAuthenticated) {
            loadLiteratures({ force: false }).catch(() => { });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated]);

    const isLoading = uiState.isLoading;
    const error = uiState.error;

    // 计算紧凑统计信息（基于当前文献列表）
    const miniStats = useMemo(() => {
        const items = Array.isArray(literatures) ? literatures : [];
        const total = items.length;
        const years: number[] = [];
        const authorSet = new Set<string>();
        for (const item of items) {
            const y = (item as any)?.literature?.year;
            if (typeof y === 'number' && !Number.isNaN(y)) years.push(y);
            const authors = (item as any)?.literature?.authors || [];
            for (const a of authors) authorSet.add(String(a));
        }
        const minYear = years.length ? Math.min(...years) : undefined;
        const maxYear = years.length ? Math.max(...years) : undefined;
        const avgYear = years.length
            ? Math.round(years.reduce((s, y) => s + y, 0) / years.length)
            : undefined;
        return {
            total,
            authorCount: authorSet.size,
            yearSpanText: minYear !== undefined && maxYear !== undefined ? `${minYear} - ${maxYear}` : '—',
            avgYearText: avgYear !== undefined ? String(avgYear) : '—'
        };
    }, [literatures]);

    // Header 用户信息现由全局 auth store 提供，无需在页面层传入

    const pageHeader = (
        <div className="px-6 py-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">我的文库</h2>
            <div className="flex items-center space-x-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadLiteratures({ force: true })}
                    disabled={isLoading}
                >
                    <RefreshCw className="w-4 h-4 mr-2" /> 刷新数据
                </Button>
            </div>
        </div>
    );

    return (
        <RequireAuth>
            <MainLayout showSidebar={true} showHeader={false} pageHeader={pageHeader}>
                <div className="p-0 h-full">
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-0 h-full">
                        {/* 左侧：图谱全高固定区 */}
                        <div className="xl:col-span-1 border-r h-full">
                            <div className="p-6">
                                <Card className="h-full">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                                            <Network className="w-4 h-4" />
                                            引用关系图（预留）
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 h-[calc(100%-56px)]">
                                        <div className="h-full w-full rounded-md border bg-gray-50 dark:bg-gray-900/20 flex items-center justify-center text-sm text-muted-foreground">
                                            图谱可视化将在这里展示
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>

                        {/* 右侧：上方总览卡片 + 下方可滚动文献列表 */}
                        <div className="xl:col-span-2 h-full flex flex-col">
                            <div className="p-6">
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                                            <BarChart3 className="w-4 h-4" />
                                            总览
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <div className="flex items-center gap-2 p-2 rounded-md border">
                                                <BookOpen className="w-4 h-4 text-blue-600" />
                                                <div className="truncate">
                                                    <div className="text-xs text-muted-foreground">总文献数</div>
                                                    <div className="font-semibold">{miniStats.total}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 p-2 rounded-md border">
                                                <Users className="w-4 h-4 text-emerald-600" />
                                                <div className="truncate">
                                                    <div className="text-xs text-muted-foreground">作者数</div>
                                                    <div className="font-semibold">{miniStats.authorCount}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 p-2 rounded-md border">
                                                <Calendar className="w-4 h-4 text-orange-600" />
                                                <div className="truncate">
                                                    <div className="text-xs text-muted-foreground">年份范围</div>
                                                    <div className="font-semibold">{miniStats.yearSpanText}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 p-2 rounded-md border">
                                                <Calendar className="w-4 h-4 text-purple-600" />
                                                <div className="truncate">
                                                    <div className="text-xs text-muted-foreground">平均年份</div>
                                                    <div className="font-semibold">{miniStats.avgYearText}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {error && (
                                <div className="px-6">
                                    <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20">
                                        <CardContent className="pt-6">
                                            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                                                <Activity className="w-4 h-4" />
                                                <span className="font-medium">加载错误:</span>
                                                <span>{error}</span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            )}

                            {/* 文献列表：仅此处滚动 */}
                            <div className="flex-1 min-h-0">
                                <div className="h-full overflow-y-auto px-6 pb-6">
                                    <LiteratureListPanel />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </MainLayout>
        </RequireAuth>
    );
}