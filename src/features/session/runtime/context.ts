import { sessionRepository } from '../data-access/session-repository';
import { useSessionStore } from '../data-access/session-store';
import type { SessionId } from '../data-access/types';

function sliceLast<T>(arr: T[], k: number): T[] {
    const n = Math.max(0, arr.length - k);
    return arr.slice(n);
}

export async function buildChatMessages(sessionId: SessionId, userText: string, recentK: number = 6): Promise<string[]> {
    const [msgs] = await Promise.all([
        sessionRepository.listMessages(sessionId)
    ]);

    const session = (useSessionStore.getState() as any).sessions.get(sessionId) as any;
    const directionSpec = session?.meta?.direction?.confirmed ? (session.meta.direction.spec || '') : '';

    const recent = sliceLast(msgs, recentK)
        .map(m => `${m.role === 'user' ? 'U' : m.role === 'assistant' ? 'A' : 'S'}: ${m.content}`)
        .join('\n');

    const header = [
        '你是一个严谨而高效的研究助理。',
        directionSpec ? `已确认研究方向：${directionSpec}` : '当前尚未确认具体研究方向。',
        '以下是最近的对话片段（从早到晚）：',
        recent || '(无历史)'
    ].join('\n');

    const composed = [
        header,
        '\n当前用户消息：',
        userText,
        '\n请用简洁、直接、可执行的方式回复。'
    ].join('\n');

    return [composed];
}


