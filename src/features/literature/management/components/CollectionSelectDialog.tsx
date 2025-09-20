"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useCollectionOperations } from '@/features/literature/hooks';

interface CollectionSelectDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (collectionId: string) => Promise<void> | void;
}

export const CollectionSelectDialog: React.FC<CollectionSelectDialogProps> = ({ open, onOpenChange, onConfirm }) => {
    const { collections, loadCollections } = useCollectionOperations();
    const [search, setSearch] = React.useState('');
    const [submitting, setSubmitting] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (open) {
            loadCollections({ force: false }).catch(() => { });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return collections;
        return collections.filter((c: any) => (c.name || '').toLowerCase().includes(q));
    }, [collections, search]);

    const handleConfirm = async (id: string) => {
        try {
            setSubmitting(id);
            await onConfirm(id);
            onOpenChange(false);
        } finally {
            setSubmitting(null);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>选择集合</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                    <Input placeholder="搜索集合..." value={search} onChange={(e) => setSearch(e.target.value)} />
                    <div className="max-h-72 overflow-auto divide-y rounded-md border">
                        {filtered.length === 0 && (
                            <div className="p-3 text-sm text-muted-foreground">暂无集合</div>
                        )}
                        {filtered.map((c: any) => (
                            <div key={c.id} className="p-3 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="text-sm font-medium truncate">{c.name || '未命名集合'}</div>
                                    <div className="text-xs text-muted-foreground">{c.type} · {c.paperIds?.length || 0} 篇</div>
                                </div>
                                <Button size="sm" onClick={() => handleConfirm(c.id)} disabled={!!submitting}>
                                    {submitting === c.id ? '添加中...' : '选择'}
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default CollectionSelectDialog;


