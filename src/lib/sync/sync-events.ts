type WriteKind = 'session' | 'message' | 'event' | 'layout' | 'delete';

export interface LocalWriteEvent {
    sessionId: string;
    kind: WriteKind;
}

type Listener = (e: LocalWriteEvent) => void;

const listeners = new Set<Listener>();

export function subscribeLocalWrites(fn: Listener): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
}

export function notifyLocalSessionWrite(e: LocalWriteEvent): void {
    for (const l of Array.from(listeners)) {
        try { l(e); } catch { /* noop */ }
    }
}


