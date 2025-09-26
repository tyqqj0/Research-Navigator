"use client";

import React from 'react';
import { useDataset } from '../hooks/use-dataset';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCollectionOperations } from '@/features/literature/hooks';

interface DatasetSyncPanelProps {
    onImport?: (paperIds: string[], collectionId?: string) => Promise<void> | void;
    defaultCollectionId?: string;
}

export const DatasetSyncPanel: React.FC<DatasetSyncPanelProps> = ({ onImport, defaultCollectionId }) => {
    const { nodes, items, loading, error, loadNodes, loadPapers, currentNodeId } = useDataset();
    const { collections, loadCollections } = useCollectionOperations();

    const [selectedCollection, setSelectedCollection] = React.useState<string | undefined>(undefined);
    const [selectedIds, setSelectedIds] = React.useState<Record<string, boolean>>({});

    React.useEffect(() => {
        loadNodes().catch(() => { });
        loadCollections({ force: false }).catch(() => { });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Initialize default selected collection once
    React.useEffect(() => {
        if (defaultCollectionId) {
            setSelectedCollection((prev) => prev ?? defaultCollectionId);
        }
        // only on mount or when defaultCollectionId provided first time
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [defaultCollectionId]);

    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const allSelected = items.length > 0 && items.every(it => selectedIds[it.id]);
    const toggleSelectAll = () => {
        if (allSelected) {
            setSelectedIds({});
        } else {
            const next: Record<string, boolean> = {};
            items.forEach(it => { next[it.id] = true; });
            setSelectedIds(next);
        }
    };

    const doImport = async () => {
        const picked = items.filter(it => selectedIds[it.id]);
        if (picked.length === 0) return;
        const identifiers = picked.map((i) => {
            if (i.doi) return `DOI:${i.doi}`;
            if (i.s2Id) return `S2:${i.s2Id}`;
            if (i.url) return `URL:${i.url}`;
            return i.title;
        });
        if (onImport) {
            await onImport(identifiers, selectedCollection);
        } else {
            const { literatureEntry } = await import('@/features/literature/data-access');
            await literatureEntry.batchImport(
                identifiers.map(id => ({ type: 'identifier', data: id, options: selectedCollection ? { addToCollection: selectedCollection } : undefined }))
            );
        }
        setSelectedIds({});
    };

    return (
        <div className="grid grid-cols-12 gap-4 h-full">
            <div className="col-span-4 border rounded-md overflow-hidden flex flex-col">
                <div className="p-2 border-b flex items-center justify-between">
                    <div className="font-medium">来源结构</div>
                    <Button size="sm" variant="ghost" onClick={() => loadNodes()} disabled={loading}>刷新</Button>
                </div>
                <div className="flex-1 overflow-auto">
                    {error && <div className="p-3 text-sm text-destructive">{error}</div>}
                    <ul className="text-sm">
                        {nodes.map(n => (
                            <li key={n.id} className={`px-3 py-2 cursor-pointer hover:bg-accent ${currentNodeId === n.id ? 'bg-accent' : ''}`} onClick={() => loadPapers(n.id)}>
                                <span className="mr-2 text-muted-foreground">[{n.kind}]</span>{n.name}
                                {typeof n.totalItems === 'number' && <span className="ml-2 text-xs text-muted-foreground">{n.totalItems}</span>}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            <div className="col-span-8 border rounded-md overflow-hidden flex flex-col">
                <div className="p-2 border-b flex items-center gap-2">
                    <Button size="sm" variant="secondary" onClick={toggleSelectAll} disabled={items.length === 0}>
                        {allSelected ? '取消全选' : '全选当前'}</Button>
                    <div className="ml-auto flex items-center gap-2">
                        <Select value={selectedCollection} onValueChange={setSelectedCollection}>
                            <SelectTrigger className="w-[220px]">
                                <SelectValue placeholder="选择导入集合" />
                            </SelectTrigger>
                            <SelectContent>
                                {collections.map((c: any) => (
                                    <SelectItem key={c.id} value={c.id}>{c.name || '未命名集合'}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button size="sm" onClick={doImport} disabled={loading || items.length === 0}>导入所选</Button>
                    </div>
                </div>
                <div className="p-2 border-b">
                    <Input placeholder="搜索（本地筛选）..." />
                </div>
                <div className="flex-1 overflow-auto">
                    {items.length === 0 && <div className="p-3 text-sm text-muted-foreground">请选择左侧节点以加载条目</div>}
                    <ul className="text-sm divide-y">
                        {items.map(it => (
                            <li key={it.id} className="px-3 py-2 flex items-center gap-3">
                                <input type="checkbox" className="h-4 w-4" checked={!!selectedIds[it.id]} onChange={() => toggleSelect(it.id)} />
                                <div className="min-w-0 flex-1">
                                    <div className="font-medium truncate">{it.title}</div>
                                    <div className="text-xs text-muted-foreground truncate">
                                        {(it.authors || []).join(', ')} {it.year ? `· ${it.year}` : ''} {it.doi ? `· DOI:${it.doi}` : (it.s2Id ? `· S2:${it.s2Id}` : (it.url ? `· URL` : ''))}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default DatasetSyncPanel;


