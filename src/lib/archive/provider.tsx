import React, { useEffect, useMemo } from 'react';
import { ArchiveManager, type ArchiveId, type ArchiveServices } from './manager';
import { useAuthStore } from '@/stores/auth.store';

const ArchiveServicesContext = React.createContext<ArchiveServices | null>(null);

export function ArchiveProvider({ archiveIdOverride, children }: { archiveIdOverride?: string; children: React.ReactNode }) {
    const currentUser = useAuthStore(s => s.currentUser);

    const archiveId: ArchiveId = useMemo(() => {
        return archiveIdOverride || currentUser?.id || 'anonymous';
    }, [archiveIdOverride, currentUser?.id]);

    useEffect(() => {
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


