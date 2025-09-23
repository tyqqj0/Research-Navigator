"use client";

import React from 'react';
import { useSessionStore } from '../data-access/session-store';
import { useCollectionStore } from '@/features/literature/data-access';
import { Target, Layers, FileText, Rocket, Network, Loader2, CheckCircle2 } from 'lucide-react';

export const SessionStatusDetails: React.FC<{ sessionId: string; className?: string }> = ({ sessionId, className }) => {
    const session = useSessionStore(s => s.sessions.get(sessionId));
    const collectionId = session?.linkedCollectionId || null;
    const collection = useCollectionStore(s => (collectionId ? s.getCollection(collectionId) : undefined));
    const meta: any = (session as any)?.meta || {};
    const directionConfirmed = Boolean(meta?.direction?.confirmed);
    const awaitingDirection = Boolean(meta?.direction?.awaitingDecision);
    const expansion: any = meta?.expansion || {};
    const graphId: string | undefined = meta?.graphId;
    const graph: any = meta?.graph || {};
    const reportStage: string | undefined = meta?.stage;
    const collectionCount = Array.isArray(collection?.paperIds) ? collection!.paperIds.length : undefined;

    return (
        <div className={className}>
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
    );
};

export default SessionStatusDetails;


