"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useSessionStore } from '../data-access/session-store';
import type { SessionId } from '../data-access/types';
import { commandBus } from '@/features/session/runtime/command-bus';
import { Markdown } from '@/components/ui/markdown';
import { DirectionProposalCard } from './DirectionProposalCard';

interface ChatPanelProps {
    sessionId: SessionId;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ sessionId }) => {
    const messages = useSessionStore(s => s.getMessages(sessionId));
    const session = useSessionStore(s => s.sessions.get(sessionId));
    const [userInput, setUserInput] = React.useState('');
    const [deep, setDeep] = React.useState<boolean>(() => {
        try {
            const s = (useSessionStore.getState() as any).sessions.get(sessionId);
            return Boolean(s?.meta?.deepResearchEnabled);
        } catch { return false; }
    });

    const sendUserMessage = async () => {
        const text = userInput.trim();
        if (!text) return;
        await commandBus.dispatch({ id: crypto.randomUUID(), type: 'SendMessage', ts: Date.now(), params: { sessionId, text } } as any);
        setUserInput('');
    };

    const toggleDeep = async (enabled: boolean) => {
        setDeep(enabled);
        await commandBus.dispatch({ id: crypto.randomUUID(), type: 'ToggleDeepResearch', ts: Date.now(), params: { sessionId, enabled } } as any);
    };

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="py-2 flex items-center justify-between">
                <CardTitle className="text-sm">对话{(session?.meta as any)?.stage === 'collection' ? ' · 集合阶段' : ''}</CardTitle>
                {/* <DeepResearchPill enabled={deep} onToggle={toggleDeep} />=-0 */}
            </CardHeader>
            <CardContent className="flex-1 min-h-0 p-0 flex flex-col">
                <div className="flex-1 overflow-auto divide-y">
                    {messages.map(m => (
                        <div key={m.id} className="p-3 text-sm">
                            <div className="text-xs text-muted-foreground mb-1">{m.role} · {new Date(m.createdAt).toLocaleTimeString()}</div>
                            {m.id.startsWith('proposal_') ? (
                                <DirectionProposalCard content={m.content} />
                            ) : (
                                <Markdown text={m.content} />
                            )}
                        </div>
                    ))}
                    {/* 决策任务卡：当等待决定时渲染卡片 */}
                    {!!(session as any)?.meta?.direction?.awaitingDecision && (
                        <div className="p-3">
                            <DecisionCard sessionId={sessionId} />
                        </div>
                    )}
                    {messages.length === 0 && (
                        <div className="p-4 text-sm text-muted-foreground">还没有消息，输入内容试试</div>
                    )}
                </div>

                <ComposerBar value={userInput} onChange={setUserInput} onSend={sendUserMessage} deep={deep} onToggleDeep={toggleDeep} />
            </CardContent>
        </Card>
    );
};

export default ChatPanel;
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
}> = ({ value, onChange, onSend, deep, onToggleDeep }) => {
    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
    };
    return (
        <div className="border-t p-3">
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
                    <span className="i-lucide-search w-3 h-3" />
                    <span>Deep Research</span>
                </button>
                <Input
                    className="pl-32 pr-14"
                    placeholder="输入你的问题（普通对话）或让我们找到研究方向"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={onKeyDown}
                />
                <Button size="sm" className="absolute right-2" onClick={onSend}>
                    <span className="i-lucide-send w-4 h-4" />
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
        <div className="border rounded-md p-3 space-y-2 bg-muted/30">
            <div className="text-xs text-muted-foreground">需要决定</div>
            <div className="text-sm font-medium">是否确认当前研究方向？</div>
            <Input placeholder="如需细化，可输入补充/反馈" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
            <div className="flex gap-2">
                <Button size="sm" onClick={onConfirm}>确认</Button>
                <Button size="sm" variant="secondary" onClick={onRefine}>细化</Button>
                <Button size="sm" variant="ghost" onClick={onCancel}>取消</Button>
            </div>
        </div>
    );
};

