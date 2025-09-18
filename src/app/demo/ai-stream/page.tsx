"use client";
import React, { useState } from 'react';
import { useTextStream } from '@/lib/ai/streaming/react';

export default function AIStreamDemoPage() {
    const { status, text, error, start, abort, reset } = useTextStream();
    const [prompt, setPrompt] = useState('用三句话介绍Transformer');

    return (
        <div className="p-6 space-y-4">
            <h1 className="text-lg font-semibold">AI Streaming Demo</h1>
            <div className="flex gap-2 items-center">
                <input className="border rounded px-3 py-2 flex-1" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="输入提示词" />
                <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={() => start({ prompt }, { batchingIntervalMs: 32 })} disabled={status === 'running'}>
                    开始
                </button>
                <button className="px-3 py-2 rounded bg-gray-200" onClick={() => abort()} disabled={status !== 'running'}>
                    停止
                </button>
                <button className="px-3 py-2 rounded bg-gray-200" onClick={() => reset()}>
                    重置
                </button>
            </div>
            <div className="text-sm text-muted-foreground">状态：{status}</div>
            {error && <div className="text-sm text-red-600">错误：{error}</div>}
            <div className="p-3 border rounded min-h-[10rem] whitespace-pre-wrap text-sm bg-white">
                {text}
            </div>
        </div>
    );
}


