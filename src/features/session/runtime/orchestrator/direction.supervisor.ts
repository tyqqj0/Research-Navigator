import { eventBus } from '../event-bus';
import { commandBus } from '../command-bus';
import type { SessionEvent } from '../../data-access/types';

// 监听用户消息，在 Deep Research 开启且未确认方向时自动触发提案
const g: any = globalThis as any;
export function startDirectionSupervisor() {
    if (g.__directionSupervisorStarted) return;
    g.__directionSupervisorStarted = true;
    try { console.debug('[supervisor][direction][start]'); } catch { }
    eventBus.subscribe(async (e: SessionEvent) => {
        const sessionId = e.sessionId!;
        // 1) 正常触发：监听用户消息
        if (e.type === 'UserMessageAdded') {
            try {
                const { useSessionStore } = await import('../../data-access/session-store');
                const s = (useSessionStore.getState() as any).sessions.get(sessionId) as any;
                const enabled = Boolean(s?.meta?.deepResearchEnabled);
                const confirmed = Boolean(s?.meta?.direction?.confirmed);
                const awaiting = Boolean(s?.meta?.direction?.awaitingDecision);
                const stage = (s?.meta as any)?.stage;
                try { console.debug('[supervisor][direction][onUserMessage]', { sessionId, enabled, confirmed, awaiting }); } catch { }
                if (enabled && (!confirmed || stage === 'report_done') && !awaiting) {
                    const cmdId = crypto.randomUUID();
                    try { console.debug('[supervisor][direction][dispatch_propose]', cmdId, sessionId); } catch { }
                    await commandBus.dispatch({ id: cmdId, type: 'ProposeDirection', ts: Date.now(), params: { sessionId, userQuery: (e as any).payload.text } } as any);
                }
            } catch {
                // ignore
            }
            return;
        }
        // 2) 当用户开启 Deep 时，若方向未确认且当前不在等待决定，则用最近一条用户消息自动触发一轮提案（支持刷新后的恢复）
        if (e.type === 'DeepResearchModeChanged' && (e as any).payload.enabled) {
            try {
                const { useSessionStore } = await import('../../data-access/session-store');
                const s = (useSessionStore.getState() as any).sessions.get(sessionId) as any;
                const confirmed = Boolean(s?.meta?.direction?.confirmed);
                const awaiting = Boolean(s?.meta?.direction?.awaitingDecision);
                if (!confirmed && !awaiting) {
                    const msgs: any[] = (useSessionStore.getState() as any).getMessages(sessionId) || [];
                    const lastUser = [...msgs].reverse().find(m => m.role === 'user');
                    const text = lastUser?.content || '';
                    if (text && text.trim()) {
                        const cmdId = crypto.randomUUID();
                        await commandBus.dispatch({ id: cmdId, type: 'ProposeDirection', ts: Date.now(), params: { sessionId, userQuery: text } } as any);
                    }
                }
            } catch {
                // ignore
            }
        }
    });
}


