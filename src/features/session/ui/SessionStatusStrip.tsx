"use client";

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { useSessionStore } from '../data-access/session-store';
import { useCollectionStore } from '@/features/literature/data-access';

export const SessionStatusStrip: React.FC<{ sessionId: string }> = ({ sessionId }) => {
    const session = useSessionStore(s => s.sessions.get(sessionId));
    const collectionId = session?.linkedCollectionId || null;
    const collection = useCollectionStore(s => (collectionId ? s.getCollection(collectionId) : undefined));

    const meta: any = (session as any)?.meta || {};
    const stage: string = meta.stage || (meta.direction?.confirmed ? 'collection' : 'direction');
    const directionConfirmed: boolean = Boolean(meta.direction?.confirmed);
    const awaitingDirection: boolean = Boolean(meta.direction?.awaitingDecision);
    const expansion: any = meta.expansion || {};
    const graphId: string | undefined = meta.graphId;
    const graph: any = meta.graph || {};
    const reportStage: string | undefined = meta.stage;

    const collectionCount = Array.isArray(collection?.paperIds) ? collection!.paperIds.length : undefined;

    return (
        <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="info">阶段：{stage === 'collection' ? '集合' : stage === 'reporting' ? '报告生成' : stage === 'report_done' ? '报告完成' : '方向'}</Badge>
            {awaitingDirection ? (
                <Badge variant="warning">方向：待确认</Badge>
            ) : (
                <Badge variant={directionConfirmed ? 'success' : 'secondary'}>方向：{directionConfirmed ? '已确认' : '未确认'}</Badge>
            )}
            {collectionId ? (
                <Badge variant="outline">集合：{collectionCount !== undefined ? `${collectionCount} 篇` : '已绑定'}</Badge>
            ) : (
                <Badge variant="secondary">集合：未绑定</Badge>
            )}
            {expansion?.running ? (
                <Badge variant="soft">
                    <span className="inline-flex items-center gap-1">
                        <span className="i-lucide-loader-2 animate-spin w-3 h-3" />
                        扩展中{typeof expansion.round === 'number' ? ` · 第 ${expansion.round} 轮` : ''}
                        {typeof expansion.lastAdded === 'number' && typeof expansion.total === 'number' ? ` · +${expansion.lastAdded}/${expansion.total}` : ''}
                    </span>
                </Badge>
            ) : (
                <Badge variant="secondary">扩展：{expansion?.state ? (expansion.state === 'saturated' ? '已饱和' : expansion.state === 'stopped' ? '已停止' : '就绪') : '就绪'}</Badge>
            )}
            {graphId ? (
                graph?.building ? (
                    <Badge variant="soft">
                        <span className="inline-flex items-center gap-1">
                            <span className="i-lucide-rocket animate-pulse w-3 h-3" />
                            图谱：构建中
                        </span>
                    </Badge>
                ) : (
                    <Badge variant="outline">图谱：{typeof graph.nodes === 'number' && typeof graph.edges === 'number' ? `${graph.nodes} 节点 / ${graph.edges} 边` : '就绪'}</Badge>
                )
            ) : (
                <Badge variant="secondary">图谱：未就绪</Badge>
            )}
            {reportStage === 'reporting' && (
                <Badge variant="info">报告：生成中</Badge>
            )}
            {reportStage === 'report_done' && (
                <Badge variant="success">报告：已完成</Badge>
            )}
        </div>
    );
};

export default SessionStatusStrip;


