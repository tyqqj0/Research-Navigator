/*
 * ArchiveManager: central place to manage current archiveId and construct per-archive services.
 * Minimal skeleton to enable auth-driven switching; repositories will be plugged in later.
 */

export type ArchiveId = string;

type Listener = (archiveId: ArchiveId) => void;

// Placeholder service types to be replaced as we wire real repositories
export interface ArchiveServices {
    // per-archive services (to be filled in later)
}

class ArchiveManagerImpl {
    private currentArchiveId: ArchiveId = 'anonymous';
    private services: ArchiveServices = {} as ArchiveServices;
    private listeners = new Set<Listener>();

    getCurrentArchiveId(): ArchiveId {
        return this.currentArchiveId;
    }

    getServices(): ArchiveServices {
        return this.services;
    }

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    async setCurrentArchive(archiveId: ArchiveId): Promise<void> {
        if (!archiveId || archiveId === this.currentArchiveId) return;

        // TODO: close old per-archive DB instances when added
        // TODO: build new per-archive repositories here

        this.currentArchiveId = archiveId;
        this.services = {} as ArchiveServices; // rebuild later when repositories are wired

        for (const cb of Array.from(this.listeners)) {
            try { cb(this.currentArchiveId); } catch { /* no-op */ }
        }
    }
}

export const ArchiveManager = new ArchiveManagerImpl();


