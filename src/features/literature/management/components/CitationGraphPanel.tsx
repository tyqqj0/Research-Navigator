"use client";

import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Network,
    Maximize2,
    Minimize2,
    RefreshCw,
    Zap,
    ZapOff,
    Settings,
    Info,
    Play,
    Pause
} from "lucide-react";
import { useCitationOperations } from '../../hooks/use-citation-operations';
import { useLiteratureOperations } from '../../hooks/use-literature-operations';

interface CitationGraphPanelProps {
    className?: string;
    height?: string;
    embedded?: boolean;
    showControls?: boolean;
}

export function CitationGraphPanel({
    className,
    height = "500px",
    embedded = false,
    showControls = true
}: CitationGraphPanelProps) {
    // 状态管理
    const [isExpanded, setIsExpanded] = useState(false);
    const [layoutMode, setLayoutMode] = useState<'force' | 'hierarchical' | 'circular'>('force');
    const [physicsEnabled, setPhysicsEnabled] = useState(true);
    const [showLabels, setShowLabels] = useState(true);
    const [animationEnabled, setAnimationEnabled] = useState(true);

    // 数据hooks
    const { literatures, uiState: literatureUIState } = useLiteratureOperations();
    const {
        citations,
        uiState: citationUIState
    } = useCitationOperations();

    // 计算图谱统计信息
    const graphStats = useMemo(() => {
        // 防止 undefined 值引起错误
        const items = literatures || [];
        const citationList = citations || [];

        const nodeCount = items.length;
        const edgeCount = citationList.length;

        // 计算连接度分布
        const connectionCounts = items.map(item => {
            const itemId = item.literature.paperId;
            const inbound = citationList.filter(c => c.targetItemId === itemId).length;
            const outbound = citationList.filter(c => c.sourceItemId === itemId).length;
            return inbound + outbound;
        });

        const avgConnections = connectionCounts.length > 0
            ? connectionCounts.reduce((sum, count) => sum + count, 0) / connectionCounts.length
            : 0;

        const maxConnections = Math.max(...connectionCounts, 0);
        const connectedNodes = connectionCounts.filter(count => count > 0).length;

        return {
            nodes: nodeCount,
            edges: edgeCount,
            avgConnections: avgConnections.toFixed(1),
            maxConnections,
            connectedNodes,
            isolatedNodes: nodeCount - connectedNodes,
            density: nodeCount > 1 ? ((edgeCount * 2) / (nodeCount * (nodeCount - 1)) * 100).toFixed(1) : '0'
        };
    }, [literatures, citations]);

    // 处理节点点击
    const handleNodeClick = useCallback((nodeId: string) => {
        console.log('Node clicked:', nodeId);
        // TODO: 实现节点详情显示或导航
    }, []);

    // 处理连接创建
    const handleCreateConnection = useCallback(async (sourceId: string, targetId: string) => {
        try {
            // TODO: 实现引用关系创建功能
            console.log('创建引用关系:', { sourceId, targetId });
        } catch (error) {
            console.error('Failed to create citation:', error);
        }
    }, []);

    // 处理连接删除
    const handleDeleteConnection = useCallback(async (sourceId: string, targetId: string) => {
        try {
            // TODO: 实现引用关系删除功能
            console.log('删除引用关系:', { sourceId, targetId });
        } catch (error) {
            console.error('Failed to delete citation:', error);
        }
    }, []);

    // 切换展开状态
    const toggleExpanded = useCallback(() => {
        setIsExpanded(prev => !prev);
    }, []);

    // 刷新图谱
    const handleRefresh = useCallback(() => {
        // TODO: 实现刷新功能
        console.log('刷新图谱');
    }, []);

    // 切换物理引擎
    const togglePhysics = useCallback(() => {
        setPhysicsEnabled(prev => !prev);
    }, []);

    const actualHeight = isExpanded ? "80vh" : height;

    if (citationUIState.isLoading || literatureUIState.isLoading) {
        return (
            <Card className={className}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Network className="h-5 w-5" />
                        知识图谱
                    </CardTitle>
                </CardHeader>
                <CardContent style={{ height: actualHeight }}>
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-500" />
                            <p className="text-muted-foreground">正在加载图谱数据...</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={`${className} ${isExpanded ? 'fixed inset-4 z-50' : ''}`}>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Network className="h-5 w-5" />
                        知识图谱
                        {!embedded && (
                            <Badge variant="secondary" className="ml-2">
                                {graphStats.nodes} 节点 · {graphStats.edges} 连接
                            </Badge>
                        )}
                    </CardTitle>

                    {showControls && (
                        <div className="flex items-center gap-2">
                            {/* 布局模式选择 */}
                            <Select value={layoutMode} onValueChange={(value) => setLayoutMode(value as any)}>
                                <SelectTrigger className="w-32 h-8">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="force">力导向</SelectItem>
                                    <SelectItem value="hierarchical">层次布局</SelectItem>
                                    <SelectItem value="circular">环形布局</SelectItem>
                                </SelectContent>
                            </Select>

                            {/* 物理引擎切换 */}
                            <Button
                                variant={physicsEnabled ? "default" : "outline"}
                                size="sm"
                                onClick={togglePhysics}
                            >
                                {physicsEnabled ? <Zap className="h-4 w-4" /> : <ZapOff className="h-4 w-4" />}
                            </Button>

                            {/* 刷新按钮 */}
                            <Button variant="outline" size="sm" onClick={handleRefresh}>
                                <RefreshCw className="h-4 w-4" />
                            </Button>

                            {/* 展开/收起按钮 */}
                            {!embedded && (
                                <Button variant="outline" size="sm" onClick={toggleExpanded}>
                                    {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                {/* 图谱统计信息 */}
                {!embedded && (
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                            <Info className="h-4 w-4" />
                            <span>密度: {graphStats.density}%</span>
                        </div>
                        <div>平均连接: {graphStats.avgConnections}</div>
                        <div>最大连接: {graphStats.maxConnections}</div>
                        <div>孤立节点: {graphStats.isolatedNodes}</div>
                    </div>
                )}
            </CardHeader>

            <CardContent className="p-0">
                <div
                    className="relative bg-gray-50 rounded-lg"
                    style={{ height: actualHeight }}
                >
                    {/* 图谱可视化区域 */}
                    {graphStats.nodes > 0 ? (
                        <div className="w-full h-full flex items-center justify-center">
                            {/* TODO: 集成实际的图谱可视化组件 */}
                            <div className="text-center space-y-4">
                                <Network className="h-16 w-16 mx-auto text-blue-500" />
                                <div>
                                    <h3 className="font-semibold text-lg">知识图谱可视化</h3>
                                    <p className="text-muted-foreground">
                                        {graphStats.nodes} 个文献节点，{graphStats.edges} 个引用关系
                                    </p>
                                </div>
                                <div className="flex items-center justify-center gap-4 text-sm">
                                    <Badge variant="outline">布局: {layoutMode}</Badge>
                                    <Badge variant="outline">
                                        物理: {physicsEnabled ? '开启' : '关闭'}
                                    </Badge>
                                    <Badge variant="outline">
                                        标签: {showLabels ? '显示' : '隐藏'}
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <div className="text-center space-y-4">
                                <Network className="h-16 w-16 mx-auto text-gray-300" />
                                <div>
                                    <h3 className="font-semibold text-lg text-muted-foreground">暂无图谱数据</h3>
                                    <p className="text-muted-foreground">
                                        添加文献并建立引用关系后，图谱将在这里显示
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 图谱控制面板 */}
                    {showControls && !embedded && (
                        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur border rounded-lg p-3 space-y-2">
                            <div className="flex items-center gap-2">
                                <Button
                                    variant={showLabels ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setShowLabels(!showLabels)}
                                >
                                    标签
                                </Button>
                                <Button
                                    variant={animationEnabled ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setAnimationEnabled(!animationEnabled)}
                                >
                                    {animationEnabled ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                                </Button>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                拖拽节点可重新排列 • 双击节点查看详情
                            </div>
                        </div>
                    )}

                    {/* 图例 */}
                    {!embedded && (
                        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur border rounded-lg p-3 space-y-2">
                            <div className="text-sm font-medium">图例</div>
                            <div className="space-y-1 text-xs">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                    <span>文献节点</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-0.5 bg-gray-400"></div>
                                    <span>引用关系</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                    <span>高引用节点</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

