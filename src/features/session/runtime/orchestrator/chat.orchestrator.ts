import { commandBus } from '../command-bus';
import { eventBus } from '../event-bus';
import { applyEventToProjection } from '../projectors';
import { assistantExecutor } from '../executors/assistant-executor';
import type { SessionCommand, SessionEvent } from '../../data-access/types';
import { buildAssistantMessages } from '../prompts/assistant';

// Ensure singleton across HMR/duplicate imports
const g: any = globalThis as any;
if (!g.__chatOrchestratorRunning) g.__chatOrchestratorRunning = new Map<string, { abort(): void }>();
const running: Map<string, { abort(): void }> = g.__chatOrchestratorRunning;
if (!g.__chatHandledCmdIds) g.__chatHandledCmdIds = new Set<string>();
const handledCmdIds: Set<string> = g.__chatHandledCmdIds;
if (!g.__chatOrchId) g.__chatOrchId = `chat-orch:${Math.random().toString(36).slice(2, 7)}`;
const ORCH_ID: string = g.__chatOrchId;

function newId() { return crypto.randomUUID(); }

// Project event immediately after publish
async function emit(e: SessionEvent) {
    await eventBus.publish(e);
    applyEventToProjection(e);
}

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
            await emit({ id: newId(), type: 'SessionRenamed', ts: Date.now(), sessionId: cmd.params.sessionId, payload: { title: cmd.params.title } });
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
            await emit({ id: newId(), type: 'UserMessageAdded', ts: Date.now(), sessionId, payload: { messageId: userMid, text: cmd.params.text } });
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


