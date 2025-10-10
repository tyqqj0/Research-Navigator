"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useSessionStore } from '../data-access/session-store';
import type { SessionId, ArtifactRef } from '../data-access/types';
import { commandBus } from '@/features/session/runtime/command-bus';
import { Markdown } from '@/components/ui/markdown';
import { sessionRepository } from '../data-access/session-repository';
import { useLiteratureStore } from '@/features/literature/data-access/stores';
import { DirectionProposalCard } from './DirectionProposalCard';
// import { runtimeConfig } from '@/features/session/runtime/runtime-config';
import { StreamCard } from '@/components/ui';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronLeft, X, Search, Send, AtSign, BookOpen, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { literatureDataAccess } from '@/features/literature/data-access';
// import { SessionStatusStrip } from './SessionStatusStrip';
import { SessionStageIndicator } from './SessionStageIndicator';

interface ChatPanelProps {
    sessionId: SessionId;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ sessionId }) => {
    const messages = useSessionStore(s => s.getMessages(sessionId));
    const session = useSessionStore(s => s.sessions.get(sessionId));
    const toggleGraphPanel = useSessionStore(s => s.toggleGraphPanel);
    const [userInput, setUserInput] = React.useState('');
    const [selectedRefs, setSelectedRefs] = React.useState<ArtifactRef[]>([]);
    const [deep, setDeep] = React.useState<boolean>(() => {
        try {
            const s = (useSessionStore.getState() as any).sessions.get(sessionId);
            return Boolean(s?.meta?.deepResearchEnabled);
        } catch { return false; }
    });

    const sendUserMessage = async () => {
        const text = userInput.trim();
        if (!text) return;
        await commandBus.dispatch({ id: crypto.randomUUID(), type: 'SendMessage', ts: Date.now(), params: { sessionId, text }, inputRefs: selectedRefs } as any);
        setUserInput('');
    };

    const toggleDeep = async (enabled: boolean) => {
        setDeep(enabled);
        await commandBus.dispatch({ id: crypto.randomUUID(), type: 'ToggleDeepResearch', ts: Date.now(), params: { sessionId, enabled } } as any);
    };

    const isOpen = Boolean((session as any)?.meta?.graphPanelOpen);
    return (
        // <div></div>
        <Card className="relative h-[calc(100vh-5rem)] flex flex-col">
            {/* 右上角书签形按钮：收起为向左箭头，展开为小叉 */}
            <button
                type="button"
                onClick={() => toggleGraphPanel(sessionId)}
                className={cn(
                    'bookmark-shape icon-button absolute right-0 top-3 translate-x-1/2 z-20 flex items-center justify-center',
                    'w-7 h-9 shadow-sm',
                    isOpen
                        ? 'bg-blue-50 text-blue-600 border border-blue-200'
                        : 'bg-blue-600 text-white'
                )}
                aria-label={isOpen ? '隐藏图谱/集合面板' : '显示图谱/集合面板'}
                title={isOpen ? '隐藏图谱/集合面板' : '显示图谱/集合面板'}
            >
                {isOpen ? (
                    <X className="w-4 h-4" />
                ) : (
                    <ChevronLeft className="w-4 h-4" />
                )}
            </button>

            <CardHeader className="py-2 space-y-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">对话</CardTitle>
                    <SessionStageIndicator sessionId={sessionId} />
                </div>
                {/* <SessionStatusStrip sessionId={sessionId} /> */}
                {/* <DeepResearchPill enabled={deep} onToggle={toggleDeep} /> */}
            </CardHeader>
            <CardContent className="flex-1 min-h-0 p-0 flex flex-col">
                <div className="flex-1 overflow-auto">
                    {messages.map((m, idx) => {
                        const prev = messages[idx - 1];
                        const type = m.id.split('_')[0];
                        const prevType = prev ? prev.id.split('_')[0] : null;
                        const showDivider = prev && prevType !== type;
                        const labelMap: Record<string, string> = {
                            proposal: 'Step 1 · 方向提议',
                            plan: 'Step 2.1 · 思考',
                            cands: 'Step 2.1 · 搜索',
                            graph: 'Step 2.2 · 关系图',
                            report: 'Step 3 · 报告',
                        };
                        const label = labelMap[type] || undefined;
                        return (
                            <div key={m.id} className="p-3 text-sm">
                                {showDivider && label && (
                                    <div className="my-2 flex items-center gap-2 text-xs text-muted-foreground">
                                        <div className="h-px bg-border flex-1" />
                                        <div>{label}</div>
                                        <div className="h-px bg-border flex-1" />
                                    </div>
                                )}
                                <div className="text-xs text-muted-foreground mb-1">{m.role} · {new Date(m.createdAt).toLocaleTimeString()}</div>
                                {m.id.startsWith('proposal_') ? (
                                    <DirectionProposalCard sessionId={sessionId} content={m.content} status={m.status} />
                                ) : m.id.startsWith('graph_thinking_') ? (
                                    <GraphThinkingCard status={m.status} content={m.content} />
                                ) : m.id.startsWith('plan_') ? (
                                    <SearchThinkingCard status={m.status} content={m.content} />
                                ) : m.id.startsWith('cands_') ? (
                                    <SearchCandidatesCard sessionId={sessionId} artifactId={m.id.replace('cands_', '')} />
                                ) : m.id.startsWith('graph_decision_') ? (
                                    <GraphDecisionCard sessionId={sessionId} />
                                ) : m.id.startsWith('report_') ? (
                                    <ReportCard sessionId={sessionId} messageId={m.id} status={m.status} content={m.content} />
                                ) : (
                                    <Markdown text={m.content} />
                                )}
                            </div>
                        );
                    })}
                    {/* 操作按钮已上移到头部 */}
                    {/* 决策任务卡：当等待决定时渲染卡片 */}
                    {!!(session as any)?.meta?.direction?.awaitingDecision && (
                        <div className="p-3">
                            <DecisionCard sessionId={sessionId} />
                        </div>
                    )}
                    {/* 取消底部常驻的 GraphDecisionCard，改为消息驱动 */}
                    {messages.length === 0 && (
                        <div className="p-4 text-sm text-muted-foreground">还没有消息，输入内容试试</div>
                    )}
                </div>

                <ComposerBar
                    value={userInput}
                    onChange={setUserInput}
                    onSend={sendUserMessage}
                    deep={deep}
                    onToggleDeep={toggleDeep}
                    selectedRefs={selectedRefs}
                    onRefsChange={setSelectedRefs}
                />
            </CardContent>
        </Card>
    );
};

