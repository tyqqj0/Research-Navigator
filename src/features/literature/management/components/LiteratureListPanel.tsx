"use client";

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchInput, Skeleton } from "@/components/ui";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {

    ArrowUpDown,
    ArrowUp,
    ArrowDown,

    MoreHorizontal,
    Edit,
    Trash2,
    Eye,
    Calendar,
    User,
    BookOpen,
    ChevronLeft,
    ChevronRight,
    Loader2
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLiteratureOperations } from '../../hooks/use-literature-operations';
import { useLiteratureCommands } from '../../hooks/use-literature-commands';
import { LibraryItem, EnhancedLibraryItem } from '../../data-access/models';

// 添加缺失的类型定义
type SortField = 'title' | 'authors' | 'year' | 'createdAt' | 'updatedAt';
type SortOrder = 'asc' | 'desc';

interface LiteratureListPanelProps {
    className?: string;
    viewMode?: 'list' | 'grid';
    showControls?: boolean;
    showPagination?: boolean;
    limit?: number;
    literatures?: EnhancedLibraryItem[]; // 可选的外部数据
    isLoading?: boolean; // 可选的外部加载状态
    onItemClick?: (item: EnhancedLibraryItem) => void;
    onItemEdit?: (item: EnhancedLibraryItem) => void;
    onItemDelete?: (item: EnhancedLibraryItem) => void;
    onBulkDelete?: (paperIds: string[]) => void | Promise<void>;
    onAddNew?: (paperId: string) => void;
    onVisibleIdsChange?: (ids: string[]) => void; // 新增：通知“未分页可见全集”变化
}

