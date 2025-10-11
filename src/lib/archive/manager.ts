/*
 * ArchiveManager: central place to manage current archiveId and construct per-archive services.
 * Minimal skeleton to enable auth-driven switching; repositories will be plugged in later.
 */

export type ArchiveId = string;
import type { SessionRepository } from '@/features/session/data-access/session-repository';
import { createSessionRepository } from '@/features/session/data-access/session-repository';
import type { GraphRepository } from '@/features/graph/data-access/graph-repository';
import { createGraphRepository } from '@/features/graph/data-access/graph-repository';
import type { NotesRepository } from '@/features/notes/data-access/notes-repository';
import { createNotesRepository } from '@/features/notes/data-access/notes-repository';
import { createCollectionsDatabase } from '@/features/literature/data-access/database/collections-database';
import { createCollectionRepository } from '@/features/literature/data-access/repositories/collection-repository';
import { createMembershipRepository } from '@/features/literature/data-access/repositories/membership-repository';

type Listener = (archiveId: ArchiveId) => void;

// Placeholder service types to be replaced as we wire real repositories
export interface ArchiveServices {
    // Per-archive repositories/services
    sessionRepository: SessionRepository;
    graphRepository: GraphRepository;
    notesRepository: NotesRepository;
    collectionsRepository: ReturnType<typeof createCollectionRepository>;
    membershipRepository: ReturnType<typeof createMembershipRepository>;
}

class ArchiveManagerImpl {
    private disposableRepos: { graphRepository?: GraphRepository; notesRepository?: NotesRepository; sessionRepository?: SessionRepository; collectionsDb?: ReturnType<typeof createCollectionsDatabase>; } = {};
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
        // Build per-archive repositories/services
        const graphRepository = createGraphRepository(_archiveId);
        const notesRepository = createNotesRepository(_archiveId);
        const sessionRepository = createSessionRepository(_archiveId);
        const collectionsDb = createCollectionsDatabase(_archiveId);
        const collectionsRepository = createCollectionRepository(collectionsDb);
        const membershipRepository = createMembershipRepository(collectionsDb);
        this.disposableRepos.graphRepository = graphRepository;
        this.disposableRepos.notesRepository = notesRepository;
        this.disposableRepos.sessionRepository = sessionRepository;
        this.disposableRepos.collectionsDb = collectionsDb;
        return {
            sessionRepository,
            graphRepository,
            notesRepository,
            collectionsRepository,
            membershipRepository,
        };
    }

    async setCurrentArchive(archiveId: ArchiveId): Promise<void> {
        if (!archiveId || archiveId === this.currentArchiveId) return;

        // Close old per-archive resources
        try { this.disposableRepos.graphRepository?.close(); } catch { /* ignore */ }
        try { this.disposableRepos.notesRepository?.close(); } catch { /* ignore */ }
        try { this.disposableRepos.sessionRepository?.close(); } catch { /* ignore */ }
        try { this.disposableRepos.collectionsDb?.close(); } catch { /* ignore */ }
        this.disposableRepos = {};

        this.currentArchiveId = archiveId;
        this.services = this.buildServicesForArchive(archiveId);

        for (const cb of Array.from(this.listeners)) {
            try { cb(this.currentArchiveId); } catch { /* no-op */ }
        }
    }
}

export const ArchiveManager = new ArchiveManagerImpl();


