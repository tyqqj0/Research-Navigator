/*
 * ArchiveManager: central place to manage current archiveId and construct per-archive services.
 * Minimal skeleton to enable auth-driven switching; repositories will be plugged in later.
 */

export type ArchiveId = string;
import type { SessionRepository } from '@/features/session/data-access/session-repository';
import { sessionRepository } from '@/features/session/data-access/session-repository';

type Listener = (archiveId: ArchiveId) => void;

// Placeholder service types to be replaced as we wire real repositories
export interface ArchiveServices {
    // Per-archive repositories/services
    sessionRepository: SessionRepository;
}

class ArchiveManagerImpl {
    private currentArchiveId: ArchiveId = 'anonymous';
    private services: ArchiveServices = this.buildServicesForArchive('anonymous');
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

    private buildServicesForArchive(_archiveId: ArchiveId): ArchiveServices {
        // TODO: When per-archive DBs are implemented, construct services using _archiveId
        return {
            sessionRepository
        };
    }

    async setCurrentArchive(archiveId: ArchiveId): Promise<void> {
        if (!archiveId || archiveId === this.currentArchiveId) return;

        // TODO: close old per-archive DB instances when added
        // TODO: build new per-archive repositories here

        this.currentArchiveId = archiveId;
        this.services = this.buildServicesForArchive(archiveId);

        for (const cb of Array.from(this.listeners)) {
            try { cb(this.currentArchiveId); } catch { /* no-op */ }
        }
    }
}

export const ArchiveManager = new ArchiveManagerImpl();


