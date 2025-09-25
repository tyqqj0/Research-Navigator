import { eventBus } from '../event-bus';
import { commandBus } from '../command-bus';
import type { SessionEvent } from '../../data-access/types';
import { resolveModelForPurpose } from '@/lib/settings/ai';
import { startTextStream } from '@/lib/ai/streaming/start';
import { runtimeConfig } from '../runtime-config';

// Generate a short session title (6–10 Chinese chars) on first user message
const g: any = globalThis as any;

function buildPrompt(userText: string, locale: string): string {
    const langHint = locale?.toLowerCase().startsWith('zh') ? '用简体中文输出' : 'Output in concise Chinese if possible';
    return `你是一个标题助手。阅读下面用户的研究问题或主题，生成一个非常简短的会话标题：
要求：
- 长度约 6–10 个汉字（不含标点）
- 不要句号、引号或括号
- 避免敏感词与夸张词
- 主题清晰可辨
${langHint}

用户输入："""
${userText}
"""

只输出标题本身。`;
}

export function startTitleSupervisor() {
    if (g.__titleSupervisorStarted) return;
    g.__titleSupervisorStarted = true;
    try { console.debug('[supervisor][title][start]'); } catch { }
    eventBus.subscribe(async (e: SessionEvent) => {
        if (e.type !== 'UserMessageAdded') return;
        const sessionId = e.sessionId!;
        try {
            const { useSessionStore } = await import('../../data-access/session-store');
            const s = (useSessionStore.getState() as any).sessions.get(sessionId) as any;
            const currTitle: string | undefined = s?.title;
            // Generate only when title is missing or default/unnamed
            if (currTitle && currTitle !== '未命名研究' && currTitle !== '新研究会话') return;

            const userText: string = e.payload.text || '';
            if (!userText || userText.trim().length === 0) return;

            // build prompt and run with task model (deterministic)
            const model = resolveModelForPurpose('task');
            const prompt = buildPrompt(userText, (runtimeConfig as any).TITLE_GEN_LOCALE || 'zh-CN');
            const controller = new AbortController();
            let buf = '';
            try {
                const stream = startTextStream({ prompt }, { signal: controller.signal, modelOverride: model, temperature: 0.2, maxTokens: 32 });
                for await (const ev of stream) {
                    if (ev.type === 'delta') buf += ev.text;
                }
            } catch { /* ignore AI errors */ }
            let title = (buf || '').trim();
            // sanitize: keep first line, strip punctuation, trim to 6–12 chars
            title = title.split(/\r?\n/)[0]?.trim() || '';
            title = title.replace(/[\s\p{P}\p{S}]+/gu, '');
            if (!title) return;
            if (title.length > 12) title = title.slice(0, 12);
            if (title.length < 4 && userText) {
                title = userText.replace(/[\s\p{P}\p{S}]+/gu, '').slice(0, 10) || '研究会话';
            }

            await commandBus.dispatch({ id: crypto.randomUUID(), type: 'RenameSession', ts: Date.now(), params: { sessionId, title } } as any);
        } catch {
            // ignore errors
        }
    });
}



