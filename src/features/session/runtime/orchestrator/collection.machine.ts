import { createMachine, assign } from 'xstate';
import type { SessionId } from '../../data-access/types';

interface Ctx {
    sessionId: SessionId;
    rounds: number;
    lastAdded: number;
    total: number;
}

type Ev =
    | { type: 'START' }
    | { type: 'EXECUTED'; added: number; total: number }
    | { type: 'EVALUATED'; recentGrowth: number; coverageScore?: number }
    | { type: 'STOP' };

export const collectionMachine = createMachine({
    id: 'collectionExpansion',
    initial: 'idle',
    context: { sessionId: '' as SessionId, rounds: 0, lastAdded: 0, total: 0 },
    states: {
        idle: { on: { START: 'running' } },
        running: {
            initial: 'execute',
            states: {
                execute: { on: { EXECUTED: { target: 'evaluate', actions: assign((_, e: any) => ({ lastAdded: e.added, total: e.total })) } } },
                evaluate: {
                    on: {
                        EVALUATED: [
                            { target: 'execute', guard: (_, e: any) => e.recentGrowth > 0.02 },
                            { target: '#collectionExpansion.done' }
                        ],
                        STOP: '#collectionExpansion.stopped'
                    }
                }
            },
            on: { STOP: 'stopped' }
        },
        stopped: { type: 'final' },
        done: { type: 'final' }
    }
});


