"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLiteratureQuickAdd } from '@/features/literature/hooks/use-literature-quick-add';
import { CollectionSelectDialog } from './CollectionSelectDialog';
import { toast } from 'sonner';

interface LiteratureQuickAddOverlayProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    contextCollectionId?: string | null;
}

export const LiteratureQuickAddOverlay: React.FC<LiteratureQuickAddOverlayProps> = ({ open, onOpenChange, contextCollectionId }) => {
    const {
        input,
        setInput,
        mode,
        isLoading,
        error,
        selectedCollectionId,
        setSelectedCollectionId,
        candidates,
        parseOrSearch,
        addSingle,
        addMultiple,
        reset,
    } = useLiteratureQuickAdd({ defaultCollectionId: contextCollectionId ?? null });

    const [selectOpen, setSelectOpen] = React.useState(false);

    React.useEffect(() => {
        if (open) {
            // reset state when opening
            reset();
            if (contextCollectionId) setSelectedCollectionId(contextCollectionId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, contextCollectionId]);

    const handleSubmit = async () => {
        if (!input.trim()) return;
        await parseOrSearch();
    };

    const handleAddSingle = async (identifier?: string) => {
        const pid = await addSingle(identifier);
        if (pid) {
            toast.success('已添加到文库', { description: pid });
            onOpenChange(false);
        }
    };

    const handleAddAll = async () => {
        const ids = candidates.map(c => c.bestIdentifier).filter(Boolean) as string[];
        const { success, failed } = await addMultiple(ids);
        if (success.length) toast.success(`已添加 ${success.length} 项`);
        if (failed.length) toast.error(`失败 ${failed.length} 项`);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>快速添加文献</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <Input
                            placeholder="输入 DOI / arXiv / PaperID 或关键词…"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleSubmit(); } }}
                        />
                        <Button variant="emphasize" onClick={handleSubmit} disabled={isLoading || !input.trim()}>
                            {isLoading ? '解析中…' : '解析'}
                        </Button>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>将添加到：</span>
                        {selectedCollectionId ? (
                            <Badge variant="outline">集合 · {String(selectedCollectionId).slice(0, 6)}…</Badge>
                        ) : (
                            <Badge variant="secondary">文库（未分类）</Badge>
                        )}
                        {!contextCollectionId && (
                            <Button variant="outline" size="sm" onClick={() => setSelectOpen(true)}>选择集合…</Button>
                        )}
                    </div>

                    {error && (
                        <div className="text-sm text-red-600">{error}</div>
                    )}

                    {mode === 'identifier' && candidates.length > 0 && (() => {
                        const c = candidates[0];
                        return (
                            <div className="border rounded-md p-3">
                                <div className="text-sm text-muted-foreground">识别到标识：<span className="font-mono">{c.bestIdentifier}</span></div>
                                {c.title && <div className="mt-1 text-sm font-medium">{c.title}</div>}
                                {(c.meta?.publication || c.meta?.year) && (
                                    <div className="text-xs text-muted-foreground">
                                        {[c.meta?.publication, c.meta?.year].filter(Boolean).join(' · ')}
                                    </div>
                                )}
                                {c.snippet && <div className="mt-1 text-xs text-muted-foreground line-clamp-3">{c.snippet}</div>}
                                <div className="mt-3">
                                    <Button onClick={() => handleAddSingle(c.bestIdentifier!)} disabled={isLoading}>
                                        添加到{selectedCollectionId ? '集合' : '文库'}
                                    </Button>
                                </div>
                            </div>
                        );
                    })()}

                    {mode === 'search' && (
                        <div className="space-y-2 max-h-80 overflow-auto">
                            {candidates.length === 0 && !isLoading && (
                                <div className="text-sm text-muted-foreground">无结果，试试更具体的关键词</div>
                            )}
                            {candidates.map(c => (
                                <div key={c.id} className="p-3 border rounded-md flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium truncate">{c.title || '未命名'}</div>
                                        {(c.meta?.publication || c.meta?.year) && (
                                            <div className="text-xs text-muted-foreground">
                                                {[c.meta?.publication, c.meta?.year].filter(Boolean).join(' · ')}
                                            </div>
                                        )}
                                        {c.snippet && <div className="text-xs text-muted-foreground line-clamp-2">{c.snippet}</div>}
                                    </div>
                                    <div className="shrink-0">
                                        <Button size="sm" onClick={() => handleAddSingle(c.bestIdentifier || undefined)} disabled={!c.bestIdentifier || isLoading}>+ 入库</Button>
                                    </div>
                                </div>
                            ))}
                            {candidates.length > 1 && (
                                <div className="pt-1">
                                    <Button variant="outline" size="sm" onClick={handleAddAll} disabled={isLoading}>添加全部</Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <div className="text-xs text-muted-foreground">Enter 提交，Esc 关闭</div>
                </DialogFooter>

                {!contextCollectionId && (
                    <CollectionSelectDialog
                        open={selectOpen}
                        onOpenChange={setSelectOpen}
                        onConfirm={async (cid) => { setSelectedCollectionId(cid); }}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
};

export default LiteratureQuickAddOverlay;