export default ChatPanel;

const SearchThinkingCard: React.FC<{ status: any; content: string }> = ({ status, content }) => {
    return (
        <StreamCard
            title="思考"
            status={status}
            headerVariant="purple"
            contentClassName="space-y-2"
        >
            <Markdown text={content} />
        </StreamCard>
    );
};

const GraphThinkingCard: React.FC<{ status: any; content: string }> = ({ status, content }) => {
    const sections = React.useMemo(() => {
        const parts: Array<{ title: string; body: string }> = [];
        const regex = /\n##\s*Thinking\s*(\d+)[^\n]*\n/gi;
        let match: RegExpExecArray | null;
        const indices: Array<{ idx: number; title: string }> = [];
        while ((match = regex.exec(content)) !== null) {
            indices.push({ idx: match.index, title: `Thinking ${match[1]}` });
        }
        if (indices.length === 0) return [{ title: 'Thinking', body: content }];
        indices.forEach((ent, i) => {
            const start = ent.idx;
            const end = i + 1 < indices.length ? indices[i + 1].idx : content.length;
            const body = content.slice(start, end).trim();
            parts.push({ title: ent.title, body });
        });
        return parts;
    }, [content]);
    return (
        <StreamCard
            // title="关系图·思考"
            title="思考"
            status={status}
            headerVariant="purple"
            className="mb-2"
            contentClassName="space-y-2"
        >
            <div className="space-y-2">
                {sections.map((sec, i) => (
                    <Collapsible key={i}>
                        <CollapsibleTrigger className="w-full text-left px-2 py-1 rounded bg-slate-50 hover:bg-slate-100 text-xs font-medium">
                            {sec.title}
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2 pl-2 border-l">
                            <Markdown text={sec.body} />
                        </CollapsibleContent>
                    </Collapsible>
                ))}
            </div>
        </StreamCard>
    );
};

