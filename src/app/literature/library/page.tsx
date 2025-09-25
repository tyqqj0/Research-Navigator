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
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from '@/components/ui';
import { toast } from "sonner";

// 列表组件
import { LiteratureListPanel } from '@/features/literature/management/components/LiteratureListPanel';
import { useLiteratureOperations } from '@/features/literature/hooks/use-literature-operations';
import { useLiteratureCommands } from '@/features/literature/hooks/use-literature-commands';
import LiteratureDetailPanel from '@/features/literature/management/components/LiteratureDetailPanel';
import CitationGraphPanel from '@/features/literature/visualization/citation-graph/CitationGraphPanel';
import { useSessionStore } from '@/features/session/data-access/session-store';
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

    // Esc 关闭
    useEffect(() => {
        if (!detailOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDetailOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => { window.removeEventListener('keydown', onKey); };
    }, [detailOpen]);

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

    // 统一删除状态与流程（单条/批量复用）
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [pendingIds, setPendingIds] = useState<string[] | null>(null);
    const [pendingMode, setPendingMode] = useState<'global' | 'collection'>('global');

    const runCollectionRemoval = useCallback(async (ids: string[], cid: string) => {
        try {
            for (const id of ids) {
                await removeLiteratureFromCollection(cid, id);
            }
            toast.success(`已从集合移除 ${ids.length} 项`);
        } catch (e) {
            console.warn('[LibraryPage] Remove from collection failed', e);
            toast.error('从集合移除失败');
        }
    }, [removeLiteratureFromCollection]);

    const runGlobalDeletion = useCallback(async (ids: string[]) => {
        try {
            for (const id of ids) {
                await deleteLiterature(id, {});
            }
            toast.success(`已删除 ${ids.length} 项`);
        } catch (e) {
            console.warn('[LibraryPage] Global delete failed', e);
            toast.error('删除失败');
        }
    }, [deleteLiterature]);

    const requestDelete = useCallback((ids: string[]) => {
        if (!ids?.length) return;
        if (selectedCollectionId) {
            // 集合上下文：直接移出集合
            void runCollectionRemoval(ids, selectedCollectionId);
        } else {
            // 全库上下文：弹确认
            setPendingIds(ids);
            setPendingMode('global');
            setConfirmOpen(true);
        }
    }, [selectedCollectionId, runCollectionRemoval]);

    const confirmDelete = useCallback(async () => {
        const ids = pendingIds || [];
        setConfirmOpen(false);
        setPendingIds(null);
        if (!ids.length) return;
        if (pendingMode === 'collection' && selectedCollectionId) {
            await runCollectionRemoval(ids, selectedCollectionId);
        } else {
            await runGlobalDeletion(ids);
        }
        // 如果当前详情属于删除集，则关闭
        if (ids.includes(activePaperId || '')) {
            setDetailOpen(false);
            setActivePaperId(undefined);
        }
    }, [pendingIds, pendingMode, selectedCollectionId, runCollectionRemoval, runGlobalDeletion, activePaperId]);

    const handleItemDelete = useCallback(async (item: { literature: { paperId: string } }) => {
        const pid = item?.literature?.paperId;
        if (!pid) return;
        requestDelete([pid]);
    }, [requestDelete]);

    // 批量删除请求复用同一流程
    const requestBulkDelete = useCallback((ids: string[]) => {
        requestDelete(ids);
    }, [requestDelete]);

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
                    <div className={`grid grid-cols-1 xl:grid-cols-6 gap-0 h-full transition-all duration-300`}>
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
                            <div className="p-6 flex-1 min-h-0 flex flex-col">
                                <div className="text-base font-semibold mb-4 flex items-center gap-2">
                                    <Network className="w-5 h-5 text-blue-500" />
                                    引用关系图
                                    {selectedCollectionId ? (() => {
                                        try {
                                            const sessions = Array.from(useSessionStore.getState().sessions.values());
                                            const matched = sessions.find((s: any) => s?.linkedCollectionId === selectedCollectionId);
                                            const title = matched?.title as string | undefined;
                                            return title ? <span className="text-sm text-muted-foreground">（会话：{title}）</span> : null;
                                        } catch { return null; }
                                    })() : null}
                                </div>
                                <div className="flex-1 min-h-0">
                                    <CitationGraphPanel
                                        className="h-full"
                                        visiblePaperIds={visiblePaperIds}
                                        isLoading={isLoading}
                                        onNodeClick={handleNodeClick}
                                        refreshKey={`${selectedCollectionId ?? virtualFilter ?? 'all'}:${miniStats.total}`}
                                    />
                                </div>
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
                                    onBulkDelete={requestBulkDelete}
                                    onAddNew={(paperId) => handleOpenDetail(paperId)}
                                    literatures={filteredLiteratures}
                                    isLoading={isLoading}
                                    className="h-full flex flex-col"
                                    onVisibleIdsChange={handleVisibleIdsChange}
                                />
                            </div>
                        </div>
                    </div>
                    {/* 右侧上层覆盖的文献详情 Overlay：保持挂载以获得过渡动画 */}
                    <LiteratureDetailPanel
                        open={detailOpen}
                        onOpenChange={setDetailOpen}
                        paperId={activePaperId}
                        onUpdated={() => { }}
                        variant="overlay"
                        defaultCollectionId={selectedCollectionId || undefined}
                    />
                </div>
            </MainLayout>
            {/* 删除确认框（全库上下文） */}
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>删除确认</AlertDialogTitle>
                        <AlertDialogDescription>
                            你正在从“全部文献”中删除所选文献。这将从你的文库中彻底删除它们，且不可恢复。是否继续？
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete}>删除</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </RequireAuth>
    );
}