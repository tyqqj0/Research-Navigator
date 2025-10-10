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
        if (e.type !== 'UserMessageAdded') return;
        const sessionId = e.sessionId!;
        try {
            const { useSessionStore } = await import('../../data-access/session-store');
            const s = (useSessionStore.getState() as any).sessions.get(sessionId) as any;
            const enabled = Boolean(s?.meta?.deepResearchEnabled);
            const confirmed = Boolean(s?.meta?.direction?.confirmed);
            const awaiting = Boolean(s?.meta?.direction?.awaitingDecision);
            const stage = (s?.meta as any)?.stage;
            try { console.debug('[supervisor][direction][onUserMessage]', { sessionId, enabled, confirmed, awaiting }); } catch { }
            // 若在报告完成后，用户重开 Deep（或仍为开启状态），下一条用户消息应触发新一轮提案
            if (enabled && (!confirmed || stage === 'report_done') && !awaiting) {
                const cmdId = crypto.randomUUID();
                try { console.debug('[supervisor][direction][dispatch_propose]', cmdId, sessionId); } catch { }
                await commandBus.dispatch({ id: cmdId, type: 'ProposeDirection', ts: Date.now(), params: { sessionId, userQuery: e.payload.text } } as any);
            }
        } catch {
            // ignore
        }
    });
}


