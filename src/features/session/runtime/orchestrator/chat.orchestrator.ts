import { commandBus } from '../command-bus';
import { eventBus } from '../event-bus';
import { applyEventToProjection } from '../projectors';
import { assistantExecutor } from '../executors/assistant-executor';
import type { SessionCommand, SessionEvent } from '../../data-access/types';

const running = new Map<string, { abort(): void }>();

function newId() { return crypto.randomUUID(); }

// Project event immediately after publish
async function emit(e: SessionEvent) {
    await eventBus.publish(e);
    applyEventToProjection(e);
}

commandBus.register(async (cmd: SessionCommand) => {
    if (cmd.type === 'CreateSession') {
        const sessionId = cmd.sessionId || newId();
        await emit({ id: newId(), type: 'SessionCreated', ts: Date.now(), sessionId, payload: { title: cmd.params.title } });
        return;
    }
    if (cmd.type === 'RenameSession') {
        await emit({ id: newId(), type: 'SessionRenamed', ts: Date.now(), sessionId: cmd.params.sessionId, payload: { title: cmd.params.title } });
        return;
    }
    if (cmd.type === 'SendMessage') {
        const sessionId = cmd.params.sessionId;
        const userMid = newId();
        await emit({ id: newId(), type: 'UserMessageAdded', ts: Date.now(), sessionId, payload: { messageId: userMid, text: cmd.params.text } });
        const asMid = newId();
        const run = assistantExecutor.start({
            messages: [cmd.params.text],
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


