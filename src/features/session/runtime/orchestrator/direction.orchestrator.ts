import { createActor, StateFrom } from 'xstate';
import { directionMachine } from './direction.machine';
import type { SessionId, SessionCommand, SessionEvent } from '../../data-access/types';
import { commandBus } from '../command-bus';
import { eventBus } from '../event-bus';
import { applyEventToProjection } from '../projectors';
import { directionExecutor } from '../executors/direction-executor';
import { commandBus as bus } from '../command-bus';

type DirState = StateFrom<typeof directionMachine>;

const g_any: any = globalThis as any;
if (!g_any.__directionInstances) g_any.__directionInstances = new Map<SessionId, { service: any; run: { abort(): void } | null; prev: any | null }>();
const instances: Map<SessionId, { service: any; run: { abort(): void } | null; prev: any | null }> = g_any.__directionInstances;
if (!g_any.__directionOrchId) g_any.__directionOrchId = `dir-orch:${Math.random().toString(36).slice(2, 7)}`;
const ORCH_ID: string = g_any.__directionOrchId;

function newId() { return crypto.randomUUID(); }

async function emit(e: SessionEvent) {
    try { console.debug('[orch][direction][publish]', ORCH_ID, e.type, e.id); } catch { }
    await eventBus.publish(e);
    applyEventToProjection(e);
}

function ensureInstance(sessionId: SessionId) {
    let rec = instances.get(sessionId);
    if (rec) return rec;
    const service = createActor(directionMachine);
    // pre-register the record before subscribing to avoid race on first snapshot
    rec = { service, run: null, prev: null } as any;
    instances.set(sessionId, rec);
    const stateWatcher = (state: DirState) => {
        const ctx = state.context as any;
        const curr = instances.get(sessionId)!;
        const prev = curr.prev as DirState | null;
        // manage executor lifecycle
        if (state.matches('proposing')) {
            // 进入 proposing 由 orchestrator 启动执行器
            if (!curr.run) {
                try { console.debug('[orch][direction][exec_start]', ORCH_ID, { sessionId, version: ctx.version }); } catch { }
                curr.run = directionExecutor.generateProposal({
                    userQuery: ctx.userQuery,
                    version: ctx.version,
                    feedback: ctx.feedback,
                    onComplete: (text) => { try { curr.service.send({ type: 'PROPOSAL_DONE', text }); } catch { /* ignore */ } },
                    onError: (message) => { try { curr.service.send({ type: 'PROPOSAL_ERROR', message }); } catch { /* ignore */ } }
                });
            }
        } else {
            if (curr.run) { try { curr.run.abort(); } catch { /* ignore */ } curr.run = null; }
        }

        // publish events upon entering specific states (compute transitions manually)
        const enteredWaitDecision = state.matches('waitDecision') && !(prev && (prev as any).matches && (prev as any).matches('waitDecision'));
        if (enteredWaitDecision && ctx.lastProposal) {
            const version = ctx.version;
            void emit({ id: newId(), type: 'DirectionProposed', ts: Date.now(), sessionId, payload: { proposalText: ctx.lastProposal, version } });
            void emit({ id: newId(), type: 'DecisionRequested', ts: Date.now(), sessionId, payload: { kind: 'direction', version } });
        }
        const enteredDone = (state as any).status === 'done' && !(prev && (prev as any).status === 'done');
        if (enteredDone) {
            const version = ctx.version;
            const spec = ctx.lastProposal || '';
            void emit({ id: newId(), type: 'DirectionDecisionRecorded', ts: Date.now(), sessionId, payload: { action: 'confirm', version } });
            void emit({ id: newId(), type: 'DirectionConfirmed', ts: Date.now(), sessionId, payload: { directionSpec: spec, version } });
            // 自动进入集合阶段：初始化集合
            void bus.dispatch({ id: newId(), type: 'InitCollection', ts: Date.now(), params: { sessionId } } as any);
        }

        // remember previous snapshot
        curr.prev = state;
    };
    service.subscribe(stateWatcher);
    service.start();
    return rec;
}

// Bridge commands to machine events
if (!g_any.__directionOrchestratorRegistered) {
    g_any.__directionOrchestratorRegistered = true;
    try { console.debug('[orch][direction][init]', ORCH_ID); } catch { }
    commandBus.register(async (cmd: SessionCommand) => {
        try { console.debug('[orch][direction][cmd]', ORCH_ID, cmd.type, cmd.id); } catch { }
        if (cmd.type === 'ProposeDirection') {
            const { sessionId, userQuery } = cmd.params as any;
            const { service } = ensureInstance(sessionId);
            service.send({ type: 'PROPOSE', userQuery, sessionId });
            return;
        }
        if (cmd.type === 'DecideDirection') {
            const { sessionId, action, feedback } = cmd.params as any;
            const rec = ensureInstance(sessionId);
            if (feedback) rec.service.send({ type: 'FEEDBACK', feedback });
            if (action === 'confirm') rec.service.send({ type: 'CONFIRM' });
            else if (action === 'refine') {
                // record a refine decision event
                await emit({ id: newId(), type: 'DirectionDecisionRecorded', ts: Date.now(), sessionId, payload: { action: 'refine', feedback, version: (rec.service.getSnapshot()?.context?.version || 1) } });
                rec.service.send({ type: 'REFINE' });
            }
            else if (action === 'cancel') {
                await emit({ id: newId(), type: 'DirectionDecisionRecorded', ts: Date.now(), sessionId, payload: { action: 'cancel', version: (rec.service.getSnapshot()?.context?.version || 1) } });
                rec.service.send({ type: 'CANCEL' });
            }
            return;
        }
    });
}


