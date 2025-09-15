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

interface LiteratureDetailPanelProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    paperId?: string;
    item?: EnhancedLibraryItem;
    onUpdated?: (updated: boolean) => void;
    variant?: 'modal' | 'side';
}

const READING_STATUS_OPTIONS: Array<{ value: UpdateUserLiteratureMetaInput['readingStatus']; label: string }> = [
    { value: 'unread', label: '未读' },
    { value: 'reading', label: '阅读中' },
    { value: 'completed', label: '已完成' },
    { value: 'referenced', label: '仅参考' },
    { value: 'abandoned', label: '已放弃' },
];

export function LiteratureDetailPanel({ open, onOpenChange, paperId, item, onUpdated, variant = 'modal' }: LiteratureDetailPanelProps) {
    const { getLiterature } = useLiteratureOperations();
    const { updateUserMeta } = useLiteratureCommands();

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
        const arr = (currentItem?.literature.parsedContent as any)?.extractedReferences as any[] | undefined;
        if (!Array.isArray(arr)) return [] as string[];
        // 仅保留字符串ID
        return arr.filter((r: any) => typeof r === 'string');
    }, [currentItem?.literature.parsedContent]);

    const resolveTitle = useCallback((refId: string): string => {
        const item = getLiterature(refId);
        return item?.literature.title || refId;
    }, [getLiterature]);

    const Body = (
        <div className="space-y-6 h-full overflow-auto p-4">
            {/* 只读核心信息 */}
            <div className="space-y-2">
                <div className="text-lg font-semibold leading-snug">{currentItem?.literature.title}</div>
                {currentItem && (
                    <>
                        <div className="text-sm text-muted-foreground">
                            {(currentItem.literature.authors || []).join(', ')}
                        </div>
                        <div className="text-xs text-muted-foreground flex gap-3">
                            {currentItem.literature.year && (<span>年份: {currentItem.literature.year}</span>)}
                            {currentItem.literature.publication && (<span>期刊: {currentItem.literature.publication}</span>)}
                            {currentItem.literature.doi && (<span>DOI: {currentItem.literature.doi}</span>)}
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

            {/* 引用文献（基于元数据直接展示） */}
            <div className="space-y-2">
                <div className="text-sm font-semibold">参考文献（元数据）</div>
                {references.length === 0 ? (
                    <div className="text-xs text-muted-foreground">无解析到的引用。</div>
                ) : (
                    <ScrollArea className="max-h-48 border rounded-md">
                        <div className="p-2 space-y-2">
                            {references.map((rid) => (
                                <div key={rid} className="text-sm">
                                    {resolveTitle(rid)}
                                    {getLiterature(rid) ? null : (
                                        <span className="ml-2 text-xs text-muted-foreground">（未收录）</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                )}
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
    );

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
            <div className="h-full w-full border-l border-border bg-background flex flex-col">
                <div className="px-4 py-3 border-b sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
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


