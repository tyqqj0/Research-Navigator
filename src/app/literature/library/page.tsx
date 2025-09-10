"use client";

import React, { useState, useCallback } from 'react';
import { MainLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    Settings,
    Sparkles,
    Database,
    Activity,
    TrendingUp
} from "lucide-react";

// 导入我们的演示组件
import { LiteratureStatsPanel } from '@/features/literature/management/components/LiteratureStatsPanel';
import { CitationGraphPanel } from '@/features/literature/management/components/CitationGraphPanel';
import { LiteratureListPanel } from '@/features/literature/management/components/LiteratureListPanel';
import { LiteratureActions } from '@/features/literature/management/components/LiteratureActions';
import { useLiteratureOperations } from '@/features/literature/hooks/use-literature-operations';

export default function LibraryPage() {
    // 状态管理
    const [activeTab, setActiveTab] = useState<'overview' | 'list' | 'graph'>('overview');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
    const [showStats, setShowStats] = useState(true);
    const [showGraph, setShowGraph] = useState(true);

    // 使用自定义hooks获取数据和操作
    const {
        literatures,
        uiState,
        stats,
        loadLiteratures
    } = useLiteratureOperations();

    const isLoading = uiState.isLoading;
    const error = uiState.error;
    const totalCount = stats.total;

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

    const user = {
        name: 'Research User',
        avatar: undefined
    };

    const headerActions = (
        <div className="flex items-center space-x-2">
            <Button
                variant="outline"
                size="sm"
                onClick={() => loadLiteratures({ force: true })}
                disabled={isLoading}
            >
                <Activity className="w-4 h-4 mr-2" />
                刷新数据
            </Button>
            <Button variant="outline" size="sm">
                <Upload className="w-4 h-4 mr-2" />
                导入文献
            </Button>
            <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                导出
            </Button>
            <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                新建收藏夹
            </Button>
        </div>
    );

    return (
        <MainLayout
            headerTitle="我的文库"
            headerActions={headerActions}
            user={user}
            showSidebar={true}
        >
            <div className="literature-page space-y-6 p-6">
                {/* 顶部工具栏 */}
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-blue-600" />
                        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                            文献管理
                        </h1>
                        <Badge variant="secondary" className="ml-2">
                            {totalCount} 篇文献
                        </Badge>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={toggleStatsPanel}
                            className="flex items-center gap-2"
                        >
                            <BarChart3 className="w-4 h-4" />
                            {showStats ? '隐藏' : '显示'}统计
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={toggleGraphPanel}
                            className="flex items-center gap-2"
                        >
                            <Network className="w-4 h-4" />
                            {showGraph ? '隐藏' : '显示'}关系图
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
                            className="flex items-center gap-2"
                        >
                            {viewMode === 'list' ? <Grid className="w-4 h-4" /> : <List className="w-4 h-4" />}
                            {viewMode === 'list' ? '网格视图' : '列表视图'}
                        </Button>
                    </div>
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

                {/* 主要内容区域 */}
                


                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
                    <TabsContent value="graph" className="mt-6">
                        <CitationGraphPanel />
                    </TabsContent>
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="overview" className="flex items-center gap-2">
                            <BarChart3 className="w-4 h-4" />
                            概览
                        </TabsTrigger>
                        <TabsTrigger value="list" className="flex items-center gap-2">
                            <List className="w-4 h-4" />
                            文献列表
                        </TabsTrigger>
                        <TabsTrigger value="graph" className="flex items-center gap-2">
                            <Network className="w-4 h-4" />
                            引用关系图
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-6 mt-6">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* 统计面板 */}
                            {showStats && (
                                <div className="lg:col-span-2">
                                    <LiteratureStatsPanel />
                                </div>
                            )}

                            {/* 操作面板 */}
                            <div className={showStats ? "lg:col-span-1" : "lg:col-span-3"}>
                                <LiteratureActions />
                            </div>
                        </div>

                        {/* 引用关系图 */}
                        {showGraph && (
                            <div className="mt-6">
                                <CitationGraphPanel />
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="list" className="mt-6">
                        <LiteratureListPanel />
                    </TabsContent>


                </Tabs>

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
    );
}