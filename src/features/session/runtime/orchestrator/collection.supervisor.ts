import { eventBus } from '../event-bus';
import { commandBus } from '../command-bus';
import type { SessionEvent } from '../../data-access/types';

// Auto-start collection expansion after a session is bound to a collection
const g: any = globalThis as any;
export function startCollectionSupervisor() {
    if (g.__collectionSupervisorStarted) return;
    g.__collectionSupervisorStarted = true;
    try { console.debug('[supervisor][collection][start]'); } catch { }
    eventBus.subscribe(async (e: SessionEvent) => {
        if (e.type !== 'SessionCollectionBound') return;
        const sessionId = e.sessionId!;
        try {
            const { useSessionStore } = await import('../../data-access/session-store');
            const s = (useSessionStore.getState() as any).sessions.get(sessionId) as any;
            const confirmed = Boolean(s?.meta?.direction?.confirmed);
            const collectionId = (e as any)?.payload?.collectionId;
            try { console.debug('[supervisor][collection][onBound]', { sessionId, confirmed, collectionId }); } catch { }
            if (confirmed) {
                const cmdId = crypto.randomUUID();
                try { console.debug('[supervisor][collection][dispatch_start_expansion]', cmdId, sessionId); } catch { }
                await commandBus.dispatch({ id: cmdId, type: 'StartExpansion', ts: Date.now(), params: { sessionId } } as any);
            }
        } catch {
            // ignore
        }
    });
}


