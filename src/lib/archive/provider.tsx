"use client";
import React, { useEffect, useMemo } from 'react';
import { ArchiveManager, type ArchiveId, type ArchiveServices } from './manager';
import { useAuthStore } from '@/stores/auth.store';

const ArchiveServicesContext = React.createContext<ArchiveServices | null>(null);

export function ArchiveProvider({ archiveIdOverride, children }: { archiveIdOverride?: string; children: React.ReactNode }) {
    const currentUser = useAuthStore(s => s.currentUser);

    const archiveId: ArchiveId = useMemo(() => {
        const id = archiveIdOverride || currentUser?.id || 'anonymous';
        try { console.debug('[archive][provider][select_archiveId]', { archiveId: id, hasUser: !!currentUser?.id }); } catch { /* noop */ }
        return id;
    }, [archiveIdOverride, currentUser?.id]);

    useEffect(() => {
        try { console.debug('[archive][provider][effect_setCurrentArchive]', { archiveId }); } catch { /* noop */ }
        void ArchiveManager.setCurrentArchive(archiveId);
    }, [archiveId]);

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


