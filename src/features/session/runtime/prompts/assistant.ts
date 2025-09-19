import type { SessionId } from '../../data-access/types';
import { sessionRepository } from '../../data-access/session-repository';
import { useSessionStore } from '../../data-access/session-store';

function sliceLast<T>(arr: T[], k: number): T[] { const n = Math.max(0, arr.length - k); return arr.slice(n); }

export async function buildAssistantMessages(sessionId: SessionId, userText: string, recentK: number = 6): Promise<string[]> {
    const msgs = await sessionRepository.listMessages(sessionId);
    const session = (useSessionStore.getState() as any).sessions.get(sessionId) as any;
    const spec = session?.meta?.direction?.confirmed ? (session.meta.direction.spec || '') : '';

    const recent = sliceLast(msgs, recentK)
        .map((m: any) => `${m.role === 'user' ? 'U' : m.role === 'assistant' ? 'A' : 'S'}: ${m.content}`)
        .join('\n');

    const header = [
        '你是一个严谨而高效的研究助理。',
        spec ? `已确认研究方向：${spec}` : '当前尚未确认具体研究方向。',
        '以下是最近的对话片段（从早到晚）：',
        recent || '(无历史)'
    ].join('\n');

    return [
        header,
        '\n当前用户消息：',
        userText,
        '\n请用简洁、直接、可执行的方式回复。'
    ];
}


