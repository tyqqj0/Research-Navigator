export interface SyncConfigOptions {
    enabled: boolean;
    // milliseconds
    debounceMs: number;
    pollIntervalMs: number;
    maxConcurrentSessionPushes: number;
    // base URL for data service; empty disables remote
    dataApiBaseUrl: string;
}

// NEXT_PUBLIC_ for client-side usage
const bool = (v: string | undefined, def: boolean) => {
    if (v === undefined || v === '') return def;
    const s = String(v).toLowerCase();
    return s === '1' || s === 'true' || s === 'on' || s === 'yes';
};

const int = (v: string | undefined, def: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
};

export const syncConfig: SyncConfigOptions = {
    enabled: bool(process.env.NEXT_PUBLIC_SYNC_ENABLED, true),
    debounceMs: int(process.env.NEXT_PUBLIC_SYNC_DEBOUNCE_MS, 2500),
    pollIntervalMs: int(process.env.NEXT_PUBLIC_SYNC_POLL_MS, 45000),
    maxConcurrentSessionPushes: int(process.env.NEXT_PUBLIC_SYNC_MAX_CONCURRENCY, 3),
    dataApiBaseUrl: (process.env.NEXT_PUBLIC_DATA_API_BASE_URL || '').trim(),
};

export function isRemoteSyncAvailable(): boolean {
    return !!syncConfig.dataApiBaseUrl && syncConfig.enabled;
}


