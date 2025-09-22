"use client";

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useLiteratureOperations } from '../../hooks/use-literature-operations';
import { useLiteratureCommands } from '../../hooks/use-literature-commands';
import type { EnhancedLibraryItem, UpdateUserLiteratureMetaInput } from '../../data-access/models';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Info, ListTree, Plus, Loader2 } from 'lucide-react';

interface LiteratureDetailPanelProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    paperId?: string;
    item?: EnhancedLibraryItem;
    onUpdated?: (updated: boolean) => void;
    variant?: 'modal' | 'side' | 'overlay';
    /** 默认添加到的集合ID（从页面/上下文传入） */
    defaultCollectionId?: string;
}

const READING_STATUS_OPTIONS: Array<{ value: UpdateUserLiteratureMetaInput['readingStatus']; label: string }> = [
    { value: 'unread', label: '未读' },
    { value: 'reading', label: '阅读中' },
    { value: 'completed', label: '已完成' },
    { value: 'referenced', label: '仅参考' },
    { value: 'abandoned', label: '已放弃' },
];

export function LiteratureDetailPanel({ open, onOpenChange, paperId, item, onUpdated, variant = 'modal', defaultCollectionId }: LiteratureDetailPanelProps) {
    const { getLiterature } = useLiteratureOperations();
    const { updateUserMeta, addByIdentifier } = useLiteratureCommands();

    const currentItem = useMemo(() => {
        if (item) return item;
        if (paperId) return getLiterature(paperId) as EnhancedLibraryItem | undefined;
        return undefined;
    }, [item, paperId, getLiterature]);

    const [tagsInput, setTagsInput] = useState('');
    const [readingStatus, setReadingStatus] = useState<UpdateUserLiteratureMetaInput['readingStatus']>('unread');
    const [rating, setRating] = useState<number | undefined>(undefined);
    const [personalNotes, setPersonalNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [addingIds, setAddingIds] = useState<Set<string>>(new Set());

    // 初始化/同步表单数据
    useEffect(() => {
        if (!currentItem) return;
        const meta = currentItem.userMeta || {} as any;
        setTagsInput((meta.tags || []).join(', '));
        setReadingStatus(meta.readingStatus || 'unread');
        setRating(meta.rating);
        setPersonalNotes(meta.personalNotes || '');
        setError(null);
    }, [currentItem?.literature.paperId]);

    const handleSave = useCallback(async () => {
        if (!currentItem) return;
        setIsSaving(true);
        setError(null);
        try {
            const parsedTags = tagsInput
                .split(',')
                .map(t => t.trim())
                .filter(Boolean);

            const payload: UpdateUserLiteratureMetaInput = {
                tags: parsedTags,
                readingStatus,
                personalNotes: personalNotes?.trim() || undefined,
            };
            if (typeof rating === 'number') payload.rating = rating;

            const ok = await updateUserMeta(currentItem.literature.paperId, payload);
            if (ok) {
                onUpdated?.(true);
                onOpenChange(false);
            } else {
                setError('保存失败');
            }
        } catch (e: any) {
            setError(e?.message || '保存时发生错误');
        } finally {
            setIsSaving(false);
        }
    }, [currentItem, tagsInput, readingStatus, rating, personalNotes, updateUserMeta, onUpdated, onOpenChange]);

    const references = useMemo(() => {
        const pc = (currentItem?.literature.parsedContent as any) || {};
        const details = pc.referenceDetails as any[] | undefined;
        if (Array.isArray(details) && details.length > 0) {
            return details
                .map((d: any) => ({
                    paperId: d.paperId,
                    title: d.title ?? null,
                    venue: d.venue ?? null,
                    year: d.year,
                    citationCount: d.citationCount,
                    authors: Array.isArray(d.authors) ? d.authors : undefined
                }))
                .filter((d: any) => typeof d.paperId === 'string') as Array<{
                    paperId: string;
                    title?: string | null;
                    venue?: string | null;
                    year?: number;
                    citationCount?: number;
                    authors?: Array<{ authorId?: string; name: string }>;
                }>;
        }
        const arr = pc.extractedReferences as any[] | undefined;
        if (!Array.isArray(arr)) return [] as any[];
        return arr
            .filter((r: any) => typeof r === 'string')
            .map((rid: string) => ({ paperId: rid })) as any[];
    }, [currentItem?.literature.parsedContent]);

    const resolveTitle = useCallback((refId: string): string => {
        const item = getLiterature(refId);
        return item?.literature.title || refId;
    }, [getLiterature]);

    const makeIdentifier = useCallback((pid: string): string => {
        const v = (pid || '').trim();
        if (!v) return v;
        if (v.includes(':')) return v; // already prefixed
        const isDigits = /^\d+$/.test(v);
        if (isDigits) return `CorpusId:${v}`;
        const isHex40 = /^[a-fA-F0-9]{40}$/.test(v);
        if (isHex40) return v;
        return v; // fallback raw
    }, []);

    const handleAddReference = useCallback(async (pid: string) => {
        if (!pid) return;
        setAddingIds(prev => new Set(prev).add(pid));
        try {
            await addByIdentifier(makeIdentifier(pid), { autoExtractCitations: false, addToCollection: defaultCollectionId });
        } catch (e) {
            // noop; keep silent per request
        } finally {
            setAddingIds(prev => {
                const next = new Set(prev);
                next.delete(pid);
                return next;
            });
        }
    }, [addByIdentifier, makeIdentifier, defaultCollectionId]);

    const Body = (
        <div className="h-full overflow-hidden">
            <Tabs defaultValue="meta" orientation="vertical" className="h-full">
                <div className="h-full flex">
                    <div className="flex-1 min-h-0">
                        <TabsContent value="meta" className="h-full !mt-0">
                            <ScrollArea className="h-full">
                                <div className="space-y-6 p-4">
                                    {/* 只读核心信息 */}
                                    <div className="space-y-2">
                                        <div className="text-lg font-semibold leading-snug">{currentItem?.literature.title}</div>
                                        {currentItem && (
                                            <>
                                                <div className="text-sm text-muted-foreground">
                                                    {(currentItem.literature.authors || []).join(', ')}
                                                </div>
                                                <div className="text-xs text-muted-foreground flex flex-col gap-1">
                                                    <div className="flex gap-3">
                                                        <span className="font-mono">S2 ID: {currentItem.literature.paperId}</span>
                                                        {currentItem.literature.year && (<span>发布日期: {currentItem.literature.publicationDate}</span>)}
                                                    </div>
                                                    <div className="flex gap-3">
                                                        {currentItem.literature.publication && (<span>期刊: {currentItem.literature.publication}</span>)}
                                                        {currentItem.literature.doi && (<span>DOI: {currentItem.literature.doi}</span>)}
                                                    </div>
                                                </div>
                                                {currentItem.literature.abstract && (
                                                    <div className="mt-2 text-sm whitespace-pre-wrap">{currentItem.literature.abstract}</div>
                                                )}
                                            </>
                                        )}
                                    </div>

                                    {/* 可编辑用户元数据 */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <div className="text-sm font-semibold">标签（用逗号分隔）</div>
                                            <Input
                                                placeholder="e.g. survey, transformer, optimization"
                                                value={tagsInput}
                                                onChange={(e) => setTagsInput(e.target.value)}
                                            />
                                            <div className="flex flex-wrap gap-2">
                                                {tagsInput.split(',').map(t => t.trim()).filter(Boolean).slice(0, 10).map((t, i) => (
                                                    <Badge key={`${t}-${i}`} variant="secondary">{t}</Badge>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="text-sm font-semibold">阅读状态</div>
                                            <Select value={readingStatus} onValueChange={(v) => setReadingStatus(v as any)}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="选择阅读状态" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {READING_STATUS_OPTIONS.map(opt => (
                                                        <SelectItem key={opt.value} value={opt.value!}>{opt.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="text-sm font-semibold">评分（1-5，可选）</div>
                                            <Input
                                                type="number"
                                                min={1}
                                                max={5}
                                                step={1}
                                                placeholder="未评分"
                                                value={typeof rating === 'number' ? String(rating) : ''}
                                                onChange={(e) => {
                                                    const v = e.target.value;
                                                    const num = v === '' ? undefined : Number(v);
                                                    if (num === undefined || (!Number.isNaN(num) && num >= 1 && num <= 5)) {
                                                        setRating(num as any);
                                                    }
                                                }}
                                            />
                                        </div>

                                        <div className="space-y-2 md:col-span-2">
                                            <div className="text-sm font-semibold">个人笔记</div>
                                            <Textarea
                                                rows={5}
                                                placeholder="写下你的想法、要点或待办..."
                                                value={personalNotes}
                                                onChange={(e) => setPersonalNotes(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    {error && (
                                        <div className="text-sm text-red-600">{error}</div>
                                    )}

                                    <div className="flex items-center justify-end gap-2">
                                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                                            取消
                                        </Button>
                                        <Button onClick={handleSave} disabled={isSaving}>
                                            {isSaving ? '保存中...' : '保存'}
                                        </Button>
                                    </div>
                                </div>
                            </ScrollArea>
                        </TabsContent>

                        <TabsContent value="references" className="h-full !mt-0">
                            <ScrollArea className="h-full">
                                <div className="p-4 space-y-3">
                                    {references.length === 0 ? (
                                        <div className="text-xs text-muted-foreground">无参考文献信息。</div>
                                    ) : (
                                        <div className="space-y-2">
                                            {references.map((r: any) => {
                                                const exists = !!getLiterature(r.paperId);
                                                const isAdding = addingIds.has(r.paperId);
                                                return (
                                                    <div key={r.paperId} className="rounded-md border border-border/60 p-3 hover:bg-muted/40 transition-colors">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="text-sm font-medium leading-snug line-clamp-2">
                                                                {r.title || resolveTitle(r.paperId)}
                                                            </div>
                                                            {!exists && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    aria-label="添加到文库"
                                                                    onClick={() => handleAddReference(r.paperId)}
                                                                    disabled={isAdding}
                                                                >
                                                                    {isAdding ? (
                                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                                    ) : (
                                                                        <Plus className="w-4 h-4" />
                                                                    )}
                                                                </Button>
                                                            )}
                                                        </div>
                                                        <div className="mt-1 text-xs text-muted-foreground">
                                                            {r.authors && Array.isArray(r.authors) && r.authors.length > 0 && (
                                                                <span>{r.authors.map((a: any) => a?.name || a).filter(Boolean).join(', ')} · </span>
                                                            )}
                                                            {r.venue && <span>{r.venue} · </span>}
                                                            {typeof r.year === 'number' && <span>{r.year}</span>}
                                                            {typeof r.citationCount === 'number' && (
                                                                <span> · 被引 {r.citationCount}</span>
                                                            )}
                                                        </div>
                                                        <div className="mt-1 text-[11px] text-muted-foreground/80 font-mono">ID: {r.paperId}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </TabsContent>
                    </div>

                    <div className="shrink-0 w-10 border-l border-border p-2">
                        <TabsList className="!flex !flex-col !w-full h-auto gap-2 bg-transparent p-0 !items-center !justify-start rounded-none shadow-none">
                            <TabsTrigger value="meta" className="!justify-center !w-full !px-0 !py-2 h-9" aria-label="元数据">
                                <Info className="w-5 h-5" />
                                <span className="sr-only">元数据</span>
                            </TabsTrigger>
                            <TabsTrigger value="references" className="!justify-center !w-full !px-0 !py-2 h-9" aria-label="参考文献">
                                <ListTree className="w-5 h-5" />
                                <span className="sr-only">参考文献</span>
                            </TabsTrigger>
                        </TabsList>
                    </div>
                </div>
            </Tabs>
        </div>
    );

    // Overlay 变体：在组件内部处理蒙层与进出场动画（保持挂载以获得过渡效果）
    if (variant === 'overlay') {
        // Esc 关闭（仅 overlay 变体需要在内部处理）
        useEffect(() => {
            if (!open) return;
            const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onOpenChange(false); };
            window.addEventListener('keydown', onKey);
            return () => { window.removeEventListener('keydown', onKey); };
        }, [open, onOpenChange]);

        return (
            <div className="fixed inset-0 z-40 pointer-events-none overflow-hidden">
                {/* 背景蒙层：保持挂载 + 过渡 */}
                <div
                    className={
                        `absolute inset-0 transition-opacity duration-300 ease-in-out ${open ? 'opacity-100 pointer-events-auto bg-background/50 backdrop-blur-sm' : 'opacity-0 pointer-events-none'}`
                    }
                    onClick={() => onOpenChange(false)}
                />
                {/* 右侧抽屉面板：保持挂载 + 平移动画 */}
                <div className="absolute inset-y-0 right-0 pointer-events-none overflow-hidden">
                    <div
                        className={`w-[38rem] max-w-[90vw] h-full transform-gpu will-change-transform transition-transform duration-300 ease-in-out shadow-xl ${open ? 'translate-x-0 pointer-events-auto' : 'translate-x-full pointer-events-none'}`}
                    >
                        <div className="h-full w-full border-l border-border theme-background-primary flex flex-col">
                            <div className="px-4 py-3 border-b sticky top-0 z-10 theme-background-primary">
                                <div className="flex items-center justify-between">
                                    <div className="text-base font-semibold">文献详情</div>
                                    <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="关闭">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    </Button>
                                </div>
                            </div>
                            <div className="flex-1 min-h-0">{Body}</div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!currentItem) {
        return variant === 'modal' ? (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>文献详情</DialogTitle>
                    </DialogHeader>
                    <div className="text-sm text-muted-foreground">未找到文献信息</div>
                </DialogContent>
            </Dialog>
        ) : (
            <div className="h-full w-full p-4 text-sm text-muted-foreground">未找到文献信息</div>
        );
    }

    if (variant === 'side') {
        return (
            <div className="h-full w-full border-l border-border theme-background-primary flex flex-col">
                <div className="px-4 py-3 border-b sticky top-0 z-10 theme-background-primary">
                    <div className="flex items-center justify-between">
                        <div className="text-base font-semibold">文献详情</div>
                        <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="关闭">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </Button>
                    </div>
                </div>
                <div className="flex-1 min-h-0">{Body}</div>
            </div>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>文献详情</DialogTitle>
                </DialogHeader>
                {Body}
            </DialogContent>
        </Dialog>
    );
}

export default LiteratureDetailPanel;


