import { createMachine, assign } from 'xstate';
import type { SessionId } from '../../data-access/types';
// executor 调用改由 orchestrator 管理，避免重复

interface Ctx {
    sessionId: SessionId;
    userQuery: string;
    version: number;
    lastProposal?: string;
    feedback?: string;
}

type Ev =
    | { type: 'PROPOSE'; userQuery: string }
    | { type: 'FEEDBACK'; feedback: string }
    | { type: 'CONFIRM' }
    | { type: 'REFINE' }
    | { type: 'CANCEL' }
    | { type: 'PROPOSAL_DONE'; text: string }
    | { type: 'PROPOSAL_ERROR'; message: string };

export const directionMachine = createMachine<Ctx, Ev>({
    id: 'direction',
    initial: 'idle',
    context: { sessionId: '' as SessionId, userQuery: '', version: 1, lastProposal: undefined, feedback: undefined },
    states: {
        idle: {
            on: { PROPOSE: { target: 'proposing', actions: assign((_, e: any) => ({ userQuery: e.userQuery, version: 1 })) } }
        },
        proposing: {
            on: {
                PROPOSAL_DONE: { target: 'waitDecision', actions: assign((_, e: any) => ({ lastProposal: e.text })) },
                PROPOSAL_ERROR: { target: 'idle' }
            }
        },
        waitDecision: {
            on: {
                CONFIRM: 'done',
                REFINE: { target: 'proposing', actions: assign((ctx) => ({ version: ctx.version + 1 })) },
                CANCEL: 'idle',
                FEEDBACK: { actions: assign((_, e: any) => ({ feedback: e.feedback })) }
            }
        },
        done: { type: 'final' }
    }
});

// 由 orchestrator 持有 interpreter，并负责向 machine 发送 PROPOSAL_DONE/ERROR


