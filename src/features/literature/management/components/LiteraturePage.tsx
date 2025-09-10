"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    BookOpen,
    Plus,
    Upload,
    Download,
    BarChart3,
    Network,
    List,
    Grid,
    Search,
    Filter,
    Settings
} from "lucide-react";

// 导入我们将要创建的组件
import { LiteratureStatsPanel } from './LiteratureStatsPanel';
import { CitationGraphPanel } from './CitationGraphPanel';
import { LiteratureListPanel } from './LiteratureListPanel';
import { LiteratureActions } from './LiteratureActions';
import { useLiteratureOperations } from '../../hooks/use-literature-operations';

interface LiteraturePageProps {
    className?: string;
}

export function LiteraturePage({ className }: LiteraturePageProps) {
    // 状态管理
    const [activeTab, setActiveTab] = useState<'overview' | 'list' | 'graph'>('overview');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
    const [showStats, setShowStats] = useState(true);
    const [showGraph, setShowGraph] = useState(true);

    // 使用自定义hooks获取数据和操作
    const {
        literatures,
        uiState,
        loadLiteratures
    } = useLiteratureOperations();

    // 派生状态
    const isLoading = uiState.isLoading;
    const error = uiState.error;
    const totalCount = literatures.length;

    // 处理视图切换
    const handleViewModeChange = useCallback((mode: 'grid' | 'list') => {
        setViewMode(mode);
    }, []);

    // 处理布局切换
    const toggleStatsPanel = useCallback(() => {
        setShowStats(prev => !prev);
    }, []);

    const toggleGraphPanel = useCallback(() => {
        setShowGraph(prev => !prev);
    }, []);

    // 页面加载时获取数据
    useEffect(() => {
        if (literatures.length === 0 && !isLoading) {
            loadLiteratures();
        }
    }, [literatures.length, isLoading, loadLiteratures]);

    return (
        <div className={`literature-page space-y-6 ${className}`}>
            {/* 页面头部 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <BookOpen className="h-8 w-8 text-blue-600" />
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">文献管理</h1>
                        <p className="text-muted-foreground">
                            管理你的研究文献，构建知识网络
                        </p>
                    </div>
                </div>

                {/* 快速统计 */}
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <div className="text-2xl font-bold text-blue-600">{totalCount}</div>
                        <div className="text-sm text-muted-foreground">总文献数</div>
                    </div>
                    <LiteratureActions />
                </div>
            </div>

            {/* 标签栏 - 移到最顶部 */}
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="space-y-6">
                <div className="flex items-center justify-between">
                    <TabsList className="grid w-[400px] grid-cols-3">
                        <TabsTrigger value="overview" className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4" />
                            概览
                        </TabsTrigger>
                        <TabsTrigger value="list" className="flex items-center gap-2">
                            <List className="h-4 w-4" />
                            列表
                        </TabsTrigger>
                        <TabsTrigger value="graph" className="flex items-center gap-2">
                            <Network className="h-4 w-4" />
                            图谱
                        </TabsTrigger>
                    </TabsList>

                    {/* 视图控制 */}
                    <div className="flex items-center gap-2">
                        <Button
                            variant={viewMode === 'list' ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleViewModeChange('list')}
                        >
                            <List className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={viewMode === 'grid' ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleViewModeChange('grid')}
                        >
                            <Grid className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* 概览标签页 - 新布局：左上角统计，右边图谱，下面列表 */}
                <TabsContent value="overview" className="space-y-6">
                    {/* 上半部分：左边统计信息，右边图谱 */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* 左上角：文献统计信息 */}
                        <div className="lg:col-span-1">
                            <LiteratureStatsPanel className="h-full" />
                        </div>

                        {/* 右边：引用图谱 */}
                        <div className="lg:col-span-2">
                            <CitationGraphPanel
                                className="transition-all duration-300"
                                height="400px"
                                embedded
                                showControls={true}
                            />
                        </div>
                    </div>

                    {/* 下半部分：文献列表 */}
                    <div className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">文献列表</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <LiteratureListPanel
                                    viewMode={viewMode}
                                    showControls={true}
                                    showPagination={true}
                                    className="border-0"
                                    literatures={literatures}
                                    isLoading={isLoading}
                                />
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* 列表标签页 */}
                <TabsContent value="list" className="space-y-6">
                    <LiteratureListPanel
                        viewMode={viewMode}
                        showControls={true}
                        showPagination={true}
                        literatures={literatures}
                        isLoading={isLoading}
                    />
                </TabsContent>

                {/* 图谱标签页 */}
                <TabsContent value="graph" className="space-y-6">
                    <CitationGraphPanel
                        height="600px"
                        showControls={true}
                        embedded={false}
                    />
                </TabsContent>
            </Tabs>

            {/* 错误状态 */}
            {error && (
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-red-600">
                            <div className="text-sm font-medium">加载失败</div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => loadLiteratures({ force: true })}
                                className="ml-auto"
                            >
                                重试
                            </Button>
                        </div>
                        <div className="text-sm text-red-500 mt-1">{error}</div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

