/**
 * Snapshot SDK interfaces (stub) – to be implemented after backend is ready.
 */

import type { DataClient } from '@/lib/autolabz/data-client';

export interface SnapshotLoadResult<T = any> {
    data: T;
    revision: string;
}

export interface SnapshotClient {
    load<T = any>(): Promise<SnapshotLoadResult<T>>;
    save<T = any>(data: T, currentRevision: string): Promise<{ newRevision: string }>;
}

export function createSnapshotClient(_dataClient: DataClient, _baseUrl = '/api/v1/snapshot'): SnapshotClient {
    return {
        async load() {
            throw new Error('Snapshot SDK not wired yet. Backend not ready.');
        },
        async save() {
            throw new Error('Snapshot SDK not wired yet. Backend not ready.');
        },
    } as SnapshotClient;
}


