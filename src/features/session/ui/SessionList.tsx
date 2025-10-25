'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Input, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui';
import { useSessionStore } from '../data-access/session-store';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';
import { commandBus } from '@/features/session/runtime/command-bus';
import { AnimatePresence, motion } from 'framer-motion';
import { literatureDataAccess, useCollectionStore } from '@/features/literature/data-access';
import { useGraphStore } from '@/features/graph/data-access/graph-store';

function SortableItem({ id, children }: { id: string; children: React.ReactNode }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition
    } as React.CSSProperties;
    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            {children}
        </div>
    );
}

export function SessionList() {
    const router = useRouter();
    const pathname = usePathname();
    // 使用 store 级 memoized 派生，选择稳定 getter 引用
    const getSessions = useSessionStore(s => s.getSessions);
    const sessions = getSessions();
    const setSessionsOrder = useSessionStore(s => s.setSessionsOrder);
    const removeSession = useSessionStore(s => s.removeSession);

    const [items, setItems] = React.useState<string[]>(sessions.map(s => s.id));
    const [editingId, setEditingId] = React.useState<string | null>(null);
    const [titleDraft, setTitleDraft] = React.useState('');
    const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

    // ✅ 优化：只在 sessions 引用变化时更新（缓存机制确保引用稳定）
    React.useEffect(() => { setItems(sessions.map(s => s.id)); }, [sessions]);

    const handleDragEnd = async (event: any) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        const next = arrayMove(items, oldIndex, newIndex);
        setItems(next);
        try { console.debug('[ui][session_list][drag_end]', { active: String(active?.id), over: String(over?.id), oldIndex, newIndex }); } catch { /* noop */ }
        await setSessionsOrder(next); // optimistic + persist
    };

    const openDeleteDialog = (sessionId: string) => {
        try { console.debug('[ui][session_list][open_delete]', { sessionId }); } catch { /* noop */ }
        setDeleteTargetId(sessionId);
    };

    const handleDelete = async (mode: 'session' | 'session_collection' | 'all') => {
        const sessionId = deleteTargetId!;
        const isActive = pathname === `/research/${sessionId}`;
        const s = sessions.find(ss => ss.id === sessionId);
        const collectionId = s?.linkedCollectionId;
        const graphId = (s?.meta as any)?.graphId as string | undefined;
        try { console.debug('[ui][session_list][confirm_delete]', { sessionId, mode, isActive, collectionId, graphId }); } catch { /* noop */ }

        // 1) Remove session (UI + Dexie)
        await removeSession(sessionId);

        // 2) Optionally remove collection
        if ((mode === 'session_collection' || mode === 'all') && collectionId) {
            try {
                await literatureDataAccess.collections.deleteCollection(collectionId);
            } catch { /* ignore */ }
            try { (useCollectionStore as any).getState().removeCollection(collectionId); } catch { /* ignore */ }
        }

        // 3) Optionally remove graph
        if (mode === 'all' && graphId) {
            try { await (useGraphStore as any).getState().deleteGraph(graphId); } catch { /* ignore */ }
        }

        // 4) Redirect if current
        if (isActive) router.push('/research');

        setDeleteTargetId(null);
    };

    const createSession = async () => {
        const id = crypto.randomUUID();
        try { console.debug('[ui][session_list][create_session_click]', { id }); } catch { /* noop */ }
        await commandBus.dispatch({ id: crypto.randomUUID(), type: 'CreateSession', ts: Date.now(), sessionId: id, params: { title: '未命名研究' } } as any);
        router.push(`/research/${id}`);
    };

    return (
        <>
            <div className="space-y-2">
                <div className="px-1 flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">会话</div>
                    <Button size="sm" variant="secondary" onClick={createSession}><Plus className="w-3 h-3 mr-1" /> 新建</Button>
                </div>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis]}>
                    <SortableContext items={items} strategy={verticalListSortingStrategy}>
                        <AnimatePresence initial={false}>
                            {items.map((id) => {
                                const s = sessions.find(ss => ss.id === id);
                                if (!s) return null;
                                const isActive = pathname === `/research/${s.id}`;
                                return (
                                    <SortableItem id={s.id} key={s.id}>
                                        <motion.div
                                            layout="position"
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -8 }}
                                            transition={{ type: 'spring', stiffness: 500, damping: 35, mass: 0.3 }}
                                            className={cn(
                                                'group flex items-center gap-2 rounded-md px-2 py-1 transition-colors',
                                                isActive ? 'ring-1 ring-inset ring-primary/25' : 'hover:bg-accent/60'
                                            )}
                                            style={isActive ? {
                                                backgroundColor: 'color-mix(in srgb, var(--color-primary) 12%, var(--color-background-primary) 88%)'
                                            } : undefined}
                                        >
                                            <Link
                                                href={`/research/${s.id}`}
                                                aria-current={isActive ? 'page' : undefined}
                                                className={cn('flex-1 block text-sm px-1 py-1 rounded-md truncate')}
                                                title={s.title || '未命名研究'}
                                            >
                                                {editingId === s.id ? (
                                                    <Input autoFocus value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} onBlur={async () => { const nextTitle = titleDraft.trim(); if (nextTitle && nextTitle !== (s.title || '')) { await commandBus.dispatch({ id: crypto.randomUUID(), type: 'RenameSession', ts: Date.now(), params: { sessionId: s.id, title: nextTitle } } as any); } setEditingId(null); }} />
                                                ) : (
                                                    <div className="flex items-center justify-between">
                                                        <span className="truncate">{s.title || '未命名研究'}</span>
                                                        <span className="ml-2 text-[10px] text-muted-foreground">{formatTimeAgo(s.updatedAt)}</span>
                                                    </div>
                                                )}
                                            </Link>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 px-2">···</button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => { setEditingId(s.id); setTitleDraft(s.title || ''); }}>重命名</DropdownMenuItem>
                                                    <DropdownMenuItem className="text-red-600" onClick={() => openDeleteDialog(s.id)}>删除</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </motion.div>
                                    </SortableItem>
                                );
                            })}
                        </AnimatePresence>
                    </SortableContext>
                </DndContext>
            </div>
            <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>删除会话</AlertDialogTitle>
                        <AlertDialogDescription>
                            请选择删除范围。此操作不可撤销。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-2 text-sm">
                        <div className="text-muted-foreground">可选项：</div>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>仅删除会话（不影响已绑定的集合与图谱）</li>
                            <li>删除会话 + 关联集合</li>
                            <li>删除会话 + 关联集合 + 图谱</li>
                        </ul>
                    </div>
                    <AlertDialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void handleDelete('session')}>仅删会话</AlertDialogAction>
                        <AlertDialogAction onClick={() => void handleDelete('session_collection')}>会话+集合</AlertDialogAction>
                        <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={() => void handleDelete('all')}>全部删除</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

function formatTimeAgo(ts: number): string {
    const diff = Date.now() - ts;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} 小时前`;
    const days = Math.floor(hours / 24);
    return `${days} 天前`;
}

export default SessionList;


