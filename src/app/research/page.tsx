'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { MainLayout, ProtectedLayout } from '@/components/layout';
import { Button, Card, CardContent, Sheet, SheetContent, SheetHeader, SheetTitle, Input, MessageComposer, Badge } from '@/components/ui';
import { useSessionStore } from '@/features/session/data-access/session-store';
import { useAuthStore } from '@/stores/auth.store';
import { commandBus } from '@/features/session/runtime/command-bus';
import { Plus, MessagesSquare, Search, Sparkles, ChevronRight, Send, BookOpen, FileText } from 'lucide-react';
import { UserMenu } from '@/components/auth/UserMenu';
import { cn } from '@/lib/utils';
import { SessionList } from '@/features/session/ui/SessionList';
// Bootstrap orchestrators to ensure command handlers are ready before first user interaction
import '@/features/session/runtime/orchestrator/bootstrap-orchestrators';
import recommendationsData from '@/config/research-recommendations.json';
import { ArchiveManager } from '@/lib/archive/manager';
import { literatureDataAccess } from '@/features/literature/data-access';
import { useLiteratureStore } from '@/features/literature/data-access/stores';
import type { ArtifactRef } from '@/features/session/data-access/types';

const getRepo = () => ArchiveManager.getServices().sessionRepository;

export default function ResearchPage() {
    const router = useRouter();
    const pathname = usePathname();
    const loadAllSessions = useSessionStore(s => s.loadAllSessions);
    const getSessions = useSessionStore(s => s.getSessions);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => { void loadAllSessions().then(() => setHydrated(true)); }, [loadAllSessions]);
    // Re-load sessions when user changes
    useEffect(() => {
        let prevUserId = useAuthStore.getState().currentUser?.id;
        const unsub = useAuthStore.subscribe((state) => {
            const uid = state.currentUser?.id;
            if (uid !== prevUserId) {
                prevUserId = uid;
                try { console.debug('[ui][research_page][user_changed]', { userId: uid }); } catch { /* noop */ }
                void loadAllSessions().then(() => setHydrated(true));
            }
        });
        return () => { unsub(); };
    }, [loadAllSessions]);
    const sessions = getSessions();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [titleDraft, setTitleDraft] = useState('');

    // 移动端会话列表 Sheet 状态
    const [mobileSessionsOpen, setMobileSessionsOpen] = useState(false);

    // 构建 Header 右侧内容
    const headerRightContent = (
        <div className="flex items-center gap-2">
            <Button
                variant="outline"
                size="sm"
                className="md:hidden"
                onClick={() => setMobileSessionsOpen(true)}
            >
                <MessagesSquare className="w-4 h-4 mr-2" />
                会话列表
            </Button>
            {/* 主页右上角显示头像（桌面端可见） */}
            <UserMenu className="hidden md:inline-flex" expandDirection="bottom" align="end" />
        </div>
    );

    // 移除自动跳转，改为英雄区输入创建会话

    const createSession = async () => {
        const id = crypto.randomUUID();
        try { console.debug('[ui][research_page][create_session_click]', { id }); } catch { /* noop */ }
        await commandBus.dispatch({ id: crypto.randomUUID(), type: 'CreateSession', ts: Date.now(), sessionId: id, params: { title: '未命名研究' } } as any);
        router.push(`/research/${id}`);
    };

    const [topic, setTopic] = useState('');
    const [deepEnabled, setDeepEnabled] = useState(false);
    const [selectedRefs, setSelectedRefs] = useState<ArtifactRef[]>([]);

    // Mentions (homepage/hero composer)
    const [mentionOpen, setMentionOpen] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [litResults, setLitResults] = useState<any[]>([]);
    const [repResults, setRepResults] = useState<any[]>([]);
    const [mentionLoading, setMentionLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const q = mentionQuery.trim();
        if (!mentionOpen) return;
        const t = setTimeout(async () => {
            if (!q) { setLitResults([]); setRepResults([]); return; }
            setMentionLoading(true);
            try {
                const [litPage, reps] = await Promise.all([
                    literatureDataAccess.literatures
                        .search({ searchTerm: q }, { field: 'createdAt', order: 'desc' }, 1, 8)
                        .catch(() => ({ items: [] })),
                    getRepo().searchReports({ query: q, limit: 8 }).catch(() => [])
                ]);
                const friendly = Array.isArray(litPage?.items)
                    ? (litPage.items as any[]).map((it: any) => it?.literature || it).filter(Boolean)
                    : [];
                if (!cancelled) { setLitResults(friendly); setRepResults(reps || []); }
            } finally { if (!cancelled) setMentionLoading(false); }
        }, 250);
        return () => { cancelled = true; clearTimeout(t); };
    }, [mentionQuery, mentionOpen]);

    const addRef = (ref: ArtifactRef) => {
        const key = `${ref.kind}:${ref.id}`;
        const setKeys = new Set(selectedRefs.map(r => `${r.kind}:${r.id}`));
        if (setKeys.has(key)) return;
        setSelectedRefs(prev => [...prev, ref]);
    };
    const handleSelectRef = (ref: ArtifactRef) => {
        addRef(ref);
        const lastAt = topic.lastIndexOf('@');
        if (lastAt >= 0) {
            let end = lastAt + 1;
            while (end < topic.length && !/\s/.test(topic[end])) end++;
            const newVal = (topic.slice(0, lastAt) + topic.slice(end)).replace(/\s+$/, '');
            setTopic(newVal);
        }
        setMentionOpen(false);
        setMentionQuery('');
    };

    const removeRef = (ref: ArtifactRef) => {
        const key = `${ref.kind}:${ref.id}`;
        setSelectedRefs(prev => prev.filter(r => `${r.kind}:${r.id}` !== key));
    };

    // Labels for selected reference chips
    const getLiterature = useLiteratureStore(s => s.getLiterature);
    const [reportTitles, setReportTitles] = useState<Record<string, string>>({});
    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            const tasks = (selectedRefs || []).filter(r => r.kind === 'report_final').map(async (r) => {
                const key = String(r.id);
                if (reportTitles[key]) return;
                try {
                    const a = await getRepo().getArtifact(key);
                    if (!cancelled) setReportTitles(prev => ({ ...prev, [key]: String((a?.meta || {}).title || '') }));
                } catch { /* ignore */ }
            });
            await Promise.all(tasks);
        };
        void run();
        return () => { cancelled = true; };
    }, [selectedRefs]);
    const formatRefLabel = (r: ArtifactRef): string => {
        if (r.kind === 'literature') {
            const item = getLiterature(String(r.id));
            const title = item?.literature?.title;
            return title ? `文献: ${title.slice(0, 16)}...` : `文献:${String(r.id).slice(0, 12)}`;
        }
        if (r.kind === 'report_final') {
            const title = reportTitles[String(r.id)];
            return title ? `报告: ${title.slice(0, 16)}...` : `报告:${String(r.id).slice(0, 12)}`;
        }
        return `${r.kind}:${String(r.id).slice(0, 12)}`;
    };

    const createSessionFromTopic = async () => {
        const id = crypto.randomUUID();
        const title = topic.trim() || '未命名研究';
        try { console.debug('[ui][research_page][create_session_from_topic]', { id, title, deepEnabled }); } catch { /* noop */ }
        await commandBus.dispatch({ id: crypto.randomUUID(), type: 'CreateSession', ts: Date.now(), sessionId: id, params: { title } } as any);
        const params = new URLSearchParams();
        const prompt = topic.trim();
        if (prompt) params.set('initPrompt', prompt);
        if (deepEnabled) params.set('deep', '1');
        if (selectedRefs.length > 0) params.set('initRefs', encodeURIComponent(JSON.stringify(selectedRefs)));
        const qs = params.toString();
        router.push(`/research/${id}${qs ? `?${qs}` : ''}`);
    };

    const startResearchWithTopic = async (displayText: string, queryText: string, forceDeep: boolean = false) => {
        const id = crypto.randomUUID();
        const title = displayText.trim() || '未命名研究';
        const useDeep = forceDeep || deepEnabled;
        try { console.debug('[ui][research_page][start_research_from_recommendation]', { id, title, deepEnabled: useDeep }); } catch { /* noop */ }
        await commandBus.dispatch({ id: crypto.randomUUID(), type: 'CreateSession', ts: Date.now(), sessionId: id, params: { title } } as any);
        const params = new URLSearchParams();
        if (queryText.trim()) params.set('initPrompt', queryText.trim());
        if (useDeep) params.set('deep', '1');
        const qs = params.toString();
        router.push(`/research/${id}${qs ? `?${qs}` : ''}`);
    };

    const [selectedCategory, setSelectedCategory] = useState<string>('llm-fundamentals');
    const categories = recommendationsData.categories;
    const currentCategory = categories.find(c => c.id === selectedCategory) || categories[0];

    return (
        <ProtectedLayout>
            <MainLayout showSidebar={true} showHeader={true} headerTitle="Research Navigator" headerRightContent={headerRightContent}>
                <div className="h-full overflow-y-auto">
                    <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
                        {/* 搜索面板 */}
                        <div className="max-w-4xl mx-auto">
                            <Card className="mb-8 rounded-[28px] md:rounded-[32px] overflow-hidden backdrop-blur-sm bg-gradient-to-br from-blue-100/90 to-orange-100/90 dark:from-blue-950/40 dark:to-orange-950/40 border shadow-lg">
                                <CardContent className="p-6 md:p-8">
                                    <div className="text-center mb-8">
                                        <h1 className="text-3xl md:text-4xl font-bold mb-3 bg-gradient-to-r from-blue-600 to-orange-600 bg-clip-text text-transparent">
                                            开始新的研究
                                        </h1>
                                        <p className="text-muted-foreground text-sm md:text-base">
                                            描述你的研究主题或问题，我们会为你创建一个新会话
                                        </p>
                                    </div>
                                    <MessageComposer
                                        value={topic}
                                        onChange={setTopic}
                                        onSend={() => void createSessionFromTopic()}
                                        placeholder="例如：大型语言模型在生物医学信息抽取中的应用挑战？"
                                        variant="hero"
                                        minRows={1}
                                        maxRows={6}
                                        sendKeyScheme="enterToSend"
                                        leftTools={(
                                            <button
                                                type="button"
                                                title="Deep Research"
                                                aria-label="Deep Research"
                                                onClick={() => setDeepEnabled(!deepEnabled)}
                                                className={cn(
                                                    'inline-flex items-center gap-1.5 rounded-full text-xs font-medium px-3 py-1 border transition-all',
                                                    deepEnabled
                                                        ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 shadow-sm'
                                                        : 'bg-white/80 dark:bg-slate-900/60 text-muted-foreground border-border hover:bg-white'
                                                )}
                                            >
                                                <Search className="w-3.5 h-3.5" />
                                                <span>Deep Research</span>
                                            </button>
                                        )}
                                        rightTools={(
                                            <Button size="sm" className="h-8 w-8 rounded-full p-0" onClick={() => void createSessionFromTopic()} title="发送">
                                                <Send className="w-4 h-4" />
                                            </Button>
                                        )}
                                        leftAdornment={null}
                                        helperText={(
                                            <span>提示：按 <b>Enter</b> 发送（输入法安全），使用 <b>Shift+Enter</b> 换行</span>
                                        )}
                                        mentionEnabled
                                        mentionOpen={mentionOpen}
                                        onMentionOpenChange={setMentionOpen}
                                        mentionQuery={mentionQuery}
                                        onMentionQueryChange={setMentionQuery}
                                        mentionTriggerTitle="添加参考 (@)"
                                        renderMentionContent={({ query, close }) => (
                                            <div className="space-y-2">
                                                <Input autoFocus placeholder="搜索文献/报告…" value={mentionQuery} onChange={(e) => setMentionQuery(e.target.value)} />
                                                <div className="text-xs text-muted-foreground">按 Enter 发送消息；使用 @ 添加上下文参考</div>
                                                <div className="max-h-64 overflow-auto space-y-2">
                                                    {mentionLoading && <div className="px-1 py-1 text-xs text-muted-foreground">正在搜索…</div>}
                                                    {litResults && litResults.length > 0 && (
                                                        <div>
                                                            <div className="px-1 py-1 text-xs font-medium text-muted-foreground">文献</div>
                                                            <div className="space-y-1">
                                                                {litResults.map((it: any) => (
                                                                    <button
                                                                        key={it.paperId}
                                                                        type="button"
                                                                        className="w-full text-left px-2 py-1 rounded hover:bg-muted"
                                                                        onClick={() => { handleSelectRef({ kind: 'literature', id: it.paperId }); close(); }}
                                                                    >
                                                                        <div className="flex items-center gap-2">
                                                                            <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                                                                            <div className="min-w-0">
                                                                                <div className="text-sm truncate">{it.title || it.paperId}</div>
                                                                                <div className="text-[11px] text-muted-foreground truncate">{(it.authors || []).slice(0, 3).join(', ')}{it.year ? ` · ${it.year}` : ''}</div>
                                                                            </div>
                                                                        </div>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {repResults && repResults.length > 0 && (
                                                        <div>
                                                            <div className="px-1 py-1 text-xs font-medium text-muted-foreground">报告</div>
                                                            <div className="space-y-1">
                                                                {repResults.map((a: any) => (
                                                                    <button
                                                                        key={a.id}
                                                                        type="button"
                                                                        className="w-full text-left px-2 py-1 rounded hover:bg-muted"
                                                                        onClick={() => { handleSelectRef({ kind: 'report_final', id: a.id }); close(); }}
                                                                    >
                                                                        <div className="flex items-center gap-2">
                                                                            <FileText className="w-3.5 h-3.5 text-purple-600" />
                                                                            <div className="min-w-0">
                                                                                <div className="text-sm truncate">{String((a.meta || {}).title || a.id)}</div>
                                                                                <div className="text-[11px] text-muted-foreground truncate">{String(a.data || '').slice(0, 80)}</div>
                                                                            </div>
                                                                        </div>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {!mentionLoading && mentionQuery.trim() && litResults.length === 0 && repResults.length === 0 && (
                                                        <div className="px-1 py-1 text-xs text-muted-foreground">无结果</div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    />
                                    {selectedRefs.length > 0 && (
                                        <div className="mt-2 px-1 flex items-center gap-2 flex-wrap">
                                            {selectedRefs.map((r) => (
                                                <Badge key={`${r.kind}:${r.id}`} variant="secondary" className="flex items-center gap-0">
                                                    <button
                                                        type="button"
                                                        className="inline-flex items-center gap-1 hover:underline"
                                                        title={formatRefLabel(r)}
                                                    >
                                                        {r.kind === 'literature' ? <BookOpen className="w-3 h-3" /> : r.kind === 'report_final' ? <FileText className="w-3 h-3" /> : null}
                                                        {formatRefLabel(r)}
                                                    </button>
                                                    <button type="button" className="ml-1 hover:text-red-600" onClick={() => removeRef(r)}>
                                                        ×
                                                    </button>
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* 推荐面板 */}
                        <div>
                            <div className="h-48" /> {/* 空白间隔 */}
                            <div className="flex items-center gap-2 mb-6">
                                <Sparkles className="w-5 h-5 text-amber-500" />
                                <h2 className="text-xl font-semibold">灵感发现</h2>
                                <span className="text-sm text-muted-foreground">探索热门研究方向</span>
                            </div>

                            {/* 分类标签 */}
                            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-thin">
                                {categories.map((cat) => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setSelectedCategory(cat.id)}
                                        className={cn(
                                            'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all',
                                            selectedCategory === cat.id
                                                ? 'bg-blue-600 text-white shadow-md'
                                                : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
                                        )}
                                    >
                                        {cat.name}
                                    </button>
                                ))}
                            </div>

                            {/* 主题卡片网格 */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {currentCategory.topics.map((topic) => (
                                    <Card
                                        key={topic.id}
                                        className="group cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-[1.02] border-2 hover:border-blue-400 dark:hover:border-blue-600"
                                        onClick={() => startResearchWithTopic(topic.displayTitle, topic.query, true)}
                                    >
                                        <CardContent className="p-5">
                                            <div className="flex items-start justify-between mb-3">
                                                <h3 className="font-semibold text-lg group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                    {topic.displayTitle}
                                                </h3>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <Search className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                                                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                                                </div>
                                            </div>
                                            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                                                {topic.description}
                                            </p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {topic.tags.map((tag, idx) => (
                                                    <span
                                                        key={idx}
                                                        className="px-2 py-0.5 rounded-md text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900"
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 移动端会话列表 Sheet */}
                <Sheet open={mobileSessionsOpen} onOpenChange={setMobileSessionsOpen}>
                    <SheetContent side="bottom" className="h-[85vh] p-0">
                        <SheetHeader className="p-6 pb-4">
                            <SheetTitle>研究会话</SheetTitle>
                        </SheetHeader>
                        <div
                            className="px-6 pb-6 h-[calc(100%-5rem)] overflow-y-auto"
                            onClick={(e) => {
                                // 点击会话链接后自动关闭 Sheet
                                const target = e.target as HTMLElement;
                                if (target.closest('a[href^="/research/"]')) {
                                    setMobileSessionsOpen(false);
                                }
                            }}
                        >
                            <SessionList />
                        </div>
                    </SheetContent>
                </Sheet>
            </MainLayout>
        </ProtectedLayout>
    );
}


