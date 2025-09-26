"use client";

import React from 'react';
import { useDataset } from '../hooks/use-dataset';
import type { DatasetNode } from '../data-access/dataset-types';
import { ChevronDown, ChevronRight, Folder, Library } from 'lucide-react';
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
            // Mirror path: when no collection selected, try to rebuild path from current node ancestry
            let optionsForAll: any = undefined;
            if (!selectedCollection && currentNodeId) {
                try {
                    // Walk up from currentNodeId to root to build a path array of names
                    const nodeMap = new Map(nodes.map(n => [n.id, n] as const));
                    let chain: string[] = [];
                    let p: string | null | undefined = currentNodeId;
                    const guard = new Set<string>();
                    while (p && nodeMap.has(p) && !guard.has(p)) {
                        guard.add(p);
                        const n = nodeMap.get(p)!;
                        if (n.kind !== 'root') chain.unshift(n.name);
                        p = (n.parentId || null) as any;
                    }
                    if (chain.length > 0) optionsForAll = { autoCreateCollectionPath: chain };
                } catch { /* noop */ }
            }
            await literatureEntry.batchImport(
                identifiers.map(id => ({ type: 'identifier', data: id, options: selectedCollection ? { addToCollection: selectedCollection } : optionsForAll }))
            );
        }
        setSelectedIds({});
    };

    const byParent = React.useMemo(() => {
        const map: Record<string | 'root', DatasetNode[]> = { root: [] } as any;
        for (const n of nodes) {
            const key = (n.parentId || 'root') as any;
            if (!map[key]) map[key] = [];
            map[key].push(n);
        }
        // sort children by kind(root>collection) then name
        Object.keys(map).forEach(k => {
            map[k].sort((a, b) => {
                const ak = a.kind === 'root' ? 0 : a.kind === 'collection' ? 1 : 2;
                const bk = b.kind === 'root' ? 0 : b.kind === 'collection' ? 1 : 2;
                if (ak !== bk) return ak - bk;
                return (a.name || '').localeCompare(b.name || '');
            });
        });
        return map;
    }, [nodes]);

    const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

    // Auto-expand root nodes so their subfolders are visible initially
    React.useEffect(() => {
        if (!nodes || nodes.length === 0) return;
        const next = new Set<string>();
        for (const n of nodes) {
            if (n.kind === 'root') next.add(n.id);
        }
        // Only set when changed to avoid re-render loops
        if (next.size !== expanded.size || Array.from(next).some(id => !expanded.has(id))) {
            setExpanded(next);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nodes]);
    const toggleExpand = (id: string) => {
        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const renderNode = (n: DatasetNode, depth: number) => {
        const hasChildren = (byParent[n.id]?.length || 0) > 0;
        const isExpanded = expanded.has(n.id);
        const isSelected = currentNodeId === n.id;
        const isRoot = n.kind === 'root';
        return (
            <li key={n.id} className="px-0 py-1 select-none">
                <div className={`flex items-center gap-2 rounded-md cursor-pointer hover:bg-muted ${isSelected ? 'bg-accent' : ''}`}
                    onClick={() => loadPapers(n.id)}>
                    <button type="button" className="h-5 w-5 grid place-items-center"
                        onClick={(e) => { e.stopPropagation(); if (hasChildren) toggleExpand(n.id); }}>
                        {hasChildren ? (isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : <span className="inline-block w-4" />}
                    </button>
                    <span className="inline-flex items-center gap-1" style={{ marginLeft: Math.max(0, depth - 1) * 12 }}>
                        {isRoot ? <Library className="h-4 w-4 text-emerald-600" /> : <Folder className="h-4 w-4 text-blue-600" />}
                        <span className="truncate max-w-[12rem]">{n.name}</span>
                        {typeof n.totalItems === 'number' && <span className="text-xs text-muted-foreground">{n.totalItems}</span>}
                    </span>
                </div>
                {isExpanded && hasChildren && (
                    <ul className="ml-4 mt-1">
                        {byParent[n.id].map(child => renderNode(child, depth + 1))}
                    </ul>
                )}
            </li>
        );
    };

    return (
        <div className="grid grid-cols-12 gap-4 h-full min-h-0">
            <div className="col-span-4 border rounded-md overflow-hidden flex flex-col">
                <div className="p-2 border-b flex items-center justify-between">
                    <div className="font-medium">来源结构</div>
                    <Button size="sm" variant="ghost" onClick={() => loadNodes()} disabled={loading}>刷新</Button>
                </div>
                <div className="flex-1 overflow-auto">
                    {error && <div className="p-3 text-sm text-destructive">{error}</div>}
                    <ul className="text-sm py-1">
                        {(byParent['root'] || []).map(n => renderNode(n, 0))}
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
                        {/* Mirror path: when not selected, auto-create path by source hierarchy */}
                        <div className="text-xs text-muted-foreground">未选择集合时将按来源路径自动创建</div>
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


