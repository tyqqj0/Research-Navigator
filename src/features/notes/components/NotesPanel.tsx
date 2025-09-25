"use client";

import React, { useMemo, useState } from 'react';
import { useNotes } from '../hooks/use-notes';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

export function NotesPanel({ paperId }: { paperId: string }) {
    const { notes, isLoading, error, create, update, remove } = useNotes(paperId);
    const [draftTitle, setDraftTitle] = useState('');
    const [draftContent, setDraftContent] = useState('');

    const handleAdd = async () => {
        const content = draftContent.trim();
        if (!content) return;
        await create(content, draftTitle.trim() || undefined);
        setDraftTitle('');
        setDraftContent('');
    };

    const sorted = useMemo(() => notes, [notes]);

    return (
        <div className="h-full p-4 space-y-4">
            <div className="space-y-2">
                <div className="text-sm font-semibold">新建笔记</div>
                <Input placeholder="可选标题" value={draftTitle} onChange={e => setDraftTitle(e.target.value)} />
                <Textarea rows={4} placeholder="用 Markdown 写下你的想法..." value={draftContent} onChange={e => setDraftContent(e.target.value)} />
                <div className="flex justify-end">
                    <Button onClick={handleAdd} disabled={!draftContent.trim()}>添加</Button>
                </div>
            </div>

            <div className="border-t pt-4">
                <div className="text-sm font-semibold mb-2">全部笔记</div>
                {isLoading && <div className="text-xs text-muted-foreground">加载中...</div>}
                {error && <div className="text-xs text-red-600">{error}</div>}
                {sorted.length === 0 && !isLoading ? (
                    <div className="text-xs text-muted-foreground">暂无笔记</div>
                ) : (
                    <div className="space-y-3">
                        {sorted.map(n => (
                            <NoteItem key={n.noteId} id={n.noteId} title={n.title} content={n.contentMarkdown} updatedAt={n.updatedAt} onSave={(t, c) => update(n.noteId, { title: t, contentMarkdown: c })} onDelete={() => remove(n.noteId)} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function NoteItem({ id, title, content, updatedAt, onSave, onDelete }: { id: string; title?: string; content: string; updatedAt?: Date; onSave: (title?: string, content?: string) => void; onDelete: () => void; }) {
    const [editing, setEditing] = useState(false);
    const [t, setT] = useState(title || '');
    const [c, setC] = useState(content || '');

    const handleSave = () => { onSave(t.trim() || undefined, c); setEditing(false); };

    if (!editing) {
        return (
            <div className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium truncate">{title || '无标题'}</div>
                    <div className="flex items-center gap-2">
                        <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>编辑</Button>
                        <Button variant="destructive" size="sm" onClick={onDelete}>删除</Button>
                    </div>
                </div>
                <div className="text-sm whitespace-pre-wrap">{content}</div>
                {updatedAt && (<div className="text-[11px] text-muted-foreground">更新于 {new Date(updatedAt).toLocaleString()}</div>)}
            </div>
        );
    }

    return (
        <div className="rounded-md border p-3 space-y-2">
            <Input placeholder="可选标题" value={t} onChange={e => setT(e.target.value)} />
            <Textarea rows={6} value={c} onChange={e => setC(e.target.value)} />
            <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => { setEditing(false); setT(title || ''); setC(content || ''); }}>取消</Button>
                <Button size="sm" onClick={handleSave}>保存</Button>
            </div>
        </div>
    );
}

export default NotesPanel;


