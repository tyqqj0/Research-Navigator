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
type InstanceRec = { service: any; run: { abort(): void } | null; prev: any | null; runId?: string };
const instances: Map<SessionId, InstanceRec> = g_any.__directionInstances;
if (!g_any.__directionOrchId) g_any.__directionOrchId = `dir-orch:${Math.random().toString(36).slice(2, 7)}`;
const ORCH_ID: string = g_any.__directionOrchId;

function newId() { return crypto.randomUUID(); }

async function emit(e: SessionEvent) {
    // try { console.debug('[orch][direction][publish]', ORCH_ID, e.type, e.id); } catch { }
    await eventBus.publish(e);
    applyEventToProjection(e);
}

function ensureInstance(sessionId: SessionId): InstanceRec {
    let rec: InstanceRec | undefined = instances.get(sessionId);
    if (rec) return rec as InstanceRec;
    const service = createActor(directionMachine);
    // pre-register the record before subscribing to avoid race on first snapshot
    rec = { service, run: null, prev: null } as InstanceRec;
    instances.set(sessionId, rec);
    const stateWatcher = (state: DirState) => {
        const ctx = state.context as any;
        const curr = instances.get(sessionId)!;
        const prev = curr.prev as DirState | null;

        // 日志：状态转换
        try {
            const prevVal = prev && (prev as any).value;
            const currVal = state.value;
            if (prevVal !== currVal) {
                console.debug('[orch][direction][state_transition]', ORCH_ID, {
                    sessionId,
                    from: prevVal || 'null',
                    to: currVal,
                    status: state.status
                });
            }
        } catch { }
        // manage executor lifecycle
        const enteredProposing = state.matches('proposing') && !(prev && (prev as any).matches && (prev as any).matches('proposing'));
        if (enteredProposing) {
            try { console.debug('[orch][direction][entered_proposing]', ORCH_ID, { sessionId, version: ctx.version }); } catch { }
        }
        if (state.matches('proposing')) {
            // 进入 proposing 由 orchestrator 启动执行器
            if (!curr.run) {
                const runId = crypto.randomUUID();
                curr.runId = runId;
                try { console.debug('[orch][direction][exec_start]', ORCH_ID, { sessionId, version: ctx.version, runId }); } catch { }
                // streaming bridge to projection
                void emit({ id: newId(), type: 'DirectionProposalStarted', ts: Date.now(), sessionId, payload: { runId, version: ctx.version } });
                curr.run = directionExecutor.generateProposal({
                    userQuery: ctx.userQuery,
                    version: ctx.version,
                    feedback: ctx.feedback,
                    onDelta: (delta: string) => { void emit({ id: newId(), type: 'DirectionProposalDelta', ts: Date.now(), sessionId, payload: { runId, version: ctx.version, delta } }); },
                    onComplete: (text: string) => {
                        try {
                            console.debug('[orch][direction][exec_complete]', ORCH_ID, { sessionId, runId, textLen: text?.length });
                            curr.service.send({ type: 'PROPOSAL_DONE', text });
                        } catch (err) {
                            try { console.error('[orch][direction][exec_complete_error]', ORCH_ID, { sessionId, error: String(err) }); } catch { }
                        }
                    },
                    onAborted: (reason: string) => {
                        try { console.warn('[orch][direction][exec_aborted]', ORCH_ID, { sessionId, runId, reason }); } catch { }
                        void emit({ id: newId(), type: 'DirectionProposalAborted', ts: Date.now(), sessionId, payload: { runId, version: ctx.version, reason } });
                    },
                    onError: (message: string) => {
                        try { console.error('[orch][direction][exec_error]', ORCH_ID, { sessionId, runId, message }); } catch { }
                        try { curr.service.send({ type: 'PROPOSAL_ERROR', message }); } catch { /* ignore */ }
                    }
                } as any);
            }
        } else {
            if (curr.run) { try { curr.run.abort(); } catch { /* ignore */ } curr.run = null; }
        }

        // publish events upon entering specific states (compute transitions manually)
        const enteredWaitDecision = state.matches('waitDecision') && !(prev && (prev as any).matches && (prev as any).matches('waitDecision'));
        if (enteredWaitDecision) {
            try { console.debug('[orch][direction][entered_waitDecision]', ORCH_ID, { sessionId, hasProposal: !!ctx.lastProposal }); } catch { }
        }
        if (enteredWaitDecision && ctx.lastProposal) {
            const version = ctx.version;
            const runId = curr.runId || crypto.randomUUID();
            void emit({ id: newId(), type: 'DirectionProposed', ts: Date.now(), sessionId, payload: { runId, proposalText: ctx.lastProposal, version } });
            void emit({ id: newId(), type: 'DecisionRequested', ts: Date.now(), sessionId, payload: { kind: 'direction', runId, version } });
        }
        const enteredDone = (state as any).status === 'done' && !(prev && (prev as any).status === 'done');
        if (enteredDone) {
            const version = ctx.version;
            const runId = curr.runId || crypto.randomUUID();
            const spec = ctx.lastProposal || '';
            try { console.debug('[orch][direction][entered_done]', ORCH_ID, { sessionId, version, runId, hasSpec: !!spec }); } catch { }
            void emit({ id: newId(), type: 'DirectionDecisionRecorded', ts: Date.now(), sessionId, payload: { runId, action: 'confirm', version } });
            void emit({ id: newId(), type: 'DirectionConfirmed', ts: Date.now(), sessionId, payload: { runId, directionSpec: spec, version } });
            // 自动进入集合阶段：初始化集合
            try { console.debug('[orch][direction][dispatch_init_collection]', ORCH_ID, { sessionId }); } catch { }
            void bus.dispatch({ id: newId(), type: 'InitCollection', ts: Date.now(), params: { sessionId } } as any);
        }

        // remember previous snapshot
        curr.prev = state;
    };
    service.subscribe(stateWatcher);
    service.start();
    return rec as InstanceRec;
}

