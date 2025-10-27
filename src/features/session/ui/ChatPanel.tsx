"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MessageComposer } from '@/components/ui';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useSessionStore } from '../data-access/session-store';
import type { SessionId, ArtifactRef } from '../data-access/types';
import { commandBus } from '@/features/session/runtime/command-bus';
import { Markdown } from '@/components/ui/markdown';
import { StreamMarkdown } from '@/components/ui/StreamMarkdown';
import { ArchiveManager } from '@/lib/archive/manager';
import { useLiteratureStore } from '@/features/literature/data-access/stores';
const getRepo = () => ArchiveManager.getServices().sessionRepository;
import { DirectionProposalCard } from './DirectionProposalCard';
import { StageCard } from './StageCard';
// import { runtimeConfig } from '@/features/session/runtime/runtime-config';
import { StreamCard } from '@/components/ui';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronLeft, X, Search, Send, AtSign, BookOpen, FileText, FileStack, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { literatureDataAccess } from '@/features/literature/data-access';
// import { SessionStatusStrip } from './SessionStatusStrip';
import { SessionStageIndicator } from './SessionStageIndicator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface ChatPanelProps {
    sessionId: SessionId;
    onOpenDetail?: (paperId: string) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ sessionId, onOpenDetail }) => {
    const getMessages = useSessionStore(s => s.getMessages);
    const messages = getMessages(sessionId);
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
    const [reportsOpen, setReportsOpen] = React.useState(false);
    const meta: any = (session as any)?.meta || {};
    // Keep deep in sync with store updates
    React.useEffect(() => {
        try {
            const s = (useSessionStore.getState() as any).sessions.get(sessionId);
            const v = Boolean(s?.meta?.deepResearchEnabled);
            setDeep(v);
        } catch { /* ignore */ }
    }, [session?.meta]);

    // Auto-attach the final report as a selected reference when report completes
    const autoAttachedReportsRef = React.useRef<Set<string>>(new Set());
    React.useEffect(() => {
        // Find the last report message in the message list
        const lastReportMsg = [...(messages || [])].reverse().find(m => m.id.startsWith('report_'));
        if (!lastReportMsg) return;
        const reportMeta = (meta.report || {})[lastReportMsg.id] || {};
        const finalId: string | undefined = reportMeta.finalArtifactId;
        if (!finalId) return;
        const key = `report_final:${finalId}`;
        const exists = selectedRefs.some(r => r.kind === 'report_final' && String(r.id) === String(finalId));
        if (!exists && !autoAttachedReportsRef.current.has(key)) {
            setSelectedRefs(prev => [...prev, { kind: 'report_final', id: finalId }]);
            autoAttachedReportsRef.current.add(key);
        }
    }, [meta.report, messages]);

    // Mentions state (for MessageComposer)
    const [mentionOpen, setMentionOpen] = React.useState(false);
    const [mentionQuery, setMentionQuery] = React.useState('');
    const [litResults, setLitResults] = React.useState<any[]>([]);
    const [repResults, setRepResults] = React.useState<any[]>([]);
    const [mentionLoading, setMentionLoading] = React.useState(false);

    // Debounced search for mentions (local library + reports)
    React.useEffect(() => {
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
        const lastAt = userInput.lastIndexOf('@');
        if (lastAt >= 0) {
            let end = lastAt + 1;
            while (end < userInput.length && !/\s/.test(userInput[end])) end++;
            const newVal = (userInput.slice(0, lastAt) + userInput.slice(end)).replace(/\s+$/, '');
            setUserInput(newVal);
        }
        setMentionOpen(false);
        setMentionQuery('');
    };

    // Remove "新一轮研究" button behavior from ChatPanel; new round will be driven by deep toggle + next message

    const sendUserMessage = async () => {
        const text = userInput.trim();
        if (!text) return;
        await commandBus.dispatch({ id: crypto.randomUUID(), type: 'SendMessage', ts: Date.now(), params: { sessionId, text }, inputRefs: selectedRefs } as any);
        setUserInput('');
        // 如果 Deep 模式开启且方向未确认，chat.orchestrator 不会生成普通回复；direction.supervisor 会用这条消息触发提案
    };

    const toggleDeep = async (enabled: boolean) => {
        setDeep(enabled);
        await commandBus.dispatch({ id: crypto.randomUUID(), type: 'ToggleDeepResearch', ts: Date.now(), params: { sessionId, enabled } } as any);
    };

    const isOpen = Boolean((session as any)?.meta?.graphPanelOpen);
    const lastUserText = React.useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'user') return messages[i].content || '';
        }
        return '';
    }, [messages]);
    const hasQuery = (userInput.trim() || lastUserText.trim()).length > 0;
    const directionConfirmed = Boolean(meta?.direction?.confirmed);
    const canResumeProposal = Boolean(deep && !directionConfirmed && !Boolean(meta?.direction?.awaitingDecision) && lastUserText.trim());
    const onResumeProposal = async () => {
        if (!canResumeProposal) return;
        try {
            (window as any).__diagMark?.('cmd:ProposeDirection:dispatch', { sessionId });
        } catch { /* noop */ }
        await commandBus.dispatch({ id: crypto.randomUUID(), type: 'ProposeDirection', ts: Date.now(), params: { sessionId, userQuery: lastUserText } } as any);
    };
    const awaitingDecision = Boolean(meta?.direction?.awaitingDecision);
    const awaitingClarification = Boolean(meta?.direction?.awaitingClarification);
    // Helpers for reference chip labels
    const getLiterature = useLiteratureStore(s => s.getLiterature);
    const [reportTitles, setReportTitles] = React.useState<Record<string, string>>({});
    React.useEffect(() => {
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
    const formatRefLabel = React.useCallback((r: ArtifactRef): string => {
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
    }, [getLiterature, reportTitles]);
    const removeRef = (ref: ArtifactRef) => {
        const key = `${ref.kind}:${ref.id}`;
        setSelectedRefs(prev => prev.filter(r => `${r.kind}:${r.id}` !== key));
    };
    return (
        // <div></div>
        <Card className="relative h-full md:h-[calc(100vh-5rem)] flex flex-col">
            {/* 右上角书签形按钮：收起为向左箭头，展开为小叉（仅桌面端显示） */}
            <button
                type="button"
                onClick={() => toggleGraphPanel(sessionId)}
                className={cn(
                    'hidden md:flex bookmark-shape icon-button absolute right-0 top-3 translate-x-1/2 z-20 items-center justify-center',
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
                    <div className="flex items-center gap-2">
                        <Dialog open={reportsOpen} onOpenChange={setReportsOpen}>
                            <DialogTrigger asChild>
                                <Button size="sm" variant="secondary" title="查看报告">
                                    <FileStack className="w-4 h-4 mr-1" />
                                    报告
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-5xl max-h-[80vh] overflow-hidden">
                                <DialogHeader>
                                    <DialogTitle>报告列表</DialogTitle>
                                </DialogHeader>
                                <div className="h-[65vh] overflow-hidden">
                                    <ReportsViewer onClose={() => setReportsOpen(false)} />
                                </div>
                            </DialogContent>
                        </Dialog>
                        <SessionStageIndicator sessionId={sessionId} />
                    </div>
                </div>
                {/* Awaiting decision hint */}
                {(awaitingDecision || awaitingClarification) && (
                    <div className="px-2 py-1 text-[12px] rounded bg-blue-50 text-blue-700 border border-blue-200">
                        {awaitingClarification ? '需要您的补充信息：请先在下方回答问题，以便继续生成方向提案。' : '已生成“研究方向提案”，请在下方“需要决定”卡片中确认或细化，以继续下一步。'}
                    </div>
                )}
                {/* {!awaitingDecision && canResumeProposal && (
                    <div className="px-2 py-1 text-[12px] rounded bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-between">
                        <div>Deep 模式开启：可基于上次消息恢复“方向提案”。</div>
                        <Button size="sm" variant="secondary" onClick={onResumeProposal}>恢复提案</Button>
                    </div>
                )} */}
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
                                ) : m.id.startsWith('clarify_') ? (
                                    <ClarificationCard sessionId={sessionId} content={m.content} />
                                ) : m.id.startsWith('graph_thinking_') ? (
                                    <GraphThinkingCard status={m.status} content={m.content} />
                                ) : m.id.startsWith('plan_') ? (
                                    <SearchThinkingCard sessionId={sessionId} status={m.status} content={m.content} />
                                ) : m.id.startsWith('cands_') ? (
                                    <SearchCandidatesCard sessionId={sessionId} artifactId={m.id.replace('cands_', '')} />
                                ) : m.id.startsWith('graph_decision_') ? (
                                    <GraphDecisionCard sessionId={sessionId} />
                                ) : m.id.startsWith('report_') ? (
                                    <ReportCard sessionId={sessionId} messageId={m.id} status={m.status} content={m.content} />
                                ) : m.role === 'assistant' ? (
                                    <StreamMarkdown source={{ type: 'message', sessionId, messageId: m.id }} />
                                ) : (
                                    <Markdown text={m.content} />
                                )}
                            </div>
                        );
                    })}
                    {/* 操作按钮已上移到头部 */}
                    {/* 决策任务卡：当等待决定时渲染卡片 */}
                    {awaitingDecision && (
                        <div className="p-3">
                            <DecisionCard sessionId={sessionId} />
                        </div>
                    )}
                    {awaitingClarification && (
                        <div className="p-3">
                            <ClarificationInputCard sessionId={sessionId} />
                        </div>
                    )}
                    {/* 取消底部常驻的 GraphDecisionCard，改为消息驱动 */}
                    {messages.length === 0 && (
                        <div className="p-4 text-sm text-muted-foreground">还没有消息，输入内容试试</div>
                    )}
                </div>

                <div className="p-3">
                    <div className="max-w-2xl md:max-w-3xl mx-auto">
                        <MessageComposer
                            value={userInput}
                            onChange={setUserInput}
                            onSend={sendUserMessage}
                            placeholder={awaitingDecision ? '已生成方向提案：请先在上方确认…' : '输入你的问题（普通对话）或让我们找到研究方向'}
                            variant="chat"
                            density="compact"
                            sendKeyScheme="enterToSend"
                            minRows={1}
                            maxRows={8}
                            textareaClassName="text-sm leading-5"
                            leftTools={(
                                <button
                                    type="button"
                                    title="Deep Research"
                                    aria-label="Deep Research"
                                    onClick={() => toggleDeep(!deep)}
                                    className={cn(
                                        'inline-flex items-center gap-1.5 rounded-full text-xs px-2.5 py-1 border transition-all',
                                        deep
                                            ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 shadow-sm'
                                            : 'bg-white/80 dark:bg-slate-900/60 text-muted-foreground border-border hover:bg-white'
                                    )}
                                >
                                    <Search className="w-3 h-3" />
                                    <span>Deep Research</span>
                                </button>
                            )}
                            rightTools={(
                                <Button size="sm" className="h-8 w-8 rounded-full p-0" onClick={sendUserMessage} title="发送">
                                    <Send className="w-4 h-4" />
                                </Button>
                            )}
                            helperText={<span className="text-xs text-muted-foreground hidden md:inline">按 <b>Enter</b> 发送，<b>Shift+Enter</b> 换行</span>}
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
                        {/* Selected references chips */}
                        {selectedRefs.length > 0 && (
                            <div className="mt-2 px-1 flex items-center gap-2 flex-wrap">
                                {selectedRefs.map((r) => (
                                    <Badge key={`${r.kind}:${r.id}`} variant="secondary" className="flex items-center gap-0">
                                        <button
                                            type="button"
                                            className="inline-flex items-center gap-1 hover:underline"
                                            title={formatRefLabel(r)}
                                            onClick={() => { if (r.kind === 'literature' && onOpenDetail) onOpenDetail(String(r.id)); }}
                                        >
                                            {r.kind === 'literature' ? <BookOpen className="w-3 h-3" /> : r.kind === 'report_final' ? <FileText className="w-3 h-3" /> : null}
                                            {formatRefLabel(r)}
                                        </button>
                                        <button type="button" className="ml-1 hover:text-red-600" onClick={() => removeRef(r)}>
                                            <X className="w-3 h-3" />
                                        </button>
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default ChatPanel;

const SearchThinkingCard: React.FC<{ sessionId: SessionId; status: any; content: string }> = ({ sessionId, status, content }) => {
    const onRetry = async () => {
        try {
            await commandBus.dispatch({ id: crypto.randomUUID(), type: 'StartExpansion', ts: Date.now(), params: { sessionId } } as any);
        } catch { /* ignore */ }
    };
    return (
        <StreamCard
            title="思考"
            status={status}
            headerVariant="purple"
            headerRight={(status === 'error' || status === 'aborted') ? (
                <Button size="sm" variant="secondary" onClick={onRetry}>重试</Button>
            ) : undefined}
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
                const a = await getRepo().getArtifact(artifactId);
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
                                    <div className="text-sm font-medium truncate"><b>{c.title || c.sourceUrl}</b></div>
                                    <div className="text-[11px] text-muted-foreground truncate">{c.venue}</div>
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
    awaitingDecision?: boolean;
    selectedRefs: ArtifactRef[];
    onRefsChange: (refs: ArtifactRef[]) => void;
    onOpenDetail?: (paperId: string) => void;
}> = ({ value, onChange, onSend, deep, onToggleDeep, awaitingDecision, selectedRefs, onRefsChange, onOpenDetail }) => {
    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Enter 发送，Shift+Enter 换行，忽略输入法组合键
        if (e.key === 'Enter' && !e.shiftKey) {
            const anyEvt = e.nativeEvent as any;
            if (anyEvt && anyEvt.isComposing) return;
            e.preventDefault();
            onSend();
        }
    };

    const [mentionOpen, setMentionOpen] = React.useState(false);
    const [query, setQuery] = React.useState('');
    const [litResults, setLitResults] = React.useState<any[]>([]);
    const [repResults, setRepResults] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(false);
    const getLiterature = useLiteratureStore(s => s.getLiterature);

    // Cache report titles for chips to avoid async rendering glitches
    const [reportTitles, setReportTitles] = React.useState<Record<string, string>>({});
    React.useEffect(() => {
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

    // Debounced search for mentions (local library + reports)
    React.useEffect(() => {
        let cancelled = false;
        const q = query.trim();
        if (!mentionOpen) return;
        const t = setTimeout(async () => {
            if (!q) { setLitResults([]); setRepResults([]); return; }
            setLoading(true);
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
            } finally { if (!cancelled) setLoading(false); }
        }, 250);
        return () => { cancelled = true; clearTimeout(t); };
    }, [query, mentionOpen]);

    // Auto-open mentions when typing '@' and sync token
    const handleInputChange = (next: string) => {
        onChange(next);
        const lastAt = next.lastIndexOf('@');
        if (lastAt >= 0) {
            setMentionOpen(true);
            const token = next.slice(lastAt + 1).split(/\s/)[0] || '';
            setQuery(token);
        } else {
            if (mentionOpen) setMentionOpen(false);
            setQuery('');
        }
    };

    const addRef = (ref: ArtifactRef) => {
        const key = `${ref.kind}:${ref.id}`;
        const setKeys = new Set(selectedRefs.map(r => `${r.kind}:${r.id}`));
        if (setKeys.has(key)) return;
        onRefsChange([...selectedRefs, ref]);
    };
    const handleSelectRef = (ref: ArtifactRef) => {
        addRef(ref);
        // remove the latest @token from input and close popover
        const lastAt = value.lastIndexOf('@');
        if (lastAt >= 0) {
            let end = lastAt + 1;
            while (end < value.length && !/\s/.test(value[end])) end++;
            const newVal = (value.slice(0, lastAt) + value.slice(end)).replace(/\s+$/, '');
            onChange(newVal);
        }
        setMentionOpen(false);
        setQuery('');
    };
    const removeRef = (ref: ArtifactRef) => {
        const key = `${ref.kind}:${ref.id}`;
        onRefsChange(selectedRefs.filter(r => `${r.kind}:${r.id}` !== key));
    };

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

    return (
        <div className="p-3">
            {/* Selected references chips */}
            {selectedRefs.length > 0 && (
                <div className="px-2 pb-2 flex items-center gap-2 flex-wrap">
                    {selectedRefs.map((r) => (
                        <Badge key={`${r.kind}:${r.id}`} variant="secondary" className="flex items-center gap-0">
                            <button
                                type="button"
                                className="inline-flex items-center gap-1 hover:underline"
                                title={formatRefLabel(r)}
                                onClick={() => { if (r.kind === 'literature' && onOpenDetail) onOpenDetail(String(r.id)); }}
                            >
                                {r.kind === 'literature' ? <BookOpen className="w-3 h-3" /> : r.kind === 'report_final' ? <FileText className="w-3 h-3" /> : null}
                                {formatRefLabel(r)}
                            </button>
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
                        'absolute left-2 top-1 inline-flex items-center gap-1.5 rounded-full text-xs px-2.5 py-0.5 border shadow-sm',
                        deep ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white/80 dark:bg-slate-900/60 text-muted-foreground border-border'
                    )}
                >
                    <Search className="w-3 h-3" />
                    <span>Deep Research</span>
                </button>
                <Textarea
                    className="pl-32 pr-24 rounded-2xl min-h-[44px] h-11 max-h-40 resize-none py-2.5"
                    placeholder={awaitingDecision ? '已生成方向提案：请先在上方确认…' : '输入你的问题（普通对话）或让我们找到研究方向'}
                    value={value}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={onKeyDown}
                    onDragOver={(e) => {
                        if (Array.from(e.dataTransfer.types).includes('application/x-paper-ids')) {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'copy';
                        }
                    }}
                    onDrop={(e) => {
                        e.preventDefault();
                        const raw = e.dataTransfer.getData('application/x-paper-ids');
                        if (!raw) return;
                        try {
                            const ids = JSON.parse(raw) as string[];
                            if (Array.isArray(ids)) {
                                ids.forEach((pid) => addRef({ kind: 'literature', id: pid }));
                            }
                        } catch { /* ignore */ }
                    }}
                />
                <Popover open={mentionOpen} onOpenChange={setMentionOpen}>
                    <PopoverTrigger asChild>
                        <Button size="sm" variant="ghost" className="absolute right-12 top-1" title="添加参考 (@)" onClick={() => setMentionOpen(!mentionOpen)}>
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
                                                    onClick={() => handleSelectRef({ kind: 'literature', id: it.paperId })}
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
                                                    onClick={() => handleSelectRef({ kind: 'report_final', id: a.id })}
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
                <Button size="sm" className="absolute right-2 top-1 h-8 w-8 rounded-full p-0" onClick={onSend} title="发送">
                    <Send className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
};


const DecisionCard: React.FC<{ sessionId: SessionId }> = ({ sessionId }) => {
    const [submitting, setSubmitting] = React.useState(false);
    const [feedback, setFeedback] = React.useState('');
    const onConfirm = async () => {
        if (submitting) return;
        setSubmitting(true);
        try {
            await commandBus.dispatch({ id: crypto.randomUUID(), type: 'DecideDirection', ts: Date.now(), params: { sessionId, action: 'confirm' } } as any);
        } finally { setTimeout(() => setSubmitting(false), 1200); }
    };
    const onRefine = async () => {
        if (submitting) return;
        setSubmitting(true);
        try {
            await commandBus.dispatch({ id: crypto.randomUUID(), type: 'DecideDirection', ts: Date.now(), params: { sessionId, action: 'refine', feedback } } as any);
            setFeedback('');
        } finally { setTimeout(() => setSubmitting(false), 1200); }
    };
    const onCancel = async () => {
        if (submitting) return;
        setSubmitting(true);
        try {
            await commandBus.dispatch({ id: crypto.randomUUID(), type: 'DecideDirection', ts: Date.now(), params: { sessionId, action: 'cancel' } } as any);
        } finally { setTimeout(() => setSubmitting(false), 600); }
    };
    return (
        <Card className="border rounded-md">
            <CardHeader className="py-2" variant="blue">
                <CardTitle className="text-sm">需要决定</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                <div className="text-sm">是否确认当前研究方向？</div>
                <Textarea placeholder="如需细化，可输入补充/反馈（可留空直接确认）" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
                <div className="flex gap-2">
                    <Button size="sm" onClick={onConfirm} disabled={submitting}>确认</Button>
                    <Button size="sm" variant="secondary" onClick={onRefine} disabled={submitting || !feedback.trim()}>细化</Button>
                    <Button size="sm" variant="ghost" onClick={onCancel} disabled={submitting}>取消</Button>
                </div>
            </CardContent>
        </Card>
    );
};

const ClarificationCard: React.FC<{ sessionId: SessionId; content: string }> = ({ sessionId, content }) => {
    return (
        <Card className="border rounded-md">
            <CardHeader className="py-2" variant="orange">
                <CardTitle className="text-sm">需要补充信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                <Markdown text={content} />
            </CardContent>
        </Card>
    );
};

const ClarificationInputCard: React.FC<{ sessionId: SessionId }> = ({ sessionId }) => {
    const [text, setText] = React.useState('');
    const [submitting, setSubmitting] = React.useState(false);
    const onSubmit = async () => {
        const t = text.trim();
        if (!t || submitting) return;
        setSubmitting(true);
        try {
            await commandBus.dispatch({ id: crypto.randomUUID(), type: 'DecideDirection', ts: Date.now(), params: { sessionId, action: 'refine', feedback: t } } as any);
            setText('');
        } finally { setTimeout(() => setSubmitting(false), 800); }
    };
    return (
        <Card className="border rounded-md">
            <CardHeader className="py-2" variant="orange">
                <CardTitle className="text-sm">请回答以上问题以继续</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                <Textarea placeholder="请补充目标/范围/对象/时间/来源/输出等信息…" value={text} onChange={(e) => setText(e.target.value)} />
                <div className="flex gap-2">
                    <Button size="sm" onClick={onSubmit} disabled={submitting || !text.trim()}>提交补充</Button>
                </div>
            </CardContent>
        </Card>
    );
};

const GraphDecisionCard: React.FC<{ sessionId: SessionId }> = ({ sessionId }) => {
    const session = useSessionStore(s => s.sessions.get(sessionId));
    const info = (session as any)?.meta?.graphDecision || {};
    const locked = Boolean((session as any)?.meta?.graphDecision?.locked);
    const [submitting, setSubmitting] = React.useState(false);
    const onConfirm = async () => {
        if (submitting) return;
        setSubmitting(true);
        try {
            (window as any).__diagMark?.('cmd:GenerateReport:dispatch', { sessionId });
            console.debug('[ui][cmd] GenerateReport', { sessionId });
            toast.message('已提交：生成报告');
        } catch { /* noop */ }
        await commandBus.dispatch({ id: crypto.randomUUID(), type: 'GenerateReport', ts: Date.now(), params: { sessionId } } as any);
        // 短暂保持提交中的视觉反馈；随后将由事件驱动 UI 状态
        setTimeout(() => setSubmitting(false), 1500);
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
                    <Button size="sm" onClick={onConfirm} disabled={locked || submitting}>
                        {submitting ? (
                            <span className="inline-flex items-center gap-1">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> 正在提交…
                            </span>
                        ) : '确认并生成报告'}
                    </Button>
                </div>
                {(submitting || locked) && (
                    <div className="text-xs text-muted-foreground">
                        {submitting ? '已提交，正在准备生成报告…' : '已锁定：正在生成报告…'}
                    </div>
                )}
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
                return key && allKnownKeys.has(key) ? `[@${key}]` : '';
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
            return '';
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
            {outlineStatus ? (
                <StageCard
                    sessionId={sessionId}
                    stage="outline"
                    messageId={messageId}
                    title="报告 · 大纲"
                    status={outlineStatus as any}
                    headerVariant="purple"
                >
                    <StreamMarkdown
                        source={{ type: 'selector', get: () => ({ text: outlineText || '', running: outlineStatus === 'streaming' }) }}
                        pendingHint="⏳ 正在生成大纲…"
                    />
                </StageCard>
            ) : null}
            {expandStatus ? (
                <StageCard
                    sessionId={sessionId}
                    stage="expand"
                    messageId={messageId}
                    title="报告 · 扩写"
                    status={expandStatus as any}
                    headerVariant="purple"
                >
                    <StreamMarkdown
                        source={{ type: 'selector', get: () => ({ text: draftText || '', running: expandStatus === 'streaming' }) }}
                        pendingHint="⏳ 正在扩写…"
                    />
                </StageCard>
            ) : null}
            {abstractStatus ? (
                <StageCard
                    sessionId={sessionId}
                    stage="abstract"
                    messageId={messageId}
                    title="报告 · 摘要"
                    status={abstractStatus as any}
                    headerVariant="purple"
                >
                    <StreamMarkdown
                        source={{ type: 'selector', get: () => ({ text: abstractText || '', running: abstractStatus === 'streaming' }) }}
                        pendingHint="⏳ 正在生成摘要…"
                    />
                </StageCard>
            ) : null}

            <StreamCard
                title="报告"
                status={status}
                headerVariant="blue"
                headerRight={(status === 'streaming' || status === 'error' || status === 'aborted') ? (
                    <div className="flex items-center gap-2">
                        {status === 'streaming' ? (
                            <>
                                <span className="text-xs text-muted-foreground">大纲 / 扩写 / 摘要</span>
                                <Button size="sm" variant="ghost" onClick={() => commandBus.dispatch({ id: crypto.randomUUID(), type: 'StopReport', ts: Date.now(), params: { sessionId } } as any)}>停止</Button>
                            </>
                        ) : status === 'aborted' ? (
                            <>
                                <Button size="sm" onClick={() => commandBus.dispatch({ id: crypto.randomUUID(), type: 'ResumeReport', ts: Date.now(), params: { sessionId } } as any)}>继续</Button>
                                <Button size="sm" variant="secondary" onClick={() => commandBus.dispatch({ id: crypto.randomUUID(), type: 'GenerateReport', ts: Date.now(), params: { sessionId } } as any)}>重新生成</Button>
                            </>
                        ) : (
                            <Button size="sm" variant="secondary" onClick={() => commandBus.dispatch({ id: crypto.randomUUID(), type: 'GenerateReport', ts: Date.now(), params: { sessionId } } as any)}>重试生成</Button>
                        )}
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
                <StreamMarkdown
                    source={{ type: 'inline', text: rendered || '', running: status === 'streaming' }}
                />
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

const ReportsViewer: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
    const [loading, setLoading] = React.useState(true);
    const [reports, setReports] = React.useState<any[]>([]);
    const [activeId, setActiveId] = React.useState<string | null>(null);
    const [activeContent, setActiveContent] = React.useState<string>('');

    React.useEffect(() => {
        let cancelled = false;
        const run = async () => {
            setLoading(true);
            try {
                const list = await getRepo().listReports();
                if (cancelled) return;
                setReports(list || []);
                const first = list && list[0];
                if (first) {
                    setActiveId(first.id);
                    setActiveContent(String(first.data || ''));
                }
            } finally { if (!cancelled) setLoading(false); }
        };
        void run();
        return () => { cancelled = true; };
    }, []);

    const onPick = async (id: string) => {
        setActiveId(id);
        try {
            const a = await getRepo().getArtifact(id);
            setActiveContent(String(a?.data || ''));
        } catch { /* ignore */ }
    };

    return (
        <div className="grid grid-cols-12 gap-3 h-full">
            <div className="col-span-4 border rounded p-2 min-h-[420px] h-full overflow-hidden">
                <div className="text-sm font-medium mb-2">全部报告</div>
                <div className="space-y-1 h-full overflow-auto pr-1">
                    {loading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-5/6" />
                            <Skeleton className="h-4 w-2/3" />
                            <Skeleton className="h-4 w-4/5" />
                        </div>
                    ) : (reports.length === 0 ? (
                        <div className="text-xs text-muted-foreground">暂无报告</div>
                    ) : (
                        reports.map(r => (
                            <button
                                key={r.id}
                                type="button"
                                onClick={() => onPick(r.id)}
                                className={cn(
                                    'w-full text-left px-2 py-1 rounded border',
                                    activeId === r.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-muted border-transparent'
                                )}
                            >
                                <div className="text-sm truncate">{String((r.meta || {}).title || r.id)}</div>
                                <div className="text-[11px] text-muted-foreground truncate">{new Date(r.createdAt).toLocaleString()}</div>
                            </button>
                        ))
                    ))}
                </div>
            </div>
            <div className="col-span-8 border rounded p-2 min-h-[420px] h-full overflow-hidden">
                {/* <div className="flex items-center justify-between mb-2"> */}
                {/* <div className="text-sm font-medium">预览</div> */}
                {/* {onClose ? <Button size="sm" variant="ghost" onClick={onClose}>关闭</Button> : null} */}
                {/* </div> */}
                <div className="prose prose-sm max-w-none h-full overflow-auto pr-2">
                    {activeContent ? <Markdown text={activeContent} /> : <div className="text-xs text-muted-foreground">选择左侧报告进行预览</div>}
                </div>
            </div>
        </div>
    );
};

