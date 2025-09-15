"use client";

import React, { useState, useCallback, useMemo } from 'react';
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
    onAddNew?: (paperId: string) => void;
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
    onAddNew
}: LiteratureListPanelProps) {
    // 状态管理
    const [searchQuery, setSearchQuery] = useState('');
    const [sortField, setSortField] = useState<SortField>('createdAt');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(limit || 10);
    const [sourceFilter, setSourceFilter] = useState<string>('all');
    const [yearFilter, setYearFilter] = useState<string>('all');

    // 数据hooks - 只在没有外部数据时使用
    const hookResult = useLiteratureOperations();
    const { addByIdentifier } = useLiteratureCommands();
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

    // 分页逻辑
    const paginatedItems = useMemo(() => {
        if (!showPagination || limit) {
            return limit ? filteredAndSortedItems.slice(0, limit) : filteredAndSortedItems;
        }

        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        return filteredAndSortedItems.slice(startIndex, endIndex);
    }, [filteredAndSortedItems, currentPage, pageSize, showPagination, limit]);

    const totalPages = Math.ceil(filteredAndSortedItems.length / pageSize);

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

    const handleSelectAll = useCallback(() => {
        if (selectedItems.size === paginatedItems.length) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(paginatedItems.map(item => item.literature.paperId)));
        }
    }, [selectedItems.size, paginatedItems]);

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
                <CardContent className="p-0">
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
                                    <SelectTrigger className="w-25">
                                        <SelectValue placeholder="来源" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">所有来源</SelectItem>
                                        <SelectItem value="manual">手动添加</SelectItem>
                                        <SelectItem value="zotero">Zotero</SelectItem>
                                        <SelectItem value="import">批量导入</SelectItem>
                                        <SelectItem value="search">搜索添加</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Select value={yearFilter} onValueChange={setYearFilter}>
                                    <SelectTrigger className="w-25">
                                        <SelectValue placeholder="年份" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">所有年份</SelectItem>
                                        <SelectItem value="recent">近5年</SelectItem>
                                        <SelectItem value="2020-2024">2020-2024</SelectItem>
                                        <SelectItem value="2015-2019">2015-2019</SelectItem>
                                        <SelectItem value="2010-2014">2010-2014</SelectItem>
                                        <SelectItem value="old">2010年前</SelectItem>
                                    </SelectContent>
                                </Select>
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
                                        <Button variant="destructive" size="sm" className="text-red-600">
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
                        {addError && (
                            <div className="text-xs text-red-600">添加错误：{addError}</div>
                        )}
                    </div>
                </CardHeader>
            )}

            <CardContent className="p-0">
                {paginatedItems.length > 0 ? (
                    <>
                        {/* 全选控制 */}
                        {showControls && (
                            <div className="flex items-center gap-2 p-4 border-b">
                                <Checkbox
                                    checked={selectedItems.size === paginatedItems.length && paginatedItems.length > 0}
                                    onCheckedChange={handleSelectAll}
                                />
                                <span className="text-sm text-muted-foreground">全选</span>
                            </div>
                        )}

                        {/* 文献列表 */}
                        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4' : 'divide-y'}>
                            {paginatedItems.map((item) => (
                                <div
                                    key={item.literature.paperId}
                                    className={`${viewMode === 'list' ? 'p-4 hover:bg-gray-50' : 'border rounded-lg p-4 hover:shadow-md'} transition-all cursor-pointer`}
                                    onClick={() => onItemClick?.(item)}
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
                                                                onItemDelete?.(item);
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
                        {showPagination && totalPages > 1 && (
                            <div className="flex items-center justify-between p-4 border-t">
                                <div className="text-sm text-muted-foreground">
                                    第 {currentPage} 页，共 {totalPages} 页
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        disabled={currentPage === 1}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                        上一页
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                        disabled={currentPage === totalPages}
                                    >
                                        下一页
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
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

