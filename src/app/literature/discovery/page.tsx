"use client";
import React, { useCallback, useMemo, useState } from 'react';
import { MainLayout, ProtectedLayout } from '@/components/layout';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Badge, Progress, Label, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from '@/components/ui';
import { webDiscovery } from '@/features/literature/discovery';
import { useSettingsStore } from '@/features/user/settings/data-access/settings-store';
import { CollectionSelectDialog } from '@/features/literature/management/components/CollectionSelectDialog';
import { toast } from 'sonner';

export default function LiteratureDiscoveryPage() {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [candidates, setCandidates] = useState<any[]>([]);
    const [limit, setLimit] = useState<number>(8);
    const [matchTitle, setMatchTitle] = useState<boolean>(false);
    const [year, setYear] = useState<string>('');
    const [venue, setVenue] = useState<string>('');
    const [fieldsOfStudySelected, setFieldsOfStudySelected] = useState<string[]>([]);
    const fosOptions = useMemo(() => [
        'Computer Science',
        'Medicine',
        'Chemistry',
        'Biology',
        'Materials Science',
        'Physics',
        'Geology',
        'Psychology',
        'Art',
        'History',
        'Geography',
        'Sociology',
        'Business',
        'Political Science',
        'Economics',
        'Philosophy',
        'Mathematics',
        'Engineering',
        'Environmental Science',
        'Agricultural and Food Sciences',
        'Education',
        'Law',
        'Linguistics'
    ], []);
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
            const res = await webDiscovery.searchWeb(q, {
                limit,
                includeDomains: includeDomains.length ? includeDomains : undefined,
                matchTitle,
                year: year.trim() || undefined,
                venue: venue.trim() || undefined,
                fieldsOfStudy: fieldsOfStudySelected.join(',') || undefined,
            });
            setCandidates(res.candidates);
        } catch (e: any) {
            try {
                console.warn('[DiscoveryPage] search failed', {
                    message: e?.message,
                    limit,
                    matchTitle,
                    year,
                    venue,
                    fieldsOfStudySelected,
                });
            } catch { /* noop */ }
            setError(e?.message || '搜索失败');
        } finally {
            setLoading(false);
        }
    }, [query, limit, matchTitle, year, venue, fieldsOfStudySelected]);

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
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                        <span>条数</span>
                                        <Select value={String(limit)} onValueChange={(v) => setLimit(Math.max(1, Math.min(parseInt(v, 10) || 8, 50)))}>
                                            <SelectTrigger className="w-20">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {[4, 8, 12, 20, 30, 50].map(n => (
                                                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span>标题精确</span>
                                        <Switch checked={matchTitle} onCheckedChange={setMatchTitle} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="year">年份或范围</Label>
                                        <Input id="year" placeholder="例如: 2019, 2016-2020, 2010-, -2015" value={year} onChange={(e) => setYear(e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="venue">期刊/会议（逗号分隔）</Label>
                                        <Input id="venue" placeholder="例如: Nature,Radiology 或 ISO4 缩写" value={venue} onChange={(e) => setVenue(e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>领域（可多选）</Label>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" className="justify-between w-full">
                                                    <span className="truncate">
                                                        {fieldsOfStudySelected.length ? fieldsOfStudySelected.join(', ') : '选择领域'}
                                                    </span>
                                                    <span className="text-muted-foreground">▼</span>
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent className="w-64 max-h-72 overflow-auto">
                                                {fosOptions.map((f) => (
                                                    <DropdownMenuCheckboxItem
                                                        key={f}
                                                        checked={fieldsOfStudySelected.includes(f)}
                                                        onCheckedChange={(checked) => {
                                                            setFieldsOfStudySelected(prev => checked ? Array.from(new Set([...prev, f])) : prev.filter(x => x !== f));
                                                        }}
                                                    >
                                                        {f}
                                                    </DropdownMenuCheckboxItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
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
                                                    <div className="font-medium line-clamp-2 flex items-center gap-2">
                                                        <span>{c.title || c.sourceUrl}</span>
                                                        {typeof c.rank === 'number' && (
                                                            <Badge variant="secondary">#{c.rank}</Badge>
                                                        )}
                                                    </div>
                                                    {(c.venue || c.year) && (
                                                        <div className="text-xs text-muted-foreground truncate">{[(c.venue || c.meta?.venue), c.year].filter(Boolean).join(' · ')}</div>
                                                    )}
                                                    <div className="text-xs line-clamp-2 mt-1">{c.snippet}</div>
                                                    {c.highlights && (c.highlights.title || c.highlights.abstract) && (
                                                        <div className="text-xs mt-2 space-y-1">
                                                            {Array.isArray(c.highlights.title) && c.highlights.title.length > 0 && (
                                                                <div className="text-foreground/80">
                                                                    {c.highlights.title.slice(0, 2).map((h: string, i: number) => (
                                                                        <span key={i} className="mr-2" dangerouslySetInnerHTML={{ __html: h }} />
                                                                    ))}
                                                                </div>
                                                            )}
                                                            {Array.isArray(c.highlights.abstract) && c.highlights.abstract.length > 0 && (
                                                                <div className="text-muted-foreground">
                                                                    {c.highlights.abstract.slice(0, 2).map((h: string, i: number) => (
                                                                        <span key={i} className="mr-2" dangerouslySetInnerHTML={{ __html: h }} />
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div className="text-xs mt-2 flex items-center gap-2 flex-wrap">
                                                        {c.bestIdentifier && (
                                                            <span className="px-2 py-0.5 rounded bg-muted">{c.bestIdentifier}</span>
                                                        )}
                                                        <a className="text-blue-600 hover:underline" href={c.sourceUrl} target="_blank" rel="noreferrer">来源</a>
                                                        {typeof c.confidence === 'number' && (
                                                            <span className="inline-flex items-center gap-2">
                                                                <span>置信度</span>
                                                                <div className="w-24"><Progress value={Math.round(c.confidence * 100)} /></div>
                                                            </span>
                                                        )}
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


