import { commandBus } from '../command-bus';
import { eventBus } from '../event-bus';
import { applyEventToProjection } from '../projectors';
import { assistantExecutor } from '../executors/assistant-executor';
import type { SessionCommand, SessionEvent } from '../../data-access/types';
import { buildAssistantMessages } from '../prompts/assistant';
// report generation moved to dedicated report orchestrator

function newId() { return crypto.randomUUID(); }
async function emit(e: SessionEvent) { await eventBus.publish(e); applyEventToProjection(e); }

declare const globalThis: any;
if (!(globalThis as any).__chatOrchestratorGraphExtRegistered) {
    (globalThis as any).__chatOrchestratorGraphExtRegistered = true;
    commandBus.register(async (cmd: SessionCommand) => {
        if (cmd.type === 'GenerateReport') {
            // Delegated to report.orchestrator (kept here to avoid duplicate handling)
            return;
        }
        if (cmd.type === 'SupplementGraph') {
            // 简化：补充触发重新构建图谱一轮（使用窗口配置）
            const { runtimeConfig } = require('../runtime-config');
            await commandBus.dispatch({ id: newId(), type: 'BuildGraph', ts: Date.now(), params: { sessionId: cmd.params.sessionId, window: runtimeConfig.GRAPH_WINDOW_SIZE } } as any);
            try { const { toast } = require('sonner'); toast.message('已开始补充图谱'); } catch { }
            return;
        }
    });
}
// Ensure singleton across HMR/duplicate imports
const g: any = globalThis as any;
if (!g.__chatOrchestratorRunning) g.__chatOrchestratorRunning = new Map<string, { abort(): void }>();
const running: Map<string, { abort(): void }> = g.__chatOrchestratorRunning;
if (!g.__chatHandledCmdIds) g.__chatHandledCmdIds = new Set<string>();
const handledCmdIds: Set<string> = g.__chatHandledCmdIds;
if (!g.__chatOrchId) g.__chatOrchId = `chat-orch:${Math.random().toString(36).slice(2, 7)}`;
const ORCH_ID: string = g.__chatOrchId;

if (!g.__chatOrchestratorRegistered) {
    g.__chatOrchestratorRegistered = true;
    try { console.debug('[orch][chat][init]', ORCH_ID); } catch { }
    commandBus.register(async (cmd: SessionCommand) => {
        try { console.debug('[orch][chat][cmd]', ORCH_ID, cmd.type, cmd.id); } catch { }
        if (cmd.type === 'CreateSession') {
            const sessionId = cmd.sessionId || newId();
            await emit({ id: newId(), type: 'SessionCreated', ts: Date.now(), sessionId, payload: { title: cmd.params.title } });
            return;
        }
        if (cmd.type === 'RenameSession') {
            await emit({ id: newId(), type: 'SessionRenamed', ts: Date.now(), sessionId: cmd.params.sessionId, payload: { title: cmd.params.title }, qos: 'sync' } as any);
            return;
        }
        if (cmd.type === 'ToggleDeepResearch') {
            await emit({ id: newId(), type: 'DeepResearchModeChanged', ts: Date.now(), sessionId: cmd.params.sessionId, payload: { enabled: (cmd.params as any).enabled } });
            return;
        }
        if (cmd.type === 'SendMessage') {
            const sessionId = cmd.params.sessionId;
            if (handledCmdIds.has(cmd.id)) { try { console.warn('[orch][chat][duplicate_cmd]', ORCH_ID, cmd.id); } catch { } return; }
            handledCmdIds.add(cmd.id);
            const userMid = newId();
            await emit({ id: newId(), type: 'UserMessageAdded', ts: Date.now(), sessionId, payload: { messageId: userMid, text: cmd.params.text }, qos: 'async' } as any);
            // 当 Deep Research 开启且方向未确认时：仅记录用户消息，不启动普通对话，避免与方案生成并发
            try {
                const { useSessionStore } = await import('../../data-access/session-store');
                const s = (useSessionStore.getState() as any).sessions.get(sessionId) as any;
                const deep = Boolean(s?.meta?.deepResearchEnabled);
                const confirmed = Boolean(s?.meta?.direction?.confirmed);
                const awaiting = Boolean(s?.meta?.direction?.awaitingDecision);
                if (deep && (!confirmed || awaiting)) {
                    try { console.debug('[orch][chat][skip_normal_chat_due_to_direction_phase]', ORCH_ID, { sessionId, awaiting }); } catch { }
                    return;
                }
            } catch { /* ignore store check errors */ }
            const asMid = newId();
            const contextMessages = await buildAssistantMessages(sessionId, cmd.params.text, 6);
            if (running.has(sessionId)) { try { console.warn('[orch][chat][running_exists_skip]', ORCH_ID, sessionId); } catch { } return; }
            const run = assistantExecutor.start({
                messages: contextMessages,
                onStart: () => emit({ id: newId(), type: 'AssistantMessageStarted', ts: Date.now(), sessionId, payload: { messageId: asMid } }),
                onDelta: (d) => emit({ id: newId(), type: 'AssistantMessageDelta', ts: Date.now(), sessionId, payload: { messageId: asMid, delta: d } }),
                onDone: () => { emit({ id: newId(), type: 'AssistantMessageCompleted', ts: Date.now(), sessionId, payload: { messageId: asMid } }); running.delete(sessionId); },
                onAbort: (reason) => { emit({ id: newId(), type: 'AssistantMessageAborted', ts: Date.now(), sessionId, payload: { messageId: asMid, reason } }); running.delete(sessionId); },
                onError: (msg) => { emit({ id: newId(), type: 'AssistantMessageFailed', ts: Date.now(), sessionId, payload: { messageId: asMid, error: msg } }); running.delete(sessionId); }
            });
            running.set(sessionId, run);
            return;
        }
        if (cmd.type === 'StopStreaming') {
            const run = running.get(cmd.params.sessionId);
            if (run) { try { run.abort(); } catch { /* ignore */ } }
            return;
        }
    });
}


