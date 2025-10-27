import { eventBus } from '../event-bus';
import { commandBus } from '../command-bus';
import type { SessionEvent } from '../../data-access/types';
import { not } from 'node_modules/xstate/dist/declarations/src/guards';

// 监听用户消息，在 Deep Research 开启且未确认方向时自动触发提案
const g: any = globalThis as any;
export function startDirectionSupervisor() {
    if (g.__directionSupervisorStarted) return;
    g.__directionSupervisorStarted = true;
    try { console.debug('[supervisor][direction][start]'); } catch { }
    eventBus.subscribe(async (e: SessionEvent) => {
        const sessionId = e.sessionId!;
        try {
            // 跳过*Delta类型事件的日志
            if (!e.type.endsWith('Delta')) {
                try { console.debug('[supervisor][direction][event]', e.type, { sessionId }); } catch { }
            }
        } catch { }

        // 1) 正常触发：监听用户消息
        if (e.type === 'UserMessageAdded') {
            try {
                const { useSessionStore } = await import('../../data-access/session-store');
                const s = (useSessionStore.getState() as any).sessions.get(sessionId) as any;
                const enabled = Boolean(s?.meta?.deepResearchEnabled);
                const confirmed = Boolean(s?.meta?.direction?.confirmed);
                const awaiting = Boolean(s?.meta?.direction?.awaitingDecision);
                const stage = (s?.meta as any)?.stage;
                try { console.debug('[supervisor][direction][onUserMessage]', { sessionId, enabled, confirmed, awaiting, stage }); } catch { }
                if (enabled && (!confirmed || stage === 'report_done') && !awaiting) {
                    const cmdId = crypto.randomUUID();
                    try { console.debug('[supervisor][direction][dispatch_propose]', cmdId, sessionId); } catch { }
                    await commandBus.dispatch({ id: cmdId, type: 'ProposeDirection', ts: Date.now(), params: { sessionId, userQuery: (e as any).payload.text } } as any);
                } else {
                    try { console.debug('[supervisor][direction][skip_propose]', { sessionId, enabled, confirmed, awaiting, stage }); } catch { }
                }
            } catch (err) {
                try { console.error('[supervisor][direction][error_onUserMessage]', { sessionId, error: String(err) }); } catch { }
            }
            return;
        }
        // 2) 当用户开启 Deep 时，不再自动触发提案。
        // 原逻辑会基于最后一条用户消息立即生成提案，导致用户点击 Deep Research 后立即弹出提案。
        // 现在改为：点击 Deep Research 只是开启模式，等用户发送下一条消息时才触发提案（通过上面的 UserMessageAdded 逻辑）。
        if (e.type === 'DeepResearchModeChanged' && (e as any).payload.enabled) {
            try { console.debug('[supervisor][direction][deep_enabled]', { sessionId }); } catch { }
            // 不做任何操作，等待下一条用户消息
        }
    });
}


