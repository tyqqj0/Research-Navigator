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

    const headerActions = (
        <div className="flex items-center space-x-2">
            <Button
                variant="outline"
                size="sm"
                onClick={() => loadLiteratures({ force: true })}
                disabled={isLoading}
            >
                <RefreshCw className="w-4 h-4 mr-2" />
                刷新数据
            </Button>
        </div>
    );

    return (
        <RequireAuth>
            <MainLayout
                headerTitle="我的文库"
                headerActions={headerActions}
                showSidebar={true}
            >
                <div className="literature-page space-y-6 p-6">
                    {/* 顶部区域：左侧紧凑总览 + 右侧图谱占位 */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* 紧凑总览 */}
                        <Card className="lg:col-span-1">
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

                        {/* 右侧图谱占位 */}
                        <Card className="lg:col-span-2">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    <Network className="w-4 h-4" />
                                    引用关系图（预留）
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <div className="h-64 md:h-72 w-full rounded-md border bg-gray-50 dark:bg-gray-900/20 flex items-center justify-center text-sm text-muted-foreground">
                                    图谱可视化将在这里展示
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* 错误提示 */}
                    {error && (
                        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20">
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                                    <Activity className="w-4 h-4" />
                                    <span className="font-medium">加载错误:</span>
                                    <span>{error}</span>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* 底部文献列表 */}
                    <div className="mt-2">
                        <LiteratureListPanel />
                    </div>

                    {/* 底部信息 */}
                    {/* <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                                    <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="font-medium text-gray-900 dark:text-white">
                                        实时数据演示
                                    </h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        展示完整的文献管理系统API功能
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                <TrendingUp className="w-4 h-4" />
                                <span>数据更新于: {new Date().toLocaleTimeString('zh-CN')}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card> */}
                </div>
            </MainLayout>
        </RequireAuth>
    );
}