"use client";

import React from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useSessionStore } from '../data-access/session-store';
import { useCollectionStore } from '@/features/literature/data-access';
import { Target, Layers, FileText, CheckCircle2, Rocket, Network, Loader2 } from 'lucide-react';

type Stage = 'direction' | 'collection' | 'reporting' | 'report_done';

function getStage(meta: any): Stage {
    if (!meta) return 'direction';
    const s = meta.stage as Stage | undefined;
    if (s === 'collection' || s === 'reporting' || s === 'report_done') return s;
    return meta?.direction?.confirmed ? 'collection' : 'direction';
}

function useHoverOpen(delay: number = 120) {
    const [open, setOpen] = React.useState(false);
    const timerRef = React.useRef<number | null>(null);
    const clearTimer = () => { if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null; } };
    const onEnter = () => { clearTimer(); setOpen(true); };
    const onLeave = () => { clearTimer(); timerRef.current = window.setTimeout(() => setOpen(false), delay); };
    React.useEffect(() => () => clearTimer(), []);
    return { open, setOpen, onEnter, onLeave };
}

const stageStyles: Record<Stage, { icon: React.ReactNode; className: string; label: string }> = {
    direction: {
        icon: <Target className="w-4 h-4" />,
        className: 'text-blue-600 bg-blue-50 border-blue-200',
        label: '方向',
    },
    collection: {
        icon: <Layers className="w-4 h-4" />,
        className: 'text-violet-600 bg-violet-50 border-violet-200',
        label: '集合',
    },
    reporting: {
        icon: <FileText className="w-4 h-4" />,
        className: 'text-amber-600 bg-amber-50 border-amber-200',
        label: '报告生成',
    },
    report_done: {
        icon: <CheckCircle2 className="w-4 h-4" />,
        className: 'text-emerald-600 bg-emerald-50 border-emerald-200',
        label: '报告完成',
    },
};

export const SessionStageIndicator: React.FC<{ sessionId: string }> = ({ sessionId }) => {
    const session = useSessionStore(s => s.sessions.get(sessionId));
    const collectionId = session?.linkedCollectionId || null;
    const collection = useCollectionStore(s => (collectionId ? s.getCollection(collectionId) : undefined));
    const meta: any = (session as any)?.meta || {};
    const stage = getStage(meta);
    const { open, setOpen, onEnter, onLeave } = useHoverOpen(120);

    const directionConfirmed = Boolean(meta?.direction?.confirmed);
    const awaitingDirection = Boolean(meta?.direction?.awaitingDecision);
    const expansion: any = meta?.expansion || {};
    const graphId: string | undefined = meta?.graphId;
    const graph: any = meta?.graph || {};
    const reportStage: string | undefined = meta?.stage;
    const collectionCount = Array.isArray(collection?.paperIds) ? collection!.paperIds.length : undefined;

    const style = stageStyles[stage];

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    onMouseEnter={onEnter}
                    onMouseLeave={onLeave}
                    className={cn(
                        'relative inline-flex items-center justify-center w-7 h-7 rounded-full border shadow-sm transition-colors',
                        style.className
                    )}
                    aria-label={`阶段：${style.label}`}
                    title={`阶段：${style.label}`}
                >
                    <div className="relative h-4 w-4">
                        <div key={stage} className="inset-0.2 flex items-center justify-center animate-in fade-in-0 zoom-in-95">
                            {style.icon}
                        </div>
                    </div>
                </button>
            </PopoverTrigger>
            <PopoverContent
                align="end"
                side="bottom"
                sideOffset={8}
                onMouseEnter={onEnter}
                onMouseLeave={onLeave}
                className="w-40 p-0 border-0 shadow-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2"
            >
                <div className="p-3 theme-background-primary">
                    <div className="flex items-center gap-2 mb-2">
                        <span className={cn('inline-flex items-center justify-center w-6 h-6 rounded-full border', style.className)}>
                            {style.icon}
                        </span>
                        <div className="text-sm font-medium">阶段：{style.label}</div>
                    </div>
                    <div className="grid gap-2 text-xs">
                        <div className="flex items-start gap-2">
                            <Target className="w-3.5 h-3.5 mt-0.5 text-blue-600" />
                            <div className="min-w-0">
                                <div className="text-[11px] text-muted-foreground">方向</div>
                                <div>{awaitingDirection ? '待确认' : (directionConfirmed ? '已确认' : '未确认')}</div>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            <Layers className="w-3.5 h-3.5 mt-0.5 text-violet-600" />
                            <div className="min-w-0">
                                <div className="text-[11px] text-muted-foreground">集合</div>
                                <div>{collectionId ? (collectionCount !== undefined ? `${collectionCount} 篇` : '已绑定') : '未绑定'}</div>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            {expansion?.running ? (
                                <Loader2 className="w-3.5 h-3.5 mt-0.5 text-amber-600 animate-spin" />
                            ) : (
                                <Rocket className="w-3.5 h-3.5 mt-0.5 text-amber-600" />
                            )}
                            <div className="min-w-0">
                                <div className="text-[11px] text-muted-foreground">扩展</div>
                                <div>
                                    {expansion?.running ? (
                                        <>
                                            扩展中{typeof expansion.round === 'number' ? ` · 第 ${expansion.round} 轮` : ''}
                                            {typeof expansion.lastAdded === 'number' && typeof expansion.total === 'number' ? ` · +${expansion.lastAdded}/${expansion.total}` : ''}
                                        </>
                                    ) : (
                                        expansion?.state ? (expansion.state === 'saturated' ? '已饱和' : expansion.state === 'stopped' ? '已停止' : '就绪') : '就绪'
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            <Network className="w-3.5 h-3.5 mt-0.5 text-sky-600" />
                            <div className="min-w-0">
                                <div className="text-[11px] text-muted-foreground">图谱</div>
                                <div>
                                    {graphId ? (
                                        graph?.building ? '构建中' : (typeof graph.nodes === 'number' && typeof graph.edges === 'number' ? `${graph.nodes} 节点 / ${graph.edges} 边` : '就绪')
                                    ) : '未就绪'}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            <FileText className="w-3.5 h-3.5 mt-0.5 text-emerald-600" />
                            <div className="min-w-0">
                                <div className="text-[11px] text-muted-foreground">报告</div>
                                <div>{reportStage === 'reporting' ? '生成中' : (reportStage === 'report_done' ? '已完成' : '—')}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
};

export default SessionStageIndicator;


