import { interpret, StateFrom } from 'xstate';
import { directionMachine } from './direction.machine';
import type { SessionId, SessionCommand, SessionEvent } from '../../data-access/types';
import { commandBus } from '../command-bus';
import { eventBus } from '../event-bus';
import { applyEventToProjection } from '../projectors';
import { directionExecutor } from '../executors/direction-executor';

type DirState = StateFrom<typeof directionMachine>;

const instances = new Map<SessionId, { service: any; run: { abort(): void } | null }>();

function newId() { return crypto.randomUUID(); }

async function emit(e: SessionEvent) {
    await eventBus.publish(e);
    applyEventToProjection(e);
}

function ensureInstance(sessionId: SessionId) {
    let rec = instances.get(sessionId);
    if (rec) return rec;
    const service = interpret(directionMachine.withContext({ sessionId, userQuery: '', version: 1, lastProposal: undefined, feedback: undefined }));
    const stateWatcher = (state: DirState) => {
        const ctx = state.context as any;
        const curr = instances.get(sessionId)!;
        // manage executor lifecycle
        if (state.matches('proposing')) {
            // 进入 proposing 由 orchestrator 启动执行器
            if (!curr.run) {
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

        // publish events upon key transitions
        if (state.changed) {
            if (state.matches('waitDecision') && ctx.lastProposal) {
                const version = ctx.version;
                void emit({ id: newId(), type: 'DirectionProposed', ts: Date.now(), sessionId, payload: { proposalText: ctx.lastProposal, version } });
                void emit({ id: newId(), type: 'DecisionRequested', ts: Date.now(), sessionId, payload: { kind: 'direction', version } });
            }
            if (state.matches('idle')) {
                const ev: any = state.event;
                if (ev?.type === 'PROPOSAL_ERROR') {
                    // no-op for now
                }
                if (ev?.type === 'CANCEL') {
                    void emit({ id: newId(), type: 'DirectionDecisionRecorded', ts: Date.now(), sessionId, payload: { action: 'cancel', version: (ctx.version || 1) } });
                }
            }
            if (state.done) {
                // confirmed
                const version = ctx.version;
                const spec = ctx.lastProposal || '';
                void emit({ id: newId(), type: 'DirectionDecisionRecorded', ts: Date.now(), sessionId, payload: { action: 'confirm', version } });
                void emit({ id: newId(), type: 'DirectionConfirmed', ts: Date.now(), sessionId, payload: { directionSpec: spec, version } });
            }
        }
    };
    service.onTransition(stateWatcher);
    service.start();
    rec = { service, run: null };
    instances.set(sessionId, rec);
    return rec;
}

// Bridge commands to machine events
commandBus.register(async (cmd: SessionCommand) => {
    if (cmd.type === 'ProposeDirection') {
        const { sessionId, userQuery } = cmd.params as any;
        const { service } = ensureInstance(sessionId);
        service.send({ type: 'PROPOSE', userQuery });
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
        else if (action === 'cancel') rec.service.send({ type: 'CANCEL' });
        return;
    }
});


