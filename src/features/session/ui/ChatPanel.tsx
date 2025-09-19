"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useSessionStore } from '../data-access/session-store';
import type { SessionId } from '../data-access/types';
import { commandBus } from '../runtime/command-bus';

interface ChatPanelProps {
    sessionId: SessionId;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ sessionId }) => {
    const messages = useSessionStore(s => s.getMessages(sessionId));
    const [userInput, setUserInput] = React.useState('');
    const [feedback, setFeedback] = React.useState('');

    const sendUserMessage = async () => {
        const text = userInput.trim();
        if (!text) return;
        await commandBus.dispatch({ id: crypto.randomUUID(), type: 'SendMessage', ts: Date.now(), params: { sessionId, text } } as any);
        setUserInput('');
    };

    const proposeDirection = async () => {
        const text = userInput.trim();
        if (!text) return;
        await commandBus.dispatch({ id: crypto.randomUUID(), type: 'ProposeDirection', ts: Date.now(), params: { sessionId, userQuery: text } } as any);
    };

    const decide = async (action: 'confirm' | 'refine' | 'cancel') => {
        await commandBus.dispatch({ id: crypto.randomUUID(), type: 'DecideDirection', ts: Date.now(), params: { sessionId, action, feedback: feedback.trim() || undefined } } as any);
        if (action !== 'refine') setFeedback('');
    };

    const initCollection = async () => {
        await commandBus.dispatch({ id: crypto.randomUUID(), type: 'InitCollection', ts: Date.now(), params: { sessionId } } as any);
    };
    const startExpansion = async () => {
        await commandBus.dispatch({ id: crypto.randomUUID(), type: 'StartExpansion', ts: Date.now(), params: { sessionId } } as any);
    };
    const stopExpansion = async () => {
        await commandBus.dispatch({ id: crypto.randomUUID(), type: 'StopExpansion', ts: Date.now(), params: { sessionId } } as any);
    };

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="py-2">
                <CardTitle className="text-sm">对话</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 p-0 flex flex-col">
                <div className="flex-1 overflow-auto divide-y">
                    {messages.map(m => (
                        <div key={m.id} className="p-3 text-sm">
                            <div className="text-xs text-muted-foreground mb-1">{m.role} · {new Date(m.createdAt).toLocaleTimeString()}</div>
                            <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                        </div>
                    ))}
                    {messages.length === 0 && (
                        <div className="p-4 text-sm text-muted-foreground">还没有消息，输入内容试试</div>
                    )}
                </div>

                <div className="border-t p-3 space-y-2">
                    <Input placeholder="输入问题或方向（用于提案）" value={userInput} onChange={(e) => setUserInput(e.target.value)} />
                    <div className="flex gap-2">
                        <Button size="sm" onClick={sendUserMessage}>发送</Button>
                        <Button size="sm" variant="secondary" onClick={proposeDirection}>生成方向提案</Button>
                        <Button size="sm" variant="outline" onClick={initCollection}>初始化集合</Button>
                        <Button size="sm" variant="outline" onClick={startExpansion}>开始扩展</Button>
                        <Button size="sm" variant="destructive" onClick={stopExpansion}>停止扩展</Button>
                    </div>
                    <div className="space-y-2">
                        <Textarea placeholder="细化反馈（可选）" value={feedback} onChange={(e) => setFeedback(e.target.value)} className="min-h-[60px]" />
                        <div className="flex gap-2">
                            <Button size="sm" onClick={() => decide('confirm')}>确认</Button>
                            <Button size="sm" variant="secondary" onClick={() => decide('refine')}>细化</Button>
                            <Button size="sm" variant="outline" onClick={() => decide('cancel')}>取消</Button>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default ChatPanel;


