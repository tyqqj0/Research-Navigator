import { createMachine, assign } from 'xstate';
import type { SessionId } from '../../data-access/types';
// executor 调用改由 orchestrator 管理，避免重复

interface Ctx {
    sessionId: SessionId;
    userQuery: string;
    version: number;
    lastProposal?: string;
    feedback?: string;
    questions?: string;
}

type Ev =
    | { type: 'PROPOSE'; userQuery: string; sessionId: SessionId }
    | { type: 'FEEDBACK'; feedback: string }
    | { type: 'CONFIRM' }
    | { type: 'REFINE' }
    | { type: 'CANCEL' }
    | { type: 'PROPOSAL_DONE'; text: string }
    | { type: 'PROPOSAL_ERROR'; message: string }
    | { type: 'PROPOSAL_NEEDS_CLARIFICATION'; questions: string };

export const directionMachine = createMachine({
    types: {} as { context: Ctx; events: Ev },
    id: 'direction',
    initial: 'idle',
    context: { sessionId: '' as SessionId, userQuery: '', version: 1, lastProposal: undefined, feedback: undefined, questions: undefined },
    states: {
        idle: {
            on: { PROPOSE: { target: 'proposing', actions: assign(({ event }) => ({ userQuery: (event as any).userQuery, version: 1, sessionId: (event as any).sessionId })) } }
        },
        proposing: {
            on: {
                PROPOSAL_DONE: { target: 'waitDecision', actions: assign(({ event }) => ({ lastProposal: (event as any).text })) },
                PROPOSAL_ERROR: { target: 'idle' },
                PROPOSAL_NEEDS_CLARIFICATION: { target: 'clarifying', actions: assign(({ event }) => ({ questions: (event as any).questions })) }
            }
        },
        clarifying: {
            on: {
                REFINE: { target: 'proposing', actions: assign(({ context }) => ({ version: context.version + 1 })) },
                CANCEL: 'idle',
                FEEDBACK: { actions: assign(({ event }) => ({ feedback: (event as any).feedback })) }
            }
        },
        waitDecision: {
            on: {
                CONFIRM: 'done',
                REFINE: { target: 'proposing', actions: assign(({ context }) => ({ version: context.version + 1 })) },
                CANCEL: 'idle',
                FEEDBACK: { actions: assign(({ event }) => ({ feedback: (event as any).feedback })) }
            }
        },
        done: { type: 'final' }
    }
});

// 由 orchestrator 持有 interpreter，并负责向 machine 发送 PROPOSAL_DONE/ERROR


