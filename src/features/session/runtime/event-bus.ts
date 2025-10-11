import type { SessionEvent } from '../data-access/types';
import { authStoreUtils } from '@/stores/auth.store';
import { ArchiveManager } from '@/lib/archive/manager';

const getRepo = () => ArchiveManager.getServices().sessionRepository;

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
        // Persist first so handlers can rely on durable log
        try {
            const uid = (event as any).userId || authStoreUtils.getStoreInstance().requireAuth();
            await getRepo().appendEvent({ ...event, userId: uid } as any);
        } catch {
            await getRepo().appendEvent(event);
        }
        const qos = event.qos || 'async';
        const nonBlockingTypes = new Set<string>([
            'SessionRenamed',
            'DeepResearchModeChanged',
            'SearchRoundPlanned',
            'SearchCandidatesReady',
            'SearchExecuted',
            'PapersIngested',
            'CollectionUpdated',
            'GraphThinkingDelta',
            'GraphRelationsProposed'
        ]);
        const effective: 'sync' | 'async' = qos === 'auto'
            ? (nonBlockingTypes.has(event.type) ? 'async' : 'sync')
            : qos;
        if (effective === 'sync') {
            for (const h of Array.from(subscribers)) {
                try { await Promise.resolve(h(event)); } catch (e) { try { console.warn('[bus][event][handler_error_sync]', BUS_ID, (e as Error)?.message); } catch { } }
            }
        } else {
            for (const h of Array.from(subscribers)) {
                try {
                    void Promise.resolve().then(() => h(event)).catch((e) => {
                        try { console.warn('[bus][event][handler_error]', BUS_ID, (e as Error)?.message); } catch { }
                    });
                } catch (e) {
                    try { console.warn('[bus][event][handler_error_sync]', BUS_ID, (e as Error)?.message); } catch { }
                }
            }
        }
    }
};


