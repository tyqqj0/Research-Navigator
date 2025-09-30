"use client";

import React from 'react';
import { useDataset } from '../hooks/use-dataset';
import type { DatasetNode } from '../data-access/dataset-types';
import { ChevronDown, ChevronRight, Folder, Library } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCollectionOperations } from '@/features/literature/hooks';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

interface DatasetSyncPanelProps {
    onImport?: (paperIds: string[], collectionId?: string) => Promise<void> | void;
    defaultCollectionId?: string;
}

export const DatasetSyncPanel: React.FC<DatasetSyncPanelProps> = ({ onImport, defaultCollectionId }) => {
    const { nodes, items, loading, error, loadNodes, loadPapers, currentNodeId } = useDataset();
    const { collections, loadCollections } = useCollectionOperations();

    const [selectedCollection, setSelectedCollection] = React.useState<string | undefined>(undefined);
    const [selectedIds, setSelectedIds] = React.useState<Record<string, boolean>>({});
    const [includeNotes, setIncludeNotes] = React.useState<boolean>(true);
    // 预览笔记计数缓存与状态（不导入也可预览）
    const previewCacheRef = React.useRef<Map<string, { count: number; ts: number }>>(new Map());
    const [previewNoteCounts, setPreviewNoteCounts] = React.useState<Record<string, number>>({});

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
            if (i.s2Id) return `${i.s2Id}`;
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

            // 可选：导入对应 Zotero 笔记（最小实现：逐条针对外部条目拉取 note 并 upsert 到本地 Notes）
            if (includeNotes) {
                try {
                    const { datasetService } = await import('../data-access/dataset-service');
                    const { notesService } = await import('@/features/notes/data-access/notes-service');
                    // 依赖当前节点上下文推断 owner（user/group）
                    const owner = nodes.find(n => n.id === currentNodeId)?.owner;
                    const groupId = owner?.startsWith('group:') ? owner.split(':')[1] : undefined;
                    // 针对每个被选中的外部条目拉取 notes
                    for (const it of picked) {
                        const externalId = it.id;
                        const encoded = groupId ? `group|${groupId}|${externalId}` : `user|${externalId}`;
                        const notes = await datasetService.listNotesByPaper(encoded);
                        if (Array.isArray(notes) && notes.length > 0) {
                            await notesService.upsertZoteroNotes(
                                // 这里需要将外部条目匹配到本地 paperId：
                                // 简化策略：通过 batchImport 已将对应文献导入，本地以 DOI 优先可检索。
                                // 为避免复杂查找，这里回退到后端再次解析 identifier，直接获取 paperId。
                                // 由于我们没有直接映射，这里跳过映射环节，后续在详情页按需触发补链。
                                // 因此此处暂不处理无法映射的情况。
                                (await (await import('@/features/literature/data-access')).literatureEntry.addByIdentifier(
                                    it.doi ? `DOI:${it.doi}` : (it.s2Id ? `${it.s2Id}` : (it.url ? `URL:${it.url}` : it.title))
                                )).paperId,
                                notes.map(n => ({
                                    title: n.title,
                                    markdown: n.markdown,
                                    rawHtml: n.rawHtml,
                                    tags: n.tags,
                                    externalItemKey: (n.externalRef as any)?.zoteroKey,
                                }))
                            );
                        }
                    }
                } catch { /* noop: 笔记导入失败不阻塞文献导入 */ }
            }
        }
        setSelectedIds({});
    };

    // 加载当前可见 items 的 Zotero 笔记计数（预览用）。缓存 60s。
    React.useEffect(() => {
        let cancelled = false;
        const run = async () => {
            if (!items || items.length === 0) return;
            try {
                const { datasetService } = await import('../data-access/dataset-service');
                const owner = nodes.find(n => n.id === currentNodeId)?.owner;
                const groupId = owner?.startsWith('group:') ? owner.split(':')[1] : undefined;
                const now = Date.now();
                const nextMap: Record<string, number> = { ...previewNoteCounts };
                const tasks: Promise<void>[] = [];
                for (const it of items) {
                    const cacheKey = groupId ? `group|${groupId}|${it.id}` : `user|${it.id}`;
                    const cached = previewCacheRef.current.get(cacheKey);
                    if (cached && now - cached.ts < 60_000) {
                        if (nextMap[it.id] !== cached.count) nextMap[it.id] = cached.count;
                        continue;
                    }
                    tasks.push((async () => {
                        try {
                            const notes = await datasetService.listNotesByPaper(cacheKey);
                            const count = Array.isArray(notes) ? notes.length : 0;
                            previewCacheRef.current.set(cacheKey, { count, ts: Date.now() });
                            if (!cancelled) {
                                // 单条增量更新，避免一次性重绘抖动
                                setPreviewNoteCounts(prev => ({ ...prev, [it.id]: count }));
                            }
                        } catch {
                            // 静默失败
                        }
                    })());
                }
                if (tasks.length > 0) await Promise.allSettled(tasks);
                if (!cancelled) setPreviewNoteCounts(prev => ({ ...nextMap, ...prev }));
            } catch {
                // 静默失败
            }
        };
        void run();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items, currentNodeId]);

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
            <li key={n.id} className="px-0 py-0 select-none">
                <div
                    className={`flex items-center rounded-md cursor-pointer hover:bg-muted ${isSelected ? 'bg-accent' : ''}`}
                    style={{ paddingLeft: depth * 12 }}
                    onClick={() => loadPapers(n.id)}
                >
                    {/* Arrow column (fixed width) */}
                    <button
                        type="button"
                        className="h-7 w-4 grid place-items-center flex-shrink-0 mx-1"
                        onClick={(e) => { e.stopPropagation(); if (hasChildren) toggleExpand(n.id); }}
                        aria-label={hasChildren ? (isExpanded ? '折叠' : '展开') : '无子项'}
                    >
                        {hasChildren ? (isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : <span className="inline-block w-4" />}
                    </button>

                    {/* Icon column (fixed width) with extra right spacing */}
                    <span className="h-7 w-4 grid place-items-center flex-shrink-0 mr-2">
                        {isRoot ? <Library className="h-4 w-4 text-emerald-600" /> : <Folder className="h-4 w-4 text-blue-600" />}
                    </span>

                    {/* Text column (flex) */}
                    <span className="h-7 inline-flex items-center gap-2 min-w-0 pr-2">
                        <span className="truncate max-w-[12rem]">{n.name}</span>
                        {typeof n.totalItems === 'number' && <span className="text-xs text-muted-foreground">{n.totalItems}</span>}
                    </span>
                </div>
                {isExpanded && hasChildren && (
                    <ul className="mt-0.5">
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
                        <div className="flex items-center gap-2 text-xs">
                            <span>包含笔记</span>
                            <Switch checked={includeNotes} onCheckedChange={setIncludeNotes} />
                        </div>
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
                                    <div className="text-xs text-muted-foreground truncate flex items-center gap-2">
                                        <span className="truncate">{(it.authors || []).join(', ')} {it.year ? `· ${it.year}` : ''} {it.doi ? `· DOI:${it.doi}` : (it.s2Id ? `· ${it.s2Id}` : (it.url ? `· URL` : ''))}</span>
                                        {typeof previewNoteCounts[it.id] === 'number' && previewNoteCounts[it.id] > 0 && (
                                            <Badge variant="secondary" className="h-4 text-[10px] px-2">Zotero 笔记 {previewNoteCounts[it.id]}</Badge>
                                        )}
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