export function LiteratureListPanel({
    className,
    viewMode = 'list',
    showControls = true,
    showPagination = true,
    limit,
    literatures: externalLiteratures,
    isLoading: externalIsLoading,
    onItemClick,
    onItemEdit,
    onItemDelete,
    onBulkDelete,
    onAddNew,
    onVisibleIdsChange
}: LiteratureListPanelProps) {
    // 状态管理
    const [searchQuery, setSearchQuery] = useState('');
    const [sortField, setSortField] = useState<SortField>('createdAt');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(limit || 6);
    const [sourceFilter, setSourceFilter] = useState<string>('all');
    const [yearFilter, setYearFilter] = useState<string>('all');
    const [pageInput, setPageInput] = useState<string>('1');

    // 数据hooks - 只在没有外部数据时使用
    const hookResult = useLiteratureOperations();
    const { addByIdentifier } = useLiteratureCommands();
    const { deleteLiterature, batchDeleteLiteratures } = hookResult;
    const [addInput, setAddInput] = useState('');
    const [adding, setAdding] = useState(false);
    const [addError, setAddError] = useState<string | null>(null);

    // 使用外部数据或hook数据
    const literatures = externalLiteratures || hookResult.literatures;
    const isLoading = externalIsLoading !== undefined ? externalIsLoading : hookResult.uiState.isLoading;

    // 过滤和排序逻辑
    const filteredAndSortedItems = useMemo(() => {
        // 防御性检查：确保 literatures 是数组
        if (!Array.isArray(literatures)) {
            return [];
        }

        let filtered = literatures;

        // 搜索过滤
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(item => {
                const literature = item.literature;
                return (
                    literature.title.toLowerCase().includes(query) ||
                    literature.authors.some(author => author.toLowerCase().includes(query)) ||
                    literature.abstract?.toLowerCase().includes(query) ||
                    literature.summary?.toLowerCase().includes(query)
                );
            });
        }

        // 来源过滤
        if (sourceFilter !== 'all') {
            filtered = filtered.filter(item => item.literature.source === sourceFilter);
        }

        // 年份过滤
        if (yearFilter !== 'all') {
            const currentYear = new Date().getFullYear();
            switch (yearFilter) {
                case 'recent':
                    filtered = filtered.filter(item =>
                        item.literature.year && item.literature.year >= currentYear - 5
                    );
                    break;
                case 'old':
                    filtered = filtered.filter(item =>
                        item.literature.year && item.literature.year < currentYear - 5
                    );
                    break;
                default:
                    if (yearFilter.includes('-')) {
                        const [start, end] = yearFilter.split('-').map(Number);
                        filtered = filtered.filter(item =>
                            item.literature.year &&
                            item.literature.year >= start &&
                            item.literature.year <= end
                        );
                    }
            }
        }

        // 排序
        filtered.sort((a, b) => {
            let aValue: any;
            let bValue: any;

            switch (sortField) {
                case 'title':
                    aValue = a.literature.title.toLowerCase();
                    bValue = b.literature.title.toLowerCase();
                    break;
                case 'authors':
                    aValue = a.literature.authors.join(', ').toLowerCase();
                    bValue = b.literature.authors.join(', ').toLowerCase();
                    break;
                case 'year':
                    aValue = a.literature.year || 0;
                    bValue = b.literature.year || 0;
                    break;
                case 'createdAt':
                    aValue = new Date(a.literature.createdAt).getTime();
                    bValue = new Date(b.literature.createdAt).getTime();
                    break;
                // case 'updatedAt':
                //     aValue = new Date(a.literature.updatedAt).getTime();
                //     bValue = new Date(b.literature.updatedAt).getTime();
                //     break;
                default:
                    aValue = a.literature.title.toLowerCase();
                    bValue = b.literature.title.toLowerCase();
            }

            if (sortOrder === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });

        return filtered;
    }, [literatures, searchQuery, sourceFilter, yearFilter, sortField, sortOrder]);

    // 当“未分页的可见全集”变化时，通知外部（图谱使用）
    useEffect(() => {
        if (onVisibleIdsChange) {
            onVisibleIdsChange(filteredAndSortedItems.map(i => i.literature.paperId));
        }
    }, [filteredAndSortedItems, onVisibleIdsChange]);

    // 分页逻辑
    const paginatedItems = useMemo(() => {
        if (!showPagination || limit) {
            return limit ? filteredAndSortedItems.slice(0, limit) : filteredAndSortedItems;
        }

        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        return filteredAndSortedItems.slice(startIndex, endIndex);
    }, [filteredAndSortedItems, currentPage, pageSize, showPagination, limit]);

    const totalItems = filteredAndSortedItems.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    // 当过滤/排序/每页数量变更时，重置到第1页
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, sourceFilter, yearFilter, sortField, sortOrder, pageSize]);

    // 当总页数变化时，修正当前页在合法范围内
    useEffect(() => {
        setCurrentPage(prev => {
            const next = Math.min(Math.max(1, prev), totalPages);
            return next;
        });
    }, [totalPages]);

    // 页面跳转输入框与当前页同步
    useEffect(() => {
        setPageInput(String(currentPage));
    }, [currentPage]);

    // 事件处理
    const handleSort = useCallback((field: SortField) => {
        if (sortField === field) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('desc');
        }
    }, [sortField]);

    const handleSelectItem = useCallback((itemId: string) => {
        setSelectedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) {
                newSet.delete(itemId);
            } else {
                newSet.add(itemId);
            }
            return newSet;
        });
    }, []);

    // 仅切换“当前页全选”
    const currentPageIds = useMemo(() => paginatedItems.map(item => item.literature.paperId), [paginatedItems]);
    const numSelectedOnPage = useMemo(() => currentPageIds.filter(id => selectedItems.has(id)).length, [currentPageIds, selectedItems]);
    const isAllOnPageSelected = numSelectedOnPage === currentPageIds.length && currentPageIds.length > 0;
    const isAnyOnPageSelected = numSelectedOnPage > 0;

    const handleToggleSelectPage = useCallback(() => {
        setSelectedItems(prev => {
            const next = new Set(prev);
            if (isAllOnPageSelected) {
                for (const id of currentPageIds) next.delete(id);
            } else {
                for (const id of currentPageIds) next.add(id);
            }
            return next;
        });
    }, [currentPageIds, isAllOnPageSelected]);

    // 跨页“选择全部结果/取消全部选择”
    const isAllAcrossSelected = selectedItems.size > 0 && selectedItems.size === totalItems && totalItems > 0;
    const handleSelectAllAcrossResults = useCallback(() => {
        const allIds = filteredAndSortedItems.map(item => item.literature.paperId);
        setSelectedItems(new Set(allIds));
    }, [filteredAndSortedItems]);
    const handleClearAllSelection = useCallback(() => {
        setSelectedItems(new Set());
    }, []);

    // 过滤变化时清理无效的选中项（仅保留当前过滤后的ID）
    useEffect(() => {
        const valid = new Set(filteredAndSortedItems.map(i => i.literature.paperId));
        setSelectedItems(prev => {
            let changed = false;
            const next = new Set<string>();
            for (const id of prev) {
                if (valid.has(id)) next.add(id); else changed = true;
            }
            return changed ? next : prev;
        });
    }, [filteredAndSortedItems]);

    // 页码数据（含省略号）
    const paginationItems = useMemo(() => {
        const items: Array<number | 'ellipsis'> = [];
        const total = totalPages;
        const current = currentPage;
        if (total <= 7) {
            for (let i = 1; i <= total; i++) items.push(i);
            return items;
        }
        items.push(1);
        const showLeftDots = current > 3;
        const showRightDots = current < total - 2;
        const start = Math.max(2, current - 1);
        const end = Math.min(total - 1, current + 1);
        if (showLeftDots) items.push('ellipsis');
        for (let i = start; i <= end; i++) items.push(i);
        if (showRightDots) items.push('ellipsis');
        items.push(total);
        return items;
    }, [currentPage, totalPages]);

    const handlePageClick = useCallback((page: number) => {
        setCurrentPage(page);
    }, []);

    const handlePageJump = useCallback(() => {
        const n = Number(pageInput);
        if (!Number.isFinite(n)) return;
        const target = Math.min(Math.max(1, Math.trunc(n)), totalPages);
        setCurrentPage(target);
        setPageInput(String(target));
    }, [pageInput, totalPages]);

    const handlePageSizeChange = useCallback((value: string) => {
        const n = Number(value);
        if (Number.isFinite(n) && n > 0) {
            setPageSize(n);
        }
    }, []);

    const formatAuthors = (authors: string[]) => {
        if (!authors || authors.length === 0) return '';
        if (authors.length === 1) return authors[0];
        return `${authors[0]} 等`;
    };

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString('zh-CN');
    };

    const handleAdd = useCallback(async () => {
        const v = addInput.trim();
        if (!v) return;
        setAdding(true);
        setAddError(null);
        try {
            const created = await addByIdentifier(v, { autoExtractCitations: false });
            onAddNew?.(created.paperId);
            setAddInput('');
        } catch (e: any) {
            setAddError(e?.message || '添加失败');
        } finally {
            setAdding(false);
        }
    }, [addInput, addByIdentifier, onAddNew]);

    if (isLoading && !literatures.length) {
        return (
            <Card className={className}>
                {/* 控制栏骨架 */}
                {showControls && (
                    <CardHeader>
                        <div className="flex flex-col space-y-4">
                            <div className="flex flex-col sm:flex-row gap-4">
                                <Skeleton className="h-9 w-full sm:flex-1" />
                                <div className="flex gap-2">
                                    <Skeleton className="h-9 w-32" />
                                    <Skeleton className="h-9 w-32" />
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <Skeleton className="h-5 w-48" />
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-9 w-32" />
                                    <Skeleton className="h-9 w-10" />
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                )}

                {/* 列表骨架 */}
                <CardContent className="p-0 flex-1 min-h-0 overflow-y-auto">
                    {/* 全选条骨架 */}
                    {showControls && (
                        <div className="flex items-center gap-2 p-4 border-b">
                            <Skeleton className="h-4 w-4 rounded-sm" />
                            <Skeleton className="h-4 w-10" />
                        </div>
                    )}

                    {/* 行骨架 */}
                    <div className="divide-y">
                        {Array.from({ length: limit || 6 }).map((_, idx) => (
                            <div key={idx} className="p-4">
                                <div className="flex items-start gap-3">
                                    {showControls && <Skeleton className="h-4 w-4 rounded-sm" />}
                                    <div className="flex-1 min-w-0 space-y-2">
                                        <Skeleton className="h-5 w-3/4" />
                                        <div className="flex items-center gap-4">
                                            <Skeleton className="h-4 w-40" />
                                            <Skeleton className="h-4 w-16" />
                                        </div>
                                        <Skeleton className="h-4 w-full" />
                                        <div className="flex items-center justify-between pt-2">
                                            <div className="flex items-center gap-2">
                                                <Skeleton className="h-5 w-12" />
                                                <Skeleton className="h-4 w-24" />
                                            </div>
                                            <Skeleton className="h-8 w-8 rounded-md" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={className}>
            {/* 控制栏 */}
            {showControls && (
                <CardHeader>
                    <div className="flex flex-col space-y-4">
                        {/* 搜索和筛选 */}
                        <div className="flex flex-col sm:flex-row gap-4">
                            {/* 搜索框 */}
                            <SearchInput
                                className="flex-1"
                                placeholder="搜索文献标题、作者、摘要..."
                                value={searchQuery}
                                onChange={(v: string) => setSearchQuery(v)}
                                onClear={() => setSearchQuery("")}
                                isLoading={isLoading}
                            />

                            {/* 筛选器 */}
                            <div className="flex gap-2">
                                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                                    <SelectTrigger className="w-18">
                                        <SelectValue placeholder="来源" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">来源</SelectItem>
                                        <SelectItem value="manual">手动</SelectItem>
                                        <SelectItem value="zotero">Zotero</SelectItem>
                                        <SelectItem value="import">导入</SelectItem>
                                        <SelectItem value="search">搜索</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Select value={yearFilter} onValueChange={setYearFilter}>
                                    <SelectTrigger className="w-18">
                                        <SelectValue placeholder="年份" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">年份</SelectItem>
                                        <SelectItem value="recent">近5年</SelectItem>
                                        <SelectItem value="2020-2024">2020-2024</SelectItem>
                                        <SelectItem value="2015-2019">2015-2019</SelectItem>
                                        <SelectItem value="2010-2014">2010-2014</SelectItem>
                                        <SelectItem value="old">2010年前</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select value={sortField} onValueChange={(value) => setSortField(value as SortField)}>
                                    <SelectTrigger className="w-25">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="title">标题</SelectItem>
                                        <SelectItem value="authors">作者</SelectItem>
                                        <SelectItem value="year">年份</SelectItem>
                                        <SelectItem value="createdAt">添加时间</SelectItem>
                                        <SelectItem value="updatedAt">更新时间</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                                >
                                    {sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>

                        {/* 操作栏 */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                {/* 结果统计 */}
                                <div className="text-sm text-muted-foreground">
                                    显示 {paginatedItems.length} / {filteredAndSortedItems.length} 条结果
                                    {selectedItems.size > 0 && (
                                        <Badge variant="secondary" className="ml-2">
                                            已选择 {selectedItems.size} 项
                                        </Badge>
                                    )}
                                </div>

                                {/* 批量操作 */}
                                {selectedItems.size > 0 && (
                                    <div className="flex items-center gap-2 w-32">
                                        {/* <Button variant="outline" size="sm">
                                            <Edit className="h-4 w-4 mr-1" />
                                            批量编辑
                                        </Button> */}
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            className="text-red-600"
                                            onClick={async () => {
                                                const ids = Array.from(selectedItems);
                                                if (ids.length === 0) return;
                                                try {
                                                    if (onBulkDelete) {
                                                        // 交给上层根据上下文处理（可能弹出确认对话框或仅移出集合）
                                                        void onBulkDelete(ids);
                                                    } else {
                                                        await batchDeleteLiteratures(ids);
                                                        setSelectedItems(new Set());
                                                    }
                                                } catch (e) {
                                                    console.warn('[LiteratureListPanel] Batch delete failed', e);
                                                }
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4 mr-1" />
                                            删除
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* 右侧：新增与排序 */}
                            <div className="flex items-center gap-2">
                                {/* 添加入口在列表工具栏右上角 */}
                                <div className="hidden md:flex items-center gap-2 mr-2">
                                    <Input
                                        placeholder="输入DOI/URL/S2Id添加"
                                        className="w-49"
                                        value={addInput}
                                        onChange={(e) => setAddInput(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
                                        disabled={adding}
                                    />
                                    <Button size="sm" onClick={handleAdd} disabled={adding || !addInput.trim()}>
                                        新建
                                    </Button>
                                </div>

                            </div>
                        </div>
                        {addError && (
                            <div className="text-xs text-red-600">添加错误：{addError}</div>
                        )}
                    </div>
                </CardHeader>
            )}

            <CardContent className="p-0 flex-1 min-h-0 overflow-y-auto">
                {paginatedItems.length > 0 ? (
                    <>
                        {/* 全选控制 */}
                        {showControls && (
                            <div className="flex items-center justify-between p-4 border-b">
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        checked={isAllOnPageSelected}
                                        onCheckedChange={handleToggleSelectPage}
                                    />
                                    <span className="text-sm text-muted-foreground">
                                        全选本页
                                        {currentPageIds.length > 0 && `（${numSelectedOnPage}/${currentPageIds.length}）`}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {!isAllAcrossSelected && isAllOnPageSelected && totalItems > currentPageIds.length && (
                                        <Button variant="link" size="sm" onClick={handleSelectAllAcrossResults}>
                                            选择全部 {totalItems} 条
                                        </Button>
                                    )}
                                    {selectedItems.size > 0 && (
                                        <Button variant="link" size="sm" onClick={handleClearAllSelection}>
                                            清除选择
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* 文献列表 */}
                        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4' : 'divide-y'}>
                            {paginatedItems.map((item) => (
                                <div
                                    key={item.literature.paperId}
                                    className={`${viewMode === 'list' ? 'p-4 hover:bg-gray-50' : 'border rounded-lg p-4 hover:shadow-md'} transition-all cursor-pointer`}
                                    onClick={() => onItemClick?.(item)}
                                    draggable
                                    onDragStart={(e) => {
                                        const ids = [item.literature.paperId];
                                        // 如果有多选且包含当前项，则打包所有已选 ID
                                        if (selectedItems.size > 0 && selectedItems.has(item.literature.paperId)) {
                                            e.dataTransfer.setData('application/x-paper-ids', JSON.stringify(Array.from(selectedItems)));
                                        } else {
                                            e.dataTransfer.setData('application/x-paper-ids', JSON.stringify(ids));
                                        }
                                        e.dataTransfer.effectAllowed = 'copy';
                                    }}
                                >
                                    <div className="flex items-start gap-3">
                                        {showControls && (
                                            <Checkbox
                                                checked={selectedItems.has(item.literature.paperId)}
                                                onCheckedChange={() => handleSelectItem(item.literature.paperId)}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        )}

                                        <div className="flex-1 min-w-0 space-y-1">
                                            {/* 标题 */}
                                            <h3 className="font-semibold text-base leading-tight line-clamp-2 hover:text-blue-600">
                                                {item.literature.title}
                                            </h3>

                                            {/* 作者、年份与来源 */}
                                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                <div className="flex items-center gap-1 min-w-0">
                                                    <User className="h-3 w-3" />
                                                    <span className="truncate">{formatAuthors(item.literature.authors)}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center gap-1">
                                                        <Calendar className="h-3 w-3" />
                                                        <span>{item.literature.year}</span>
                                                    </div>
                                                    <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                                                        {item.literature.source === 'manual' && '手动'}
                                                        {item.literature.source === 'zotero' && 'Zotero'}
                                                        {item.literature.source === 'import' && '导入'}
                                                        {item.literature.source === 'search' && '搜索'}
                                                    </Badge>
                                                </div>

                                                { /* 操作菜单靠右显示 */}
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={(e) => {
                                                            e.stopPropagation();
                                                            onItemClick?.(item);
                                                        }}>
                                                            <Eye className="h-4 w-4 mr-2" />
                                                            查看详情
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={(e) => {
                                                            e.stopPropagation();
                                                            onItemEdit?.(item);
                                                        }}>
                                                            <Edit className="h-4 w-4 mr-2" />
                                                            编辑
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (onItemDelete) {
                                                                    onItemDelete(item);
                                                                } else {
                                                                    // 内置删除回退：直接删除本条
                                                                    deleteLiterature(item.literature.paperId).catch(err => {
                                                                        console.warn('[LiteratureListPanel] Inline delete failed', err);
                                                                    });
                                                                }
                                                            }}
                                                            className="text-red-600"
                                                        >
                                                            <Trash2 className="h-4 w-4 mr-2" />
                                                            删除
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>



                                            {/* 摘要隐藏于列表预览 */}

                                            {/* 底部信息 */}
                                            {/* <div className="flex items-center justify-between pt-2">
                                                <div /> */}

                                            {/* 操作菜单 */}

                                            {/* </div> */}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* 分页控制 */}
                        {showPagination && (
                            <div className="flex flex-col gap-3 p-4 border-t">
                                <div className="flex items-center justify-between">
                                    <div className="text-sm text-muted-foreground">
                                        第 {currentPage} / {totalPages} 页，合计 {totalItems} 条
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground">每页</span>
                                        <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                                            <SelectTrigger className="w-18">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="6">6</SelectItem>
                                                <SelectItem value="8">8</SelectItem>
                                                <SelectItem value="14">14</SelectItem>
                                                <SelectItem value="18">18</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1 flex-wrap">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                                disabled={currentPage === 1}
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                            </Button>
                                            {paginationItems.map((p, idx) => (
                                                p === 'ellipsis' ? (
                                                    <Button key={`e-${idx}`} variant="ghost" size="sm" disabled>…</Button>
                                                ) : (
                                                    <Button
                                                        key={p}
                                                        variant={p === currentPage ? 'default' : 'outline'}
                                                        size="sm"
                                                        onClick={() => handlePageClick(p)}
                                                    >
                                                        {p}
                                                    </Button>
                                                )
                                            ))}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                                disabled={currentPage === totalPages}
                                            >
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-muted-foreground">跳转</span>
                                            <Input
                                                className="w-16 h-8"
                                                value={pageInput}
                                                onChange={(e) => setPageInput(e.target.value.replace(/\D+/g, ''))}
                                                onKeyDown={(e) => { if (e.key === 'Enter') handlePageJump(); }}
                                            />
                                            <Button size="sm" variant="outline" onClick={handlePageJump}>确定</Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex items-center justify-center h-48">
                        <div className="text-center">
                            <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                            <h3 className="font-semibold text-lg text-muted-foreground mb-2">
                                {searchQuery ? '未找到匹配的文献' : '暂无文献数据'}
                            </h3>
                            <p className="text-muted-foreground">
                                {searchQuery ? '尝试调整搜索条件或筛选器' : '开始添加你的第一篇研究文献'}
                            </p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

