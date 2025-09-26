"use client";

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Folder, FolderOpen, Plus, Trash2, BookOpen, Inbox, Tag, Timer } from "lucide-react";
import { useCollectionOperations } from '@/features/literature/hooks';
import type { Collection } from '@/features/literature/data-access/models';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSessionStore } from '@/features/session/data-access/session-store';
import { Input } from '@/components/ui/input';
import { ZoteroQuickPanel } from '@/features/dataset/components/ZoteroQuickPanel';

interface CollectionTreePanelProps {
    className?: string;
    onSelectCollection?: (collectionId: string | null) => void;
}

export const CollectionTreePanel: React.FC<CollectionTreePanelProps> = ({ className, onSelectCollection }) => {
    const {
        collections,
        uiState,
        stats,
        loadCollections,
        selectCollection,
        clearSelection,
        toggleExpansion,
        deleteCollection,
        createCollection,
        updateCollection,
        getCollection,
        addLiteraturesToCollection,
    } = useCollectionOperations();

    const [activeVirtual, setActiveVirtual] = useState<null | 'all' | 'unfiled'>(null);
    const [contextOpenId, setContextOpenId] = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);

    // 创建/重命名对话框
    const [editOpen, setEditOpen] = useState(false);
    const [editMode, setEditMode] = useState<'create' | 'rename'>('create');
    const [editName, setEditName] = useState('');
    const [editParentId, setEditParentId] = useState<string | null>(null);
    const [editTargetId, setEditTargetId] = useState<string | null>(null);
    const [editType, setEditType] = useState<Collection['type']>('general' as any);
    const [submitting, setSubmitting] = useState(false);
    // session index -> collectionId: sessionTitle
    const sessionTitleByCollectionId = useMemo(() => {
        try {
            const sessions = Array.from(useSessionStore.getState().sessions.values());
            const map = new Map<string, string>();
            for (const s of sessions) {
                const cid = (s as any)?.linkedCollectionId as string | undefined;
                if (cid) {
                    const title = (s as any)?.title || '未命名会话';
                    if (!map.has(cid)) map.set(cid, title);
                }
            }
            return map;
        } catch {
            return new Map<string, string>();
        }
    }, [useSessionStore]);

    useEffect(() => {
        // 初次加载用户集合
        loadCollections({ force: false }).catch(() => { });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const byParent: Record<string | 'root', Collection[]> = useMemo(() => {
        const map: Record<string | 'root', Collection[]> = { root: [] } as any;
        for (const c of collections) {
            const key = (c.parentId || 'root') as any;
            if (!map[key]) map[key] = [];
            map[key].push(c);
        }
        // 简单排序：最近更新在前，次序按名称
        const sortFn = (a: Collection, b: Collection) => {
            const at = (a.updatedAt ? new Date(a.updatedAt).getTime() : 0);
            const bt = (b.updatedAt ? new Date(b.updatedAt).getTime() : 0);
            if (at !== bt) return bt - at;
            return a.name.localeCompare(b.name);
        };
        Object.keys(map).forEach(k => map[k as any].sort(sortFn));
        return map;
    }, [collections]);

    const selectedCollectionId = useMemo(() => {
        const ids = Array.from(uiState.selectedIds);
        return ids.length > 0 ? ids[0] : undefined;
    }, [uiState.selectedIds]);

    const handleSelect = (id: string) => {
        setActiveVirtual(null);
        clearSelection();
        selectCollection(id);
        onSelectCollection?.(id);
    };

    const openCreateDialog = (options: { parentId?: string | null; type?: Collection['type'] } = {}) => {
        const { parentId = null, type = 'general' as any } = options;
        setEditMode('create');
        setEditName('');
        setEditParentId(parentId);
        setEditTargetId(null);
        setEditType(type as any);
        setEditOpen(true);
    };

    const openRenameDialog = (targetId: string, currentName: string) => {
        setEditMode('rename');
        setEditName(currentName);
        setEditParentId(null);
        setEditTargetId(targetId);
        setEditOpen(true);
    };

    const handleSubmitEdit = async () => {
        const name = editName.trim();
        if (!name) return;
        setSubmitting(true);
        try {
            if (editMode === 'create') {
                const created = await createCollection({
                    name,
                    description: '',
                    type: editType as any,
                    ownerUid: '' as any,
                    isPublic: false,
                    parentId: editParentId as any,
                } as any);
                handleSelect(created.id);
            } else if (editMode === 'rename' && editTargetId) {
                await updateCollection(editTargetId, { name } as any);
            }
            setEditOpen(false);
        } catch { }
        finally { setSubmitting(false); }
    };

    const renderNode = (c: Collection, depth: number) => {
        const expanded = uiState.expandedIds.has(c.id);
        const hasChildren = (byParent[c.id]?.length || 0) > 0;
        const isSelected = uiState.selectedIds.has(c.id);
        return (
            <DropdownMenu key={c.id} open={contextOpenId === c.id} onOpenChange={(open) => { if (!open && contextOpenId === c.id) setContextOpenId(null); }}>
                <DropdownMenuTrigger asChild>
                    <div
                        className="select-none"
                        onContextMenu={(e) => { e.preventDefault(); setContextOpenId(c.id); }}
                    >
                        <div className={cn(
                            'flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer hover:bg-muted transition-colors',
                            isSelected && 'bg-primary/10 border-l-2 border-primary',
                            dragOverId === c.id && 'bg-primary/10 ring-1 ring-primary/30'
                        )}
                            onDragOver={(e) => {
                                if (Array.from(e.dataTransfer.types).includes('application/x-paper-ids')) {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = 'copy';
                                    setDragOverId(c.id);
                                }
                            }}
                            onDragLeave={() => { if (dragOverId === c.id) setDragOverId(null); }}
                            onDrop={(e) => {
                                const raw = e.dataTransfer.getData('application/x-paper-ids');
                                if (!raw) return;
                                try {
                                    const ids = JSON.parse(raw) as string[];
                                    if (Array.isArray(ids) && ids.length > 0) {
                                        addLiteraturesToCollection(c.id, ids).catch(() => { });
                                    }
                                } catch { }
                                setDragOverId(null);
                            }}
                        >
                            <button
                                type="button"
                                className="h-5 w-5 flex items-center justify-center"
                                onClick={(e) => { e.stopPropagation(); if (hasChildren) toggleExpansion(c.id); }}
                                aria-label={expanded ? 'collapse' : 'expand'}
                            >
                                {hasChildren ? (expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : <span className="inline-block w-4" />}
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSelect(c.id)}
                                className="flex items-center gap-2 flex-1 text-left"
                                style={{ marginLeft: Math.max(0, depth - 1) * 14 }}
                            >
                                {expanded ? <FolderOpen className="h-4 w-4 text-blue-600" /> : <Folder className="h-4 w-4 text-blue-600" />}
                                {sessionTitleByCollectionId.has(c.id) ? (
                                    <span className="truncate max-w-[12rem]">{sessionTitleByCollectionId.get(c.id)}</span>
                                ) : (
                                    <span className="truncate max-w-[12rem]">{c.name}</span>
                                )}
                                <span className="text-xs text-muted-foreground">{c.itemCount ?? c.paperIds.length}</span>
                            </button>
                            <button
                                type="button"
                                className="h-7 w-7 grid place-items-center rounded-md hover:bg-red-50"
                                onClick={(e) => { e.stopPropagation(); deleteCollection(c.id).catch(() => { }); }}
                                aria-label="delete"
                            >
                                <Trash2 className="h-4 w-4 text-red-600" />
                            </button>
                        </div>
                        {expanded && hasChildren && (
                            <div className="mt-1">
                                {byParent[c.id].map(child => renderNode(child, depth + 1))}
                            </div>
                        )}
                    </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="right">
                    <DropdownMenuItem onClick={() => { setContextOpenId(null); openCreateDialog({ parentId: c.id, type: c.type }); }}>
                        新建子集合
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setContextOpenId(null); openRenameDialog(c.id, c.name); }}>
                        重命名
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => { setContextOpenId(null); deleteCollection(c.id).catch(() => { }); }}>
                        删除
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        );
    };

    return (
        <>
            <Card className={className}>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center justify-between">
                        <span>我的集合</span>
                        {/* <Button size="sm" variant="outline" onClick={() => openCreateDialog({})}>
                            <Plus className="h-4 w-4 mr-1" /> 新建
                        </Button> */}
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 pl-0">
                    <div className="text-xs text-muted-foreground mb-2 pl-6">共 {stats.total} 个集合</div>
                    <div className="max-h-[28rem] overflow-auto pr-1">
                        {/* 虚拟根：全部文献 */}
                        <div
                            className={cn(
                                'flex items-center gap-2 px-2 py-0.5 rounded-md cursor-pointer hover:bg-muted',
                                activeVirtual === 'all' && 'bg-muted'
                            )}
                            onClick={() => { setActiveVirtual('all'); clearSelection(); onSelectCollection?.(null); }}
                        >
                            <span className="inline-block w-4" />
                            <BookOpen className="h-4 w-4 text-blue-600" />
                            <span className="flex-1">All Items</span>
                            {/* 右侧占位，保证与包含删除按钮的行右侧对齐 */}
                            <span className="inline-block w-7" />
                        </div>

                        {/* 虚拟根：未归档（未分配到任何集合） */}
                        <div
                            className={cn(
                                'mt-1 flex items-center gap-2 px-2 py-0.5 rounded-md cursor-pointer hover:bg-muted',
                                activeVirtual === 'unfiled' && 'bg-muted'
                            )}
                            onClick={() => { setActiveVirtual('unfiled'); clearSelection(); onSelectCollection?.('__UNFILED__'); }}
                        >
                            <span className="inline-block w-4" />
                            <Inbox className="h-4 w-4 text-amber-600" />
                            <span className="flex-1">Unfiled</span>
                            <span className="inline-block w-7" />
                        </div>

                        {/* 分组：会话（temporary） */}
                        {(() => {
                            const root = byParent['root'] || [];
                            const sessionRoots = root.filter(c => c.type === 'temporary');
                            const expanded = uiState.expandedIds.has('virtual:session');
                            return (
                                <div className="mt-0.5">
                                    <div
                                        className="flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer hover:bg-muted select-none"
                                        onClick={() => toggleExpansion('virtual:session')}
                                    >
                                        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                        <Timer className="h-4 w-4 text-emerald-600" />
                                        <span className="flex-1">Session</span>
                                        <span className="text-xs text-muted-foreground">{sessionRoots.length}</span>
                                    </div>
                                    {expanded && (
                                        <div className="mt-0.5">
                                            {sessionRoots.map(c => renderNode(c, 1))}
                                            {sessionRoots.length === 0 && (
                                                <div className="text-xs text-muted-foreground pl-8 py-1">暂无会话集合</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {/* 分组：主题（topic） */}
                        {(() => {
                            const root = byParent['root'] || [];
                            const topicRoots = root.filter(c => c.type === 'topic');
                            const expanded = uiState.expandedIds.has('virtual:topic');
                            return (
                                <div className="mt-0.5">
                                    <div
                                        className="flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer hover:bg-muted select-none"
                                        onClick={() => toggleExpansion('virtual:topic')}
                                    >
                                        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                        <Tag className="h-4 w-4 text-purple-600" />
                                        <span className="flex-1">Topic</span>
                                        <span className="text-xs text-muted-foreground">{topicRoots.length}</span>
                                    </div>
                                    {expanded && (
                                        <div className="mt-0.5">
                                            {topicRoots.map(c => renderNode(c, 1))}
                                            {topicRoots.length === 0 && (
                                                <div className="text-xs text-muted-foreground pl-8 py-1">暂无主题集合</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {/* 分组：其他（general / project / smart） */}
                        {(() => {
                            const root = byParent['root'] || [];
                            const others = root.filter(c => c.type !== 'temporary' && c.type !== 'topic');
                            const expanded = uiState.expandedIds.has('virtual:collections');
                            return (
                                <div className="mt-0.5">
                                    <div
                                        className="flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer hover:bg-muted select-none"
                                        onClick={() => toggleExpansion('virtual:collections')}
                                    >
                                        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                        <Folder className="h-4 w-4 text-blue-600" />
                                        <span className="flex-1">Collections</span>
                                        <span className="text-xs text-muted-foreground">{others.length}</span>
                                        <Button size="sm" variant="ghost" className="h-5 px-1" onClick={(e) => { e.stopPropagation(); openCreateDialog({}); }}>
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    {expanded && (
                                        <div className="mt-0">
                                            {others.map(c => renderNode(c, 1))}
                                            {others.length === 0 && (
                                                <div className="text-xs text-muted-foreground pl-8 py-1">暂无集合</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {(!byParent['root'] || byParent['root'].length === 0) && (
                            <div className="text-sm text-muted-foreground py-8 text-center">暂无集合，点击上方“新建”创建</div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Zotero 快捷面板：置于我的集合卡片下方 */}
            <div className="mt-4">
                <ZoteroQuickPanel currentCollectionId={selectedCollectionId} className={"theme-background-primary"} />
            </div>

            {/* 创建/重命名对话框 */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editMode === 'create' ? '新建集合' : '重命名集合'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <Input
                            placeholder="请输入集合名称"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitEdit(); }}
                            autoFocus
                        />
                        <div className="flex items-center justify-end gap-2">
                            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={submitting}>取消</Button>
                            <Button onClick={handleSubmitEdit} disabled={submitting || !editName.trim()}>{submitting ? '提交中...' : '确定'}</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default CollectionTreePanel;