// Bridge commands to machine events
if (!g_any.__directionOrchestratorRegistered) {
    g_any.__directionOrchestratorRegistered = true;
    try { console.debug('[orch][direction][init]', ORCH_ID); } catch { }
    commandBus.register(async (cmd: SessionCommand) => {
        // try { console.debug('[orch][direction][cmd]', ORCH_ID, cmd.type, cmd.id); } catch { }
        if (cmd.type === 'ProposeDirection') {
            const { sessionId, userQuery } = cmd.params as any;
            try { console.debug('[orch][direction][propose_recv]', ORCH_ID, { sessionId, userQueryLen: userQuery?.length }); } catch { }
            let inst = ensureInstance(sessionId)!;
            try {
                const snap: any = inst.service.getSnapshot ? inst.service.getSnapshot() : null;
                const isDone: boolean = Boolean(snap && ((snap.status === 'done') || (snap.matches && snap.matches('done'))));
                try { console.debug('[orch][direction][propose_state_check]', ORCH_ID, { sessionId, snapStatus: snap?.status, snapValue: snap?.value, isDone }); } catch { }
                if (isDone) {
                    try { console.debug('[orch][direction][propose_reset_instance]', ORCH_ID, { sessionId }); } catch { }
                    try { inst.service.stop?.(); } catch { /* ignore */ }
                    // drop and recreate the instance to start a fresh round
                    try { instances.delete(sessionId as any); } catch { /* ignore */ }
                    inst = ensureInstance(sessionId)!;
                }
            } catch { /* ignore snapshot checks */ }
            try { console.debug('[orch][direction][send_PROPOSE]', ORCH_ID, { sessionId }); } catch { }
            inst.service.send({ type: 'PROPOSE', userQuery, sessionId });
            return;
        }
        if (cmd.type === 'DecideDirection') {
            const { sessionId, action, feedback } = cmd.params as any;
            const rec = ensureInstance(sessionId)!;
            const snap: any = rec.service.getSnapshot ? rec.service.getSnapshot() : null;

            // 详细日志：当前状态机快照
            try {
                console.debug('[orch][direction][decide_recv]', ORCH_ID, {
                    sessionId,
                    action,
                    hasFeedback: !!feedback,
                    snapStatus: snap?.status,
                    snapValue: snap?.value,
                    snapContext: {
                        version: snap?.context?.version,
                        hasProposal: !!snap?.context?.lastProposal
                    }
                });
            } catch { }

            const inWaitDecision = Boolean(snap && (snap.matches && snap.matches('waitDecision')));
            const isDone = Boolean(snap && ((snap.status === 'done') || (snap.matches && snap.matches('done'))));

            // Idempotency: if not awaiting decision or already done, attempt reconcile; else ignore
            if (action === 'confirm') {
                if (!inWaitDecision || isDone) {
                    // Reconcile mismatch after refresh: projection may say awaiting but machine not in waitDecision
                    try {
                        const { useSessionStore } = await import('../../data-access/session-store');
                        const s = (useSessionStore.getState() as any).sessions.get(sessionId) as any;
                        const awaiting: boolean = Boolean(s?.meta?.direction?.awaitingDecision);
                        const version: number = (s?.meta?.direction?.version || 1);
                        if (awaiting) {
                            const msgs: any[] = (useSessionStore.getState() as any).getMessages(sessionId) || [];
                            const lastProposalMsg = [...msgs].reverse().find(m => typeof m?.id === 'string' && m.id.startsWith('proposal_') && (m.status === 'done' || !m.status));
                            const spec: string = lastProposalMsg?.content || '';
                            try { console.warn('[orch][direction][confirm_reconcile_projection]', ORCH_ID, { sessionId, hasSpec: !!spec, version }); } catch { }
                            await emit({ id: newId(), type: 'DirectionDecisionRecorded', ts: Date.now(), sessionId, payload: { runId: rec.runId || crypto.randomUUID(), action: 'confirm', version } });
                            await emit({ id: newId(), type: 'DirectionConfirmed', ts: Date.now(), sessionId, payload: { runId: rec.runId || crypto.randomUUID(), directionSpec: spec, version } });
                            try { console.debug('[orch][direction][dispatch_init_collection]', ORCH_ID, { sessionId }); } catch { }
                            void bus.dispatch({ id: newId(), type: 'InitCollection', ts: Date.now(), params: { sessionId } } as any);
                            return;
                        }
                    } catch { /* ignore reconcile errors */ }
                    try {
                        console.warn('[orch][direction][confirm_ignored]', ORCH_ID, {
                            sessionId,
                            inWaitDecision,
                            isDone,
                            snapStatus: snap?.status,
                            snapValue: snap?.value
                        });
                    } catch { }
                    return;
                }
                try { console.debug('[orch][direction][confirm_accepted]', ORCH_ID, { sessionId }); } catch { }
            }
            if (feedback) rec.service.send({ type: 'FEEDBACK', feedback });
            if (action === 'confirm') rec.service.send({ type: 'CONFIRM' });
            else if (action === 'refine') {
                // record a refine decision event
                await emit({ id: newId(), type: 'DirectionDecisionRecorded', ts: Date.now(), sessionId, payload: { runId: rec.runId || crypto.randomUUID(), action: 'refine', feedback, version: (rec.service.getSnapshot()?.context?.version || 1) } });
                rec.service.send({ type: 'REFINE' });
            }
            else if (action === 'cancel') {
                await emit({ id: newId(), type: 'DirectionDecisionRecorded', ts: Date.now(), sessionId, payload: { runId: rec.runId || crypto.randomUUID(), action: 'cancel', version: (rec.service.getSnapshot()?.context?.version || 1) } });
                rec.service.send({ type: 'CANCEL' });
            }
            return;
        }
        if (cmd.type === 'StopStreaming') {
            const sessionId = (cmd.params as any).sessionId;
            const rec = ensureInstance(sessionId)!;
            if (rec.run) {
                try { rec.run.abort(); } catch { /* ignore */ }
                const version = rec.service.getSnapshot()?.context?.version || 1;
                void emit({ id: newId(), type: 'DirectionProposalAborted', ts: Date.now(), sessionId, payload: { runId: rec.runId || crypto.randomUUID(), version, reason: 'user' } });
                try { rec.service.send({ type: 'PROPOSAL_ERROR', message: 'aborted' }); } catch { /* ignore */ }
            }
            return;
        }
    });
}


