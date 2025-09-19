import type { SessionEvent } from '../data-access/types';
import { sessionRepository } from '../data-access/session-repository';

type Handler = (e: SessionEvent) => void | Promise<void>;

const subscribers = new Set<Handler>();

export const eventBus = {
    subscribe(handler: Handler): () => void {
        subscribers.add(handler);
        return () => subscribers.delete(handler);
    },
    async publish(event: SessionEvent) {
        await sessionRepository.appendEvent(event);
        for (const h of Array.from(subscribers)) {
            try { await Promise.resolve(h(event)); } catch { /* ignore */ }
        }
    }
};


