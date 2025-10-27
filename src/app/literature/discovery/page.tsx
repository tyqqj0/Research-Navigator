"use client";
import React, { useCallback, useMemo, useState } from 'react';
import { MainLayout, ProtectedLayout } from '@/components/layout';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/components/ui';
import { webDiscovery } from '@/features/literature/discovery';
import { useSettingsStore } from '@/features/user/settings/data-access/settings-store';
import { CollectionSelectDialog } from '@/features/literature/management/components/CollectionSelectDialog';
import { toast } from 'sonner';

export default function LiteratureDiscoveryPage() {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [candidates, setCandidates] = useState<any[]>([]);
    const [selectOpen, setSelectOpen] = useState(false);
    const [pendingIdentifier, setPendingIdentifier] = useState<string | null>(null);

    const headerActions = (
        <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={() => window.open('/settings?tab=search', '_blank')}>高级筛选</Button>
            <Button size="sm">保存查询</Button>
        </div>
    );

    const handleSearch = useCallback(async () => {
        const q = query.trim();
        if (!q) return;
        setLoading(true);
        setError(null);
        try {
            const dom = (useSettingsStore.getState().search.searchDomainStrategy?.tavily?.domains) || { predefined: [], custom: [] } as any;
            const includeDomains = [...(dom.predefined || []), ...(dom.custom || [])].filter(Boolean);
            const res = await webDiscovery.searchWeb(q, { limit: 8, includeDomains: includeDomains.length ? includeDomains : undefined });
            setCandidates(res.candidates);
        } catch (e: any) {
            setError(e?.message || '搜索失败');
        } finally {
            setLoading(false);
        }
    }, [query]);

    const handleAdd = useCallback(async (c: any) => {
        if (!c?.bestIdentifier) {
            toast.error('该候选未解析到可用标识');
            return;
        }
        setPendingIdentifier(c.bestIdentifier);
        setSelectOpen(true);
    }, []);

    return (
        <ProtectedLayout>
            <MainLayout
                headerTitle="文献发现"
                headerActions={headerActions}
                showSidebar={true}
            >
                <div className="p-6">
                    <div className="max-w-7xl mx-auto space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>发现与探索</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex space-x-4">
                                    <Input
                                        placeholder="输入关键词、作者或DOI..."
                                        className="flex-1"
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                                    />
                                    <Button onClick={handleSearch} disabled={loading}>{loading ? '搜索中...' : '搜索'}</Button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Button variant="outline" size="sm">计算机科学</Button>
                                    <Button variant="outline" size="sm">机器学习</Button>
                                    <Button variant="outline" size="sm">人工智能</Button>
                                    <Button variant="outline" size="sm">数据科学</Button>
                                </div>
                                {error && (
                                    <div className="text-sm text-destructive">{error}</div>
                                )}
                            </CardContent>
                        </Card>

                        {candidates.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">搜索结果</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {candidates.map((c: any) => (
                                            <div key={c.id} className="p-3 rounded-md border flex items-start justify-between gap-4">
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-medium line-clamp-2">{c.title || c.sourceUrl}</div>
                                                    {(c.venue || c.year) && (
                                                        <div className="text-xs text-muted-foreground truncate">{[(c.venue || c.meta?.venue), c.year].filter(Boolean).join(' · ')}</div>
                                                    )}
                                                    <div className="text-xs line-clamp-2 mt-1">{c.snippet}</div>
                                                    <div className="text-xs mt-2 flex items-center gap-2 flex-wrap">
                                                        {c.bestIdentifier && (
                                                            <span className="px-2 py-0.5 rounded bg-muted">{c.bestIdentifier}</span>
                                                        )}
                                                        <a className="text-blue-600 hover:underline" href={c.sourceUrl} target="_blank" rel="noreferrer">来源</a>
                                                    </div>
                                                </div>
                                                {c.bestIdentifier && (
                                                    <div className="shrink-0">
                                                        <Button size="sm" onClick={() => handleAdd(c)}>+ 入库</Button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
                <CollectionSelectDialog
                    open={selectOpen}
                    onOpenChange={setSelectOpen}
                    onConfirm={async (collectionId) => {
                        if (!pendingIdentifier) return;
                        try {
                            const { paperId } = await webDiscovery.addIdentifierToLibrary(pendingIdentifier, { addToCollection: collectionId });
                            toast.success('已添加到文库', { description: paperId });
                        } catch (e: any) {
                            toast.error('添加失败', { description: e?.message });
                        } finally {
                            setPendingIdentifier(null);
                        }
                    }}
                />
            </MainLayout>
        </ProtectedLayout>
    );
}