const SearchCandidatesCard: React.FC<{ sessionId: SessionId; artifactId: string }> = ({ sessionId, artifactId }) => {
    const [open, setOpen] = React.useState(false);
    const [loading, setLoading] = React.useState(true);
    const [data, setData] = React.useState<any | null>(null);
    const session = useSessionStore(s => s.sessions.get(sessionId));
    const collectionId = session?.linkedCollectionId;
    React.useEffect(() => {
        let cancelled = false;
        const run = async () => {
            setLoading(true);
            try {
                const a = await sessionRepository.getArtifact(artifactId);
                if (!cancelled) setData(a?.data || null);
            } finally { if (!cancelled) setLoading(false); }
        };
        void run();
        return () => { cancelled = true; };
    }, [artifactId]);
    const onAdd = async (identifier: string) => {
        if (!collectionId) return;
        try {
            const { literatureEntry } = require('@/features/literature/data-access');
            await literatureEntry.addByIdentifier(identifier, { addToCollection: collectionId });
        } catch { /* ignore */ }
    };
    if (loading || !data) {
        return (
            <Card className="border rounded-md">
                <CardHeader className="py-2">
                    <CardTitle className="text-sm">搜索候选</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-2/3" />
                </CardContent>
            </Card>
        );
    }
    return (
        <Card className="border rounded-md ">
            <CardHeader className="py-2" variant="purple">
                <div className="flex items-center justify-between cursor-pointer" onClick={() => setOpen(o => !o)}>
                    <CardTitle className="text-sm">搜索：{data.query}</CardTitle>
                    <div className="text-xs text-muted-foreground">{open ? '收起' : '展开'}</div>
                </div>
            </CardHeader>
            <div
                className={cn(
                    'grid transition-all duration-300 ease-in-out',
                    open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                )}
                aria-hidden={!open}
            >
                <div className="overflow-hidden">
                    <CardContent className="space-y-2 ">
                        {data.candidates.map((c: any) => (
                            <div key={c.id} className="p-2 border rounded flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-medium truncate">{c.title || c.sourceUrl}</div>
                                    <div className="text-[11px] text-muted-foreground truncate">{c.site}</div>
                                    {/* <div className="text-[12px] line-clamp-2 mt-1">{c.snippet}</div> */}
                                    <div className="text-[11px] mt-1 flex items-center gap-2 flex-wrap">
                                        {c.bestIdentifier && (
                                            <span className="px-1.5 py-0.5 rounded bg-muted">{c.bestIdentifier}</span>
                                        )}
                                        <a className="text-blue-600 hover:underline" href={c.sourceUrl} target="_blank" rel="noreferrer">来源</a>
                                    </div>
                                </div>
                                {/* Chat 中不提供入库按钮，自动入库由 orchestrator 负责 */}
                            </div>
                        ))}
                    </CardContent>
                </div>
            </div>
        </Card>
    );
};
const DeepResearchPill: React.FC<{ enabled: boolean; onToggle: (next: boolean) => void }> = ({ enabled, onToggle }) => {
    return (
        <button
            type="button"
            onClick={() => onToggle(!enabled)}
            className={cn(
                'inline-flex items-center gap-2 rounded-full text-xs px-3 py-1 border',
                enabled ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-muted text-muted-foreground border-transparent'
            )}
        >
            <span className="i-lucide-search w-3 h-3" />
            <span>Deep Research</span>
        </button>
    );
};

