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
    Users,
    Folder,
    Inbox,
    Plus,
    MoreVertical,
    Edit2,
    Trash2
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
import { cn } from '@/lib/utils';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';

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

    // 移动端标签页状态
    const [mobileTab, setMobileTab] = useState<'collections' | 'list' | 'graph'>('list');

    // 集合操作（用于加载、过滤与上下文删除）
    const {
        collections,
        loadCollections,
        removeLiteratureFromCollection,
        getCollection,
        createCollection,
        updateCollection,
        deleteCollection,
    } = useCollectionOperations();

    // 移动端集合管理对话框状态
    const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
    const [collectionDialogMode, setCollectionDialogMode] = useState<'create' | 'rename'>('create');
    const [collectionDialogName, setCollectionDialogName] = useState('');
    const [collectionDialogTargetId, setCollectionDialogTargetId] = useState<string | null>(null);
    const [collectionDialogSubmitting, setCollectionDialogSubmitting] = useState(false);

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

    // 集合选择处理函数
    const handleCollectionSelect = useCallback((id: string | null) => {
        if (id === '__UNFILED__') {
            setVirtualFilter('unfiled');
            setSelectedCollectionId(null);
        } else if (id == null || id === '__ALL__') {
            setVirtualFilter('all');
            setSelectedCollectionId(null);
        } else {
            setVirtualFilter(null);
            setSelectedCollectionId(id);
        }
    }, []);

    // 获取当前选中的集合名称（用于移动端下拉框）
    const currentCollectionName = useMemo(() => {
        if (virtualFilter === 'all') return '全部文献';
        if (virtualFilter === 'unfiled') return '未归档';
        if (selectedCollectionId) {
            const collection = getCollection(selectedCollectionId);
            return collection?.name || '未知集合';
        }
        return '全部文献';
    }, [virtualFilter, selectedCollectionId, getCollection]);

    // 打开新建集合对话框
    const openCreateCollectionDialog = useCallback(() => {
        setCollectionDialogMode('create');
        setCollectionDialogName('');
        setCollectionDialogTargetId(null);
        setCollectionDialogOpen(true);
    }, []);

    // 打开编辑集合对话框
    const openRenameCollectionDialog = useCallback((id: string, currentName: string) => {
        setCollectionDialogMode('rename');
        setCollectionDialogName(currentName);
        setCollectionDialogTargetId(id);
        setCollectionDialogOpen(true);
    }, []);

    // 提交集合创建/编辑
    const handleSubmitCollectionDialog = useCallback(async () => {
        const name = collectionDialogName.trim();
        if (!name) return;

        setCollectionDialogSubmitting(true);
        try {
            if (collectionDialogMode === 'create') {
                const created = await createCollection({
                    name,
                    description: '',
                    type: 'general',
                    ownerUid: '',
                    isPublic: false,
                    parentId: null,
                } as any);
                toast.success(`集合 "${name}" 创建成功`);
                handleCollectionSelect(created.id);
                setMobileTab('list'); // 创建后自动切换到列表标签
            } else if (collectionDialogMode === 'rename' && collectionDialogTargetId) {
                await updateCollection(collectionDialogTargetId, { name } as any);
                toast.success(`集合已重命名为 "${name}"`);
            }
            setCollectionDialogOpen(false);
        } catch (error) {
            toast.error(collectionDialogMode === 'create' ? '创建集合失败' : '重命名集合失败');
        } finally {
            setCollectionDialogSubmitting(false);
        }
    }, [collectionDialogName, collectionDialogMode, collectionDialogTargetId, createCollection, updateCollection, handleCollectionSelect]);

    // 删除集合
    const handleDeleteCollection = useCallback(async (id: string, name: string) => {
        if (!confirm(`确定要删除集合 "${name}" 吗？此操作不会删除其中的文献。`)) {
            return;
        }

        try {
            await deleteCollection(id);
            toast.success(`集合 "${name}" 已删除`);
            if (selectedCollectionId === id) {
                handleCollectionSelect(null);
            }
        } catch (error) {
            toast.error('删除集合失败');
        }
    }, [deleteCollection, selectedCollectionId, handleCollectionSelect]);

    return (
        <RequireAuth>
            <MainLayout showSidebar={true} showHeader={false} pageHeader={pageHeader}>
                <div className="p-0 h-full relative">
                    {/* 桌面端：三列网格布局 */}
                    <div className="hidden xl:grid xl:grid-cols-5 gap-0 h-full">
                        {/* 左侧：集合树 */}
                        <div className="xl:col-span-1 border-r border-border h-full">
                            <div className="p-4 h-full overflow-y-auto">
                                <CollectionTreePanel onSelectCollection={handleCollectionSelect} />
                            </div>
                        </div>

                        {/* 中间：图谱区 */}
                        <div className="xl:col-span-2 border-r border-border h-full flex flex-col min-h-0">
                            <div className="p-4 flex-1 min-h-0 flex flex-col">
                                <div className="text-base font-semibold mb-3 flex items-center gap-2">
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
                            <div className="p-4">
                                <Card>
                                    <CardHeader className="pb-2 pt-4 px-4">
                                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                                            <BarChart3 className="w-4 h-4" />
                                            总览
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 px-4 pb-4">
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
                                <div className="px-4">
                                    <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20">
                                        <CardContent className="pt-4 pb-4">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                                                    <Activity className="w-4 h-4" />
                                                    <span className="font-medium text-sm">加载错误:</span>
                                                    <span className="truncate text-sm">{error}</span>
                                                </div>
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={() => loadLiteratures({ force: true })}
                                                    disabled={isLoading}
                                                >
                                                    重试
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            )}
                            {addError && (
                                <div className="px-4">
                                    <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20">
                                        <CardContent className="pt-3 pb-3 text-sm text-red-600 dark:text-red-400">
                                            添加错误: {addError}
                                        </CardContent>
                                    </Card>
                                </div>
                            )}

                            {/* 文献列表：内部滚动 */}
                            <div className="flex-1 min-h-0 px-4 pb-4">
                                <LiteratureListPanel
                                    onItemClick={(item) => handleOpenDetail(item.literature.paperId)}
                                    onItemDelete={handleItemDelete}
                                    onBulkDelete={requestBulkDelete}
                                    onAddNew={(paperId) => handleOpenDetail(paperId)}
                                    literatures={filteredLiteratures}
                                    isLoading={isLoading}
                                    className="h-full flex flex-col"
                                    onVisibleIdsChange={handleVisibleIdsChange}
                                    contextCollectionId={selectedCollectionId}
                                />
                            </div>
                        </div>
                    </div>

                    {/* 移动端：标签页切换模式 */}
                    <div className="xl:hidden h-[calc(100vh-8rem)] flex flex-col">
                        {/* 标签页导航 - 优化高度 */}
                        <div className="shrink-0 flex border-b theme-border-primary theme-background-primary">
                            <button
                                onClick={() => setMobileTab('collections')}
                                className={cn(
                                    'flex-1 px-2 py-2 text-sm font-medium transition-colors',
                                    mobileTab === 'collections'
                                        ? 'border-b-2 border-blue-600 text-blue-600'
                                        : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                📁 集合
                            </button>
                            <button
                                onClick={() => setMobileTab('list')}
                                className={cn(
                                    'flex-1 px-2 py-2 text-sm font-medium transition-colors',
                                    mobileTab === 'list'
                                        ? 'border-b-2 border-blue-600 text-blue-600'
                                        : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                📚 列表
                            </button>
                            <button
                                onClick={() => setMobileTab('graph')}
                                className={cn(
                                    'flex-1 px-2 py-2 text-sm font-medium transition-colors',
                                    mobileTab === 'graph'
                                        ? 'border-b-2 border-blue-600 text-blue-600'
                                        : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                🌐 图谱
                            </button>
                        </div>

                        {/* 标签页内容 */}
                        <div className="flex-1 min-h-0">
                            {mobileTab === 'collections' && (
                                <div className="h-full flex flex-col">
                                    {/* 顶部：新建集合按钮 */}
                                    <div className="shrink-0 px-3 pt-3 pb-2">
                                        <Button
                                            onClick={openCreateCollectionDialog}
                                            className="w-full"
                                            variant="outline"
                                        >
                                            <Plus className="w-4 h-4 mr-2" />
                                            新建集合
                                        </Button>
                                    </div>

                                    {/* 集合列表 */}
                                    <div className="flex-1 overflow-y-auto px-3 pb-3">
                                        <div className="space-y-1">
                                            {/* 全部文献 */}
                                            <button
                                                onClick={() => handleCollectionSelect(null)}
                                                className={cn(
                                                    'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left',
                                                    virtualFilter === 'all'
                                                        ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium'
                                                        : 'hover:bg-accent'
                                                )}
                                            >
                                                <BookOpen className="w-4 h-4 shrink-0" />
                                                <span className="flex-1">全部文献</span>
                                                <span className="text-xs text-muted-foreground">{miniStats.total}</span>
                                            </button>

                                            {/* 未归档 */}
                                            <button
                                                onClick={() => handleCollectionSelect('__UNFILED__')}
                                                className={cn(
                                                    'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left',
                                                    virtualFilter === 'unfiled'
                                                        ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium'
                                                        : 'hover:bg-accent'
                                                )}
                                            >
                                                <Inbox className="w-4 h-4 shrink-0" />
                                                <span className="flex-1">未归档</span>
                                            </button>

                                            {/* 分隔线 */}
                                            {collections && collections.length > 0 && (
                                                <div className="my-2 border-t border-border" />
                                            )}

                                            {/* 集合列表 */}
                                            {collections && collections.length > 0 && (
                                                <div className="space-y-1">
                                                    <div className="px-3 py-1 text-xs font-medium text-muted-foreground flex items-center justify-between">
                                                        <span>我的集合</span>
                                                        <span className="text-muted-foreground">{collections.length}</span>
                                                    </div>
                                                    {collections.map((collection) => (
                                                        <div
                                                            key={collection.id}
                                                            className={cn(
                                                                'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors group',
                                                                selectedCollectionId === collection.id
                                                                    ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium'
                                                                    : 'hover:bg-accent'
                                                            )}
                                                        >
                                                            <button
                                                                onClick={() => handleCollectionSelect(collection.id)}
                                                                className="flex-1 flex items-center gap-2 text-left min-w-0"
                                                            >
                                                                <Folder className="w-4 h-4 shrink-0" />
                                                                <span className="flex-1 truncate">{collection.name}</span>
                                                            </button>
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    >
                                                                        <MoreVertical className="w-4 h-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuItem
                                                                        onClick={() => openRenameCollectionDialog(collection.id, collection.name)}
                                                                    >
                                                                        <Edit2 className="w-4 h-4 mr-2" />
                                                                        重命名
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem
                                                                        className="text-red-600"
                                                                        onClick={() => handleDeleteCollection(collection.id, collection.name)}
                                                                    >
                                                                        <Trash2 className="w-4 h-4 mr-2" />
                                                                        删除
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* 空状态 */}
                                            {(!collections || collections.length === 0) && (
                                                <div className="mt-8 text-center text-sm text-muted-foreground">
                                                    <Folder className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                                    <p>暂无集合</p>
                                                    <p className="text-xs mt-1">点击上方按钮创建第一个集合</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {mobileTab === 'list' && (
                                <div className="h-full p-3">
                                    <LiteratureListPanel
                                        onItemClick={(item) => handleOpenDetail(item.literature.paperId)}
                                        onItemDelete={handleItemDelete}
                                        onBulkDelete={requestBulkDelete}
                                        onAddNew={(paperId) => handleOpenDetail(paperId)}
                                        literatures={filteredLiteratures}
                                        isLoading={isLoading}
                                        className="h-full flex flex-col"
                                        onVisibleIdsChange={handleVisibleIdsChange}
                                        contextCollectionId={selectedCollectionId}
                                    />
                                </div>
                            )}

                            {mobileTab === 'graph' && (
                                <div className="h-full flex flex-col p-3">
                                    <div className="text-base font-semibold mb-3 flex items-center gap-2">
                                        <Network className="w-5 h-5 text-blue-500" />
                                        引用关系图
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
                            )}
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
                            你正在从"全部文献"中删除所选文献。这将从你的文库中彻底删除它们，且不可恢复。是否继续？
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete}>删除</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* 移动端集合管理对话框 */}
            <Dialog open={collectionDialogOpen} onOpenChange={setCollectionDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {collectionDialogMode === 'create' ? '新建集合' : '重命名集合'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <Input
                            placeholder="请输入集合名称"
                            value={collectionDialogName}
                            onChange={(e) => setCollectionDialogName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleSubmitCollectionDialog();
                                }
                            }}
                            autoFocus
                        />
                        <div className="flex items-center justify-end gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setCollectionDialogOpen(false)}
                                disabled={collectionDialogSubmitting}
                            >
                                取消
                            </Button>
                            <Button
                                onClick={handleSubmitCollectionDialog}
                                disabled={collectionDialogSubmitting || !collectionDialogName.trim()}
                            >
                                {collectionDialogSubmitting ? '提交中...' : '确定'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </RequireAuth>
    );
}