import type { SessionEvent } from '../data-access/types';
import { sessionRepository } from '../data-access/session-repository';

type Handler = (e: SessionEvent) => void | Promise<void>;

const subscribers = new Set<Handler>();
const g: any = globalThis as any;
if (!g.__eventBusId) g.__eventBusId = `evbus:${Math.random().toString(36).slice(2, 8)}`;
const BUS_ID: string = g.__eventBusId;

export const eventBus = {
    subscribe(handler: Handler): () => void {
        subscribers.add(handler);
        try { console.debug('[bus][event][subscribe]', BUS_ID, 'subs=', subscribers.size); } catch { }
        return () => subscribers.delete(handler);
    },
    async publish(event: SessionEvent) {
        // try { console.debug('[bus][event][publish]', BUS_ID, event.type, event.id, 'subs=', subscribers.size); } catch { }
        await sessionRepository.appendEvent(event);
        for (const h of Array.from(subscribers)) {
            try { await Promise.resolve(h(event)); } catch (e) { try { console.warn('[bus][event][handler_error]', BUS_ID, (e as Error)?.message); } catch { } }
        }
    }
};