const ComposerBar: React.FC<{
    value: string;
    onChange: (v: string) => void;
    onSend: () => void;
    deep: boolean;
    onToggleDeep: (b: boolean) => void;
    selectedRefs: ArtifactRef[];
    onRefsChange: (refs: ArtifactRef[]) => void;
}> = ({ value, onChange, onSend, deep, onToggleDeep, selectedRefs, onRefsChange }) => {
    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
    };

    const [mentionOpen, setMentionOpen] = React.useState(false);
    const [query, setQuery] = React.useState('');
    const [litResults, setLitResults] = React.useState<any[]>([]);
    const [repResults, setRepResults] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(false);

    // Debounced search for mentions
    React.useEffect(() => {
        let cancelled = false;
        const q = query.trim();
        if (!mentionOpen) return;
        const t = setTimeout(async () => {
            if (!q) { setLitResults([]); setRepResults([]); return; }
            setLoading(true);
            try {
                const [lits, reps] = await Promise.all([
                    literatureDataAccess.searchLiterature(q, { limit: 8 }).catch(() => []),
                    sessionRepository.searchReports({ query: q, limit: 8 }).catch(() => [])
                ]);
                if (!cancelled) { setLitResults(lits || []); setRepResults(reps || []); }
            } finally { if (!cancelled) setLoading(false); }
        }, 250);
        return () => { cancelled = true; clearTimeout(t); };
    }, [query, mentionOpen]);

    const addRef = (ref: ArtifactRef) => {
        const key = `${ref.kind}:${ref.id}`;
        const setKeys = new Set(selectedRefs.map(r => `${r.kind}:${r.id}`));
        if (setKeys.has(key)) return;
        onRefsChange([...selectedRefs, ref]);
    };
    const removeRef = (ref: ArtifactRef) => {
        const key = `${ref.kind}:${ref.id}`;
        onRefsChange(selectedRefs.filter(r => `${r.kind}:${r.id}` !== key));
    };

    const formatRefLabel = (r: ArtifactRef): string => {
        if (r.kind === 'literature') return `文献:${String(r.id).slice(0, 12)}`;
        if (r.kind === 'report_final') return `报告:${String(r.id).slice(0, 12)}`;
        return `${r.kind}:${String(r.id).slice(0, 12)}`;
    };

    return (
        <div className="p-3">
            {/* Selected references chips */}
            {selectedRefs.length > 0 && (
                <div className="px-2 pb-2 flex items-center gap-2 flex-wrap">
                    {selectedRefs.map((r) => (
                        <Badge key={`${r.kind}:${r.id}`} variant="secondary" className="flex items-center gap-1">
                            <span className="inline-flex items-center gap-1">
                                {r.kind === 'literature' ? <BookOpen className="w-3 h-3" /> : r.kind === 'report_final' ? <FileText className="w-3 h-3" /> : null}
                                {formatRefLabel(r)}
                            </span>
                            <button type="button" className="ml-1 hover:text-red-600" onClick={() => removeRef(r)}>
                                <X className="w-3 h-3" />
                            </button>
                        </Badge>
                    ))}
                </div>
            )}
            <div className="relative flex items-center gap-2">
                <button
                    type="button"
                    title="Deep Research"
                    onClick={() => onToggleDeep(!deep)}
                    className={cn(
                        'absolute left-2 inline-flex items-center gap-1 rounded-full text-xs px-2 py-0.5 border',
                        deep ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-muted text-muted-foreground border-transparent'
                    )}
                >
                    <Search className="w-3 h-3" />
                    <span>Deep Research</span>
                </button>
                <Input
                    className="pl-32 pr-28"
                    placeholder="输入你的问题（普通对话）或让我们找到研究方向"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={onKeyDown}
                />
                <Popover open={mentionOpen} onOpenChange={setMentionOpen}>
                    <PopoverTrigger asChild>
                        <Button size="sm" variant="ghost" className="absolute right-10" title="添加参考 (@)" onClick={() => setMentionOpen(!mentionOpen)}>
                            <AtSign className="w-4 h-4" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-96 p-3">
                        <div className="space-y-2">
                            <Input autoFocus placeholder="搜索文献/报告…" value={query} onChange={(e) => setQuery(e.target.value)} />
                            <div className="text-xs text-muted-foreground">按 Enter 发送消息；使用 @ 添加上下文参考</div>
                            <div className="max-h-64 overflow-auto space-y-2">
                                {/* 文献结果 */}
                                {litResults && litResults.length > 0 && (
                                    <div>
                                        <div className="px-1 py-1 text-xs font-medium text-muted-foreground">文献</div>
                                        <div className="space-y-1">
                                            {litResults.map((it: any) => (
                                                <button
                                                    key={it.paperId}
                                                    type="button"
                                                    className="w-full text-left px-2 py-1 rounded hover:bg-muted"
                                                    onClick={() => addRef({ kind: 'literature', id: it.paperId })}
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
                                {/* 报告结果 */}
                                {repResults && repResults.length > 0 && (
                                    <div>
                                        <div className="px-1 py-1 text-xs font-medium text-muted-foreground">报告</div>
                                        <div className="space-y-1">
                                            {repResults.map((a: any) => (
                                                <button
                                                    key={a.id}
                                                    type="button"
                                                    className="w-full text-left px-2 py-1 rounded hover:bg-muted"
                                                    onClick={() => addRef({ kind: 'report_final', id: a.id })}
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
                                {!loading && query.trim() && litResults.length === 0 && repResults.length === 0 && (
                                    <div className="px-1 py-1 text-xs text-muted-foreground">无结果</div>
                                )}
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
                <Button size="sm" className="absolute right-2" onClick={onSend}>
                    <Send className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
};


const DecisionCard: React.FC<{ sessionId: SessionId }> = ({ sessionId }) => {
    const [feedback, setFeedback] = React.useState('');
    const onConfirm = async () => {
        await commandBus.dispatch({ id: crypto.randomUUID(), type: 'DecideDirection', ts: Date.now(), params: { sessionId, action: 'confirm' } } as any);
    };
    const onRefine = async () => {
        await commandBus.dispatch({ id: crypto.randomUUID(), type: 'DecideDirection', ts: Date.now(), params: { sessionId, action: 'refine', feedback } } as any);
        setFeedback('');
    };
    const onCancel = async () => {
        await commandBus.dispatch({ id: crypto.randomUUID(), type: 'DecideDirection', ts: Date.now(), params: { sessionId, action: 'cancel' } } as any);
    };
    return (
        <Card className="border rounded-md">
            <CardHeader className="py-2" variant="blue">
                <CardTitle className="text-sm">需要决定</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                <div className="text-sm">是否确认当前研究方向？</div>
                <Input placeholder="如需细化，可输入补充/反馈" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
                <div className="flex gap-2">
                    <Button size="sm" onClick={onConfirm}>确认</Button>
                    <Button size="sm" variant="secondary" onClick={onRefine}>细化</Button>
                    <Button size="sm" variant="ghost" onClick={onCancel}>取消</Button>
                </div>
            </CardContent>
        </Card>
    );
};

const GraphDecisionCard: React.FC<{ sessionId: SessionId }> = ({ sessionId }) => {
    const session = useSessionStore(s => s.sessions.get(sessionId));
    const info = (session as any)?.meta?.graphDecision || {};
    const locked = Boolean((session as any)?.meta?.graphDecision?.locked);
    const [suggestion, setSuggestion] = React.useState('');
    const onGenerate = async () => {
        await commandBus.dispatch({ id: crypto.randomUUID(), type: 'GenerateReport', ts: Date.now(), params: { sessionId } } as any);
    };
    const onSupplement = async () => {
        await commandBus.dispatch({ id: crypto.randomUUID(), type: 'SupplementGraph', ts: Date.now(), params: { sessionId, suggestion } } as any);
        setSuggestion('');
    };
    return (
        <Card className="border rounded-md">
            <CardHeader className="py-2" variant="blue">
                <CardTitle className="text-sm">需要确认</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                <div className="text-md mb-2">是否接受当前图谱？（节点 {info.nodes ?? '-'}，边 {info.edges ?? '-'}）</div>
                <div className="text-xs text-muted-foreground mb-3">可随时手动修改/添加节点</div>
                <div className="flex gap-2">
                    <Button size="sm" onClick={onGenerate} disabled={locked}>生成报告</Button>
                    <Input className="max-w-sm" placeholder="输入补充/扩展建议（可选）" value={suggestion} onChange={(e) => setSuggestion(e.target.value)} disabled={locked} />
                    <Button size="sm" variant="secondary" onClick={onSupplement} disabled={!suggestion.trim() || locked}>补充图谱</Button>
                </div>
            </CardContent>
        </Card>
    );
};

const ReportCard: React.FC<{ sessionId: SessionId; messageId: string; status: any; content: string }> = ({ sessionId, messageId, status, content }) => {
    const session = useSessionStore(s => s.sessions.get(sessionId));
    const meta = (session as any)?.meta || {};
    const reportMeta = (meta.report || {})[messageId] || {};
    const citeKeys: Array<{ paperId: string; key: string }> = reportMeta.citeKeys || [];
    const bibtexByKey: Record<string, string> = reportMeta.bibtexByKey || {};
    const getLiterature = useLiteratureStore(s => s.getLiterature);
    const outlineText = reportMeta.outlineText as string | undefined;
    const draftText = reportMeta.draftText as string | undefined;
    const abstractText = reportMeta.abstractText as string | undefined;
    const finalOutlineText = reportMeta.finalOutlineText as string | undefined;
    const outlineStatus = reportMeta.outlineStatus as string | undefined;
    const expandStatus = reportMeta.expandStatus as string | undefined;
    const abstractStatus = reportMeta.abstractStatus as string | undefined;

    // key -> paperId 快速映射
    const keyToPaperId = React.useMemo(() => {
        const m = new Map<string, string>();
        (citeKeys || []).forEach(({ key, paperId }) => { if (key && paperId) m.set(key, paperId); });
        return m;
    }, [citeKeys]);

    // Known keys from prompt data to avoid numbering unrelated brackets
    const allKnownKeys = React.useMemo(() => {
        const set = new Set<string>();
        Object.keys(bibtexByKey || {}).forEach(k => set.add(k));
        (citeKeys || []).forEach(c => set.add(c.key));
        return set;
    }, [citeKeys, bibtexByKey]);

    // Preprocess: strip model-supplied References/BibTeX, map numeric [n] -> [@key] when possible
    const preprocessed = React.useMemo(() => {
        let txt = content || '';
        const numToKey = new Map<number, string>();
        // Locate References/参考文献 section and extract mapping like: [1]Key followed by @article{Key,
        const refsHeadingIdx = (() => {
            const m = txt.match(/(^|\n)\s*(?:#{1,6}\s*)?(References|参考文献)\s*(\n|$)/i);
            return m ? m.index! + (m[1] ? m[1].length : 0) : -1;
        })();
        if (refsHeadingIdx >= 0) {
            const headToEnd = txt.slice(refsHeadingIdx);
            // Extract [n]Key lines
            const lineRe = /^\s*\[(\d+)\]\s*([A-Za-z][A-Za-z0-9_]*)/gm;
            let lm: RegExpExecArray | null;
            while ((lm = lineRe.exec(headToEnd)) !== null) {
                const num = parseInt(lm[1], 10);
                const key = lm[2];
                if (allKnownKeys.has(key)) numToKey.set(num, key);
            }
            // Remove the entire references block from content
            txt = txt.slice(0, refsHeadingIdx).trimEnd();
        }
        // Fallback: if no heading, try to glean keys from trailing @article blocks order [1..]
        if (numToKey.size === 0) {
            const bibKeyRe = /@article\{\s*([A-Za-z][A-Za-z0-9_]*)\s*,[\s\S]*?\}/gi;
            const keys: string[] = [];
            let bm: RegExpExecArray | null;
            while ((bm = bibKeyRe.exec(content || '')) !== null) {
                const key = bm[1];
                if (allKnownKeys.has(key)) keys.push(key);
            }
            if (keys.length > 0) {
                keys.forEach((k, idx) => numToKey.set(idx + 1, k));
                // Remove bib blocks if present
                txt = txt.replace(bibKeyRe, '').trimEnd();
            }
        }
        // Replace numeric citations with [@key]
        if (numToKey.size > 0) {
            txt = txt.replace(/\[(\d+)\]/g, (m: string, nStr: string) => {
                const n = parseInt(nStr, 10);
                const key = numToKey.get(n);
                return key && allKnownKeys.has(key) ? `[@${key}]` : m;
            });
        }
        // Remove any stray bibtex blocks leftover anywhere
        txt = txt.replace(/@article\{[\s\S]*?\}/g, '').trim();
        return { text: txt };
    }, [content, allKnownKeys]);

    // Support both [@key] and [key] forms; only number when key is known
    const { rendered, numbering } = React.useMemo(() => {
        const numberingMap = new Map<string, number>();
        let nextNum = 1;
        const pattern = /\[(?:@)?([A-Za-z][A-Za-z0-9_]*)\]/g;
        const replaced = preprocessed.text.replace(pattern, (m: string, key: string) => {
            if (allKnownKeys.has(key)) {
                if (!numberingMap.has(key)) numberingMap.set(key, nextNum++);
                const n = numberingMap.get(key)!;
                return `[${n}]`;
            }
            return m;
        });
        return { rendered: replaced, numbering: numberingMap };
    }, [preprocessed.text, allKnownKeys]);

    const references = React.useMemo(() => {
        const items = Array.from(numbering.entries()).sort((a, b) => a[1] - b[1]);
        return items.map(([key, n]) => {
            const paperId = keyToPaperId.get(key);
            const paper = paperId ? getLiterature(paperId) : undefined;
            return { n, key, bib: bibtexByKey[key], paper };
        }).filter(x => !!x.bib || !!x.paper);
    }, [numbering, bibtexByKey, keyToPaperId, getLiterature]);

    // Helpers: format authors in IEEE-like style
    const formatAuthorsIEEE = React.useCallback((authors: string[] | undefined): string => {
        if (!authors || authors.length === 0) return '';
        const toIEEE = (full: string): string => {
            const parts = full.split(/\s+/).filter(Boolean);
            if (parts.length === 1) return parts[0];
            const last = parts[parts.length - 1];
            const initials = parts.slice(0, -1).map(p => (p[0] || '').toUpperCase() + '.').join(' ');
            return `${initials} ${last}`.trim();
        };
        if (authors.length <= 3) {
            const formatted = authors.map(toIEEE);
            if (formatted.length === 2) return `${formatted[0]} and ${formatted[1]}`;
            if (formatted.length === 3) return `${formatted[0]}, ${formatted[1]}, and ${formatted[2]}`;
            return formatted[0];
        }
        return `${toIEEE(authors[0])} et al.`;
    }, []);

    // Format references: IEEE-like "Authors, \"Title,\" Venue, Year. DOI/URL"
    const formatReference = React.useCallback((entry: { bib?: string; key: string; paper?: any }): string => {
        const pick = (name: string): string | undefined => {
            if (!entry.bib) return undefined;
            const re = new RegExp(name + '\\s*=\\s*\\{([^}]*)\\}', 'i');
            const m = re.exec(entry.bib);
            return m ? m[1].trim() : undefined;
        };
        const p = entry.paper?.literature;
        const title = (p?.title || pick('title') || entry.key).replace(/[{}]/g, '').trim();
        const authorsArr: string[] | undefined = p?.authors || undefined;
        let authors = formatAuthorsIEEE(authorsArr);
        if (!authors) {
            // fallback to bib author raw string
            const rawAuthor = (pick('author') || '').replace(/[{}]/g, '').trim();
            if (rawAuthor) authors = rawAuthor.includes(' and ') ? rawAuthor.split(/\s+and\s+/i)[0] + ' et al.' : rawAuthor;
        }
        const year = String(p?.year || pick('year') || '').trim();
        const venue = (p?.publication || '').trim();
        const doi = (p?.doi || '').trim();
        const url = (p?.url || '').trim();
        const parts: string[] = [];
        if (authors) parts.push(authors);
        parts.push(`"${title},"`);
        if (venue) parts.push(venue);
        if (year) parts.push(year);
        let tail = '';
        if (doi) tail = ` DOI: ${doi}.`;
        else if (url) tail = ` Available: ${url}`;
        return `${parts.join(', ')}.${tail}`.replace(/\s+\./g, '.');
    }, [formatAuthorsIEEE]);

    return (
        <div className="space-y-3">
            <StreamCard
                title="报告 · 大纲"
                status={(outlineStatus as any) || (status === 'streaming' ? 'streaming' : undefined)}
                headerVariant="purple"
            >
                <Markdown text={outlineText || (status !== 'done' ? '⏳ 正在生成大纲…' : '')} />
            </StreamCard>
            <StreamCard
                title="报告 · 扩写"
                status={(expandStatus as any) || (status === 'streaming' ? 'streaming' : undefined)}
                headerVariant="purple"
            >
                <Markdown text={draftText || (status !== 'done' ? '⏳ 正在扩写…' : '')} />
            </StreamCard>
            <StreamCard
                title="报告 · 摘要"
                status={(abstractStatus as any) || (status === 'streaming' ? 'streaming' : undefined)}
                headerVariant="purple"
            >
                <Markdown text={abstractText || (status !== 'done' ? '⏳ 正在生成摘要…' : '')} />
            </StreamCard>

            <StreamCard
                title="报告"
                status={status}
                headerVariant="blue"
                headerRight={status === 'streaming' ? (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">大纲 / 扩写 / 摘要</span>
                        <Button size="sm" variant="ghost" onClick={() => commandBus.dispatch({ id: crypto.randomUUID(), type: 'StopReport', ts: Date.now(), params: { sessionId } } as any)}>停止</Button>
                    </div>
                ) : undefined}
                contentClassName="space-y-3"
                footer={(status === 'done' || status === 'error' || status === 'aborted') && references.length > 0 ? (
                    <div>
                        <div className="text-sm font-medium mb-2">References</div>
                        <ol className="list-decimal pl-4 space-y-1">
                            {references.map((ref) => (
                                <li key={ref.key} className="text-xs">
                                    <span>{formatReference({ bib: ref.bib, key: ref.key, paper: ref.paper })}</span>
                                </li>
                            ))}
                        </ol>
                    </div>
                ) : undefined}
            >
                <Markdown text={rendered} />
            </StreamCard>

            {/* {(finalOutlineText && status === 'done') ? (
                <StreamCard
                    title="报告 · 大纲（最终拼接）"
                    status={'done' as any}
                    headerVariant="purple"
                >
                    <Markdown text={finalOutlineText} />
                </StreamCard>
            ) : null} */}
        </div>
    );
};

