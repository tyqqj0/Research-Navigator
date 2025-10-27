"use client";
import React, { useEffect, useMemo } from 'react';
import { ArchiveManager, type ArchiveId, type ArchiveServices } from './manager';
import { useAuthStore } from '@/stores/auth.store';
import { syncConfig } from '@/config/sync.config';
import { NoopKVClient } from '@/lib/sync/kv-client';
import { DataSyncService } from '@/lib/sync/data-sync-service';
import { SyncController } from '@/lib/sync/sync-controller';

const ArchiveServicesContext = React.createContext<ArchiveServices | null>(null);

export function ArchiveProvider({ archiveIdOverride, children }: { archiveIdOverride?: string; children: React.ReactNode }) {
    const currentUser = useAuthStore(s => s.currentUser);
    const [controller, setController] = React.useState<SyncController | null>(null);

    const archiveId: ArchiveId = useMemo(() => {
        const id = archiveIdOverride || currentUser?.id || 'anonymous';
        try { console.debug('[archive][provider][select_archiveId]', { archiveId: id, hasUser: !!currentUser?.id }); } catch { /* noop */ }
        return id;
    }, [archiveIdOverride, currentUser?.id]);

    useEffect(() => {
        try { console.debug('[archive][provider][effect_setCurrentArchive]', { archiveId }); } catch { /* noop */ }
        void ArchiveManager.setCurrentArchive(archiveId);
        // Build or teardown sync controller tied to archive + user
        try {
            if (controller) { controller.stop(); setController(null); }
            if (!syncConfig.enabled) return;
            if (!currentUser?.id) return;
            const services = ArchiveManager.getServices();
            const kv = new NoopKVClient(); // replace with real client when backend available
            const svc = new DataSyncService({ kv, repo: services.sessionRepository, archiveId });
            const ctrl = new SyncController(svc);
            ctrl.start();
            setController(ctrl);
        } catch { /* noop */ }
        return () => { try { controller?.stop(); } catch { /* noop */ } };
    }, [archiveId, currentUser?.id]);

    const services = useMemo(() => ArchiveManager.getServices(), [archiveId]);

    return (
        <ArchiveServicesContext.Provider value={services}>
            {children}
        </ArchiveServicesContext.Provider>
    );
}

export function useArchiveServices(): ArchiveServices {
    const ctx = React.useContext(ArchiveServicesContext);
    if (!ctx) throw new Error('useArchiveServices must be used within ArchiveProvider');
    return ctx;
}


