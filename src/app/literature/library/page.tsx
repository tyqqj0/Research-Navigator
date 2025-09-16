"use client";

import React, { useMemo, useEffect, useState, useCallback } from 'react';
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
import { useLiteratureCommands } from '@/features/literature/hooks/use-literature-commands';
import LiteratureDetailPanel from '@/features/literature/management/components/LiteratureDetailPanel';
import CitationGraphPanel from '@/features/literature/visualization/citation-graph/CitationGraphPanel';
import { useLiteratureViewStore } from '@/features/literature/stores/view-store';
import { CollectionTreePanel } from '@/features/literature/management/components/CollectionTreePanel';
import { useCollectionOperations } from '@/features/literature/hooks';
import RequireAuth from '@/components/auth/RequireAuth';
import useAuthStore from '@/stores/auth.store';

export default function LibraryPage() {
    // 使用自定义hooks获取数据和操作
    const {
        literatures,
        uiState,
        loadLiteratures,
        deleteLiterature
    } = useLiteratureOperations();

    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const { addByIdentifier } = useLiteratureCommands();
    const [detailOpen, setDetailOpen] = useState(false);
    const [activePaperId, setActivePaperId] = useState<string | undefined>(undefined);
    const [visiblePaperIds, setVisiblePaperIds] = useState<string[]>([]);
    const [addError, setAddError] = useState<string | null>(null);
    const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
    const [virtualFilter, setVirtualFilter] = useState<null | 'all' | 'unfiled'>(null);

    // 集合操作（用于加载、过滤与上下文删除）
    const {
        collections,
        loadCollections,
        removeLiteratureFromCollection,
        getCollection,
    } = useCollectionOperations();

    // 首次加载数据
    useEffect(() => {
        if (isAuthenticated) {
            loadLiteratures({ force: false }).catch(() => { });
            loadCollections({ force: false }).catch(() => { });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated]);

    const isLoading = uiState.isLoading;
    const error = uiState.error;
    // 基于选中集合进行过滤
    const filteredLiteratures = useMemo(() => {
        // 虚拟过滤：全部
        if (virtualFilter === 'all') return literatures;

        // 虚拟过滤：未归档（未被任何集合包含）
        if (virtualFilter === 'unfiled') {
            const assigned = new Set<string>();
            for (const c of collections || []) {
                for (const pid of c.paperIds) assigned.add(pid);
            }
            return literatures.filter(item => !assigned.has(item.literature.paperId));
        }

        // 具体集合过滤
        if (selectedCollectionId) {
            const c = getCollection(selectedCollectionId);
            if (!c) return literatures;
            const idSet = new Set(c.paperIds);
            return literatures.filter(item => idSet.has(item.literature.paperId));
        }

        // 默认全部
        return literatures;
    }, [virtualFilter, selectedCollectionId, literatures, getCollection, collections]);


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

    const handleAdd = useCallback(async (identifier: string) => {
        const v = (identifier || '').trim();
        if (!v) return;
        setAddError(null);
        try {
            const created = await addByIdentifier(v, { autoExtractCitations: false });
            const pid = created.paperId;
            setActivePaperId(pid);
            setDetailOpen(true);
        } catch (e: any) {
            setAddError(e?.message || '添加失败');
        }
    }, [addByIdentifier]);

    const handleOpenDetail = useCallback((paperId: string) => {
        setActivePaperId(paperId);
        setDetailOpen(true);
    }, []);

    // 稳定的可见ID变更处理，避免父组件每次渲染导致子组件effect重复触发
    const handleVisibleIdsChange = useCallback((ids: string[]) => {
        setVisiblePaperIds(prev => {
            if (prev.length === ids.length && prev.every((v, i) => v === ids[i])) return prev;
            return ids;
        });
        try { useLiteratureViewStore.getState().setVisiblePaperIds(ids); } catch { }
    }, []);

    // 稳定的节点点击处理，避免传入图谱组件的回调每次变更导致其内部副作用重复执行
    const handleNodeClick = useCallback((pid: string) => {
        setActivePaperId(pid);
        setDetailOpen(true);
        try { useLiteratureViewStore.getState().setActivePaperId(pid); } catch { }
    }, []);

    const handleItemDelete = useCallback(async (item: { literature: { paperId: string } }) => {
        const pid = item?.literature?.paperId;
        if (!pid) return;
        try {
            console.log('[LibraryPage] Deleting literature', pid);
            if (selectedCollectionId) {
                await removeLiteratureFromCollection(selectedCollectionId, pid);
            } else {
                // 默认走自动策略（服务层按是否仅当前用户使用决定）
                await deleteLiterature(pid, {});
            }
            if (activePaperId === pid) {
                setDetailOpen(false);
                setActivePaperId(undefined);
            }
        } catch (e) {
            console.warn('[LibraryPage] Delete failed', e);
        }
    }, [deleteLiterature, activePaperId, selectedCollectionId, removeLiteratureFromCollection]);

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
                <div className="p-0 h-full relative">
                    <div className={`grid grid-cols-1 xl:grid-cols-6 gap-0 h-full transition-all duration-300 ${detailOpen ? 'pr-[38rem]' : ''}`}>
                        {/* 左侧：集合树 */}
                        <div className="hidden xl:block xl:col-span-1 border-r border-border h-full">
                            <div className="p-6 h-full overflow-y-auto">
                                <CollectionTreePanel onSelectCollection={(id) => {
                                    if (id === '__UNFILED__') {
                                        setVirtualFilter('unfiled');
                                        setSelectedCollectionId(null);
                                    } else if (id == null) {
                                        setVirtualFilter('all');
                                        setSelectedCollectionId(null);
                                    } else {
                                        setVirtualFilter(null);
                                        setSelectedCollectionId(id);
                                    }
                                }} />
                            </div>
                        </div>

                        {/* 中间：图谱区 */}
                        <div className="xl:col-span-3 border-r border-border h-full flex flex-col min-h-0">
                            <div className="p-6 flex-1 min-h-0">
                                <CitationGraphPanel
                                    className="h-full"
                                    visiblePaperIds={visiblePaperIds}
                                    isLoading={isLoading}
                                    onNodeClick={handleNodeClick}
                                    refreshKey={`${selectedCollectionId ?? virtualFilter ?? 'all'}:${miniStats.total}`}
                                />
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
                                            <div className="flex items-center gap-2 p-2 rounded-md border border-border">
                                                <BookOpen className="w-4 h-4 text-blue-600" />
                                                <div className="truncate">
                                                    <div className="text-xs text-muted-foreground">总文献数</div>
                                                    <div className="font-semibold">{miniStats.total}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 p-2 rounded-md border border-border">
                                                <Users className="w-4 h-4 text-emerald-600" />
                                                <div className="truncate">
                                                    <div className="text-xs text-muted-foreground">作者数</div>
                                                    <div className="font-semibold">{miniStats.authorCount}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 p-2 rounded-md border border-border">
                                                <Calendar className="w-4 h-4 text-orange-600" />
                                                <div className="truncate">
                                                    <div className="text-xs text-muted-foreground">年份范围</div>
                                                    <div className="font-semibold">{miniStats.yearSpanText}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 p-2 rounded-md border border-border">
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
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                                                    <Activity className="w-4 h-4" />
                                                    <span className="font-medium">加载错误:</span>
                                                    <span className="truncate">{error}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => loadLiteratures({ force: true })}
                                                        disabled={isLoading}
                                                    >
                                                        重新加载
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => loadLiteratures({ force: true })}
                                                        disabled={isLoading}
                                                    >
                                                        重试
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            )}
                            {addError && (
                                <div className="px-6">
                                    <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20">
                                        <CardContent className="pt-4 pb-4 text-sm text-red-600 dark:text-red-400">
                                            添加错误: {addError}
                                        </CardContent>
                                    </Card>
                                </div>
                            )}

                            {/* 文献列表：内部滚动 */}
                            <div className="flex-1 min-h-0 px-6 pb-6">
                                <LiteratureListPanel
                                    onItemClick={(item) => handleOpenDetail(item.literature.paperId)}
                                    onItemDelete={handleItemDelete}
                                    onAddNew={(paperId) => handleOpenDetail(paperId)}
                                    literatures={filteredLiteratures}
                                    isLoading={isLoading}
                                    className="h-full flex flex-col"
                                    onVisibleIdsChange={handleVisibleIdsChange}
                                />
                            </div>
                        </div>
                    </div>
                    {/* 侧边详情面板：限制在内容区域内，不覆盖顶端页头 */}
                    <div className="absolute inset-y-0 right-0 z-30 pointer-events-none">
                        <div className="h-full">
                            <div className="w-[38rem] max-w-[90vw] h-full transform transition-transform duration-300 shadow-xl pointer-events-auto"
                                style={{ transform: detailOpen ? 'translateX(0)' : 'translateX(100%)' }}>
                                <LiteratureDetailPanel
                                    open={detailOpen}
                                    onOpenChange={setDetailOpen}
                                    paperId={activePaperId}
                                    onUpdated={() => { }}
                                    variant="side"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </MainLayout>
        </RequireAuth>
    );
}