import { createMachine, assign } from 'xstate';
import type { SessionId } from '../../data-access/types';
import { directionExecutor } from '../executors/direction-executor';

interface Ctx {
    sessionId: SessionId;
    userQuery: string;
    version: number;
    lastProposal?: string;
    feedback?: string;
    run?: { abort(): void } | null;
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
    context: { sessionId: '' as SessionId, userQuery: '', version: 1, lastProposal: undefined, feedback: undefined, run: null },
    states: {
        idle: {
            on: { PROPOSE: { target: 'proposing', actions: assign((_, e: any) => ({ userQuery: e.userQuery, version: 1 })) } }
        },
        proposing: {
            entry: assign((ctx) => {
                const run = directionExecutor.generateProposal({
                    userQuery: ctx.userQuery,
                    version: ctx.version,
                    feedback: ctx.feedback,
                    onComplete: (text) => ctxRef.send({ type: 'PROPOSAL_DONE', text }),
                    onError: (message) => ctxRef.send({ type: 'PROPOSAL_ERROR', message })
                });
                return { run } as Partial<Ctx>;
            }),
            exit: assign((ctx) => { try { ctx.run?.abort(); } catch { /* ignore */ } return { run: null }; }),
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

// 简单的 interpreter 桥接（外部注入）
let ctxRef: { send: (ev: Ev) => void } = { send: () => { } };
export function setDirectionMachineBridge(ref: { send: (ev: Ev) => void }) { ctxRef = ref; }


