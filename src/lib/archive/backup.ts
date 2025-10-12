// Global backup/export/import utilities (per-archive, per-user)

import { ArchiveManager } from './manager';
import { authStoreUtils } from '@/stores/auth.store';
import { useSettingsStore } from '@/features/user/settings/data-access/settings-store';

export interface FullBackupPayload {
    version: string;
    createdAt: string;
    userId: string;
    settings: any;
    sessions: any[];
    messages: any[];
    events: any[];
    artifacts: any[];
    layouts: any[];
    graphs: Array<{ id: string; name?: string | null; nodes: Record<string, any>; edges: Record<string, any> }>;
    collections: any[];
    collectionItems: any[];
    memberships: any[];
}

export async function exportArchiveToJson(): Promise<string> {
    const userId = authStoreUtils.getStoreInstance().getCurrentUserId() || 'anonymous';
    const services = ArchiveManager.getServices();

    const settingsJson = useSettingsStore.getState().exportSettings();
    const settings = JSON.parse(settingsJson || '{}');

    const sessionsRepo: any = services.sessionRepository as any;
    const [sessions, events, artifacts] = await Promise.all([
        sessionsRepo.listSessions().catch(() => []),
        sessionsRepo.listEvents(undefined).catch(() => []),
        sessionsRepo.listArtifacts(undefined).catch(() => []),
    ]);
    let messages: any[] = [];
    try {
        const per = await Promise.all((sessions || []).map((s: any) => sessionsRepo.listMessages(s.id).catch(() => [])));
        messages = per.flat();
    } catch { messages = []; }
    let layouts: any[] = [];
    try { layouts = await sessionsRepo.listLayouts('default').catch(() => []); } catch { layouts = []; }

    const graphRepo = services.graphRepository as any;
    const graphHeads = await graphRepo.listGraphs().catch(() => [] as any[]);
    const graphs: any[] = [];
    for (const gh of (graphHeads || [])) {
        try { const g = await graphRepo.getGraph(gh.id); if (g) graphs.push(g); } catch { /* ignore */ }
    }

    const collectionsRepo = services.collectionsRepository as any;
    const membershipRepo = services.membershipRepository as any;
    let collections: any[] = [];
    try {
        const res = await collectionsRepo.searchWithFilters({ ownerUid: userId }, { field: 'createdAt', order: 'desc' }, 1, 1000);
        collections = res?.items || [];
    } catch { collections = []; }
    const collectionItems: any[] = [];
    try {
        for (const c of (collections || [])) {
            const ids = (c.paperIds || []) as string[];
            ids.forEach((pid, idx) => {
                collectionItems.push({ collectionId: c.id, paperId: pid, order: idx });
            });
        }
    } catch { /* ignore */ }
    let memberships: any[] = [];
    try { memberships = await membershipRepo.listByUser(userId); } catch { memberships = []; }

    const payload: FullBackupPayload = {
        version: '0.8',
        createdAt: new Date().toISOString(),
        userId,
        settings,
        sessions: sessions || [],
        messages: messages || [],
        events: events || [],
        artifacts: artifacts || [],
        layouts: layouts || [],
        graphs,
        collections,
        collectionItems,
        memberships,
    };

    return JSON.stringify(payload, null, 2);
}

export async function importArchiveFromJson(json: string): Promise<{ warnings: string[] }> {
    const userId = authStoreUtils.getStoreInstance().getCurrentUserId() || 'anonymous';
    const services = ArchiveManager.getServices();
    const warnings: string[] = [];
    let parsed: FullBackupPayload | undefined;
    try { parsed = JSON.parse(json) as FullBackupPayload; } catch { throw new Error('Invalid backup JSON'); }
    if (!parsed || typeof parsed !== 'object') throw new Error('Invalid backup payload');
    if (parsed.userId && parsed.userId !== userId) {
        warnings.push('Backup created by different userId; importing into current user scope.');
    }

    try { if (parsed.settings) { useSettingsStore.getState().updateSettings(parsed.settings); } } catch { warnings.push('Failed to import settings profile.'); }

    const repo: any = services.sessionRepository as any;
    try { if (Array.isArray(parsed.sessions)) await repo.bulkPutSessions(parsed.sessions.map((s: any) => ({ ...s, userId }))); } catch { warnings.push('Failed to import sessions'); }
    try { if (Array.isArray(parsed.messages)) { for (const m of parsed.messages) { try { await repo.putMessage({ ...m, userId }); } catch { } } } } catch { warnings.push('Some messages failed to import'); }
    try { if (Array.isArray(parsed.events)) { for (const e of parsed.events) { try { await repo.appendEvent({ ...e, userId }); } catch { } } } } catch { warnings.push('Some events failed to import'); }
    try { if (Array.isArray(parsed.artifacts)) { for (const a of parsed.artifacts) { try { await repo.putArtifact({ ...a, userId }); } catch { } } } } catch { warnings.push('Some artifacts failed to import'); }
    try { if (Array.isArray(parsed.layouts) && parsed.layouts.length > 0) { await repo.bulkPutLayouts(parsed.layouts.map((l: any) => ({ ...l, userId }))); } } catch { warnings.push('Failed to import session layouts'); }

    try {
        const gr = services.graphRepository as any;
        for (const g of (parsed.graphs || [])) {
            try { await gr.saveGraph({ id: g.id, name: g.name, nodes: g.nodes, edges: g.edges }); } catch { }
        }
    } catch { warnings.push('Some graphs failed to import'); }

    try {
        const col = services.collectionsRepository as any;
        for (const c of (parsed.collections || [])) {
            try {
                const existing = await col.findById?.(c.id).catch(() => null);
                if (existing) await col.update(c.id, c);
                else {
                    try { await col['table']?.put?.(c); } catch { await col.createCollection(c); }
                }
            } catch { }
        }
    } catch { warnings.push('Some collections failed to import'); }
    try {
        const mem = services.membershipRepository as any;
        for (const m of (parsed.memberships || [])) {
            try { await mem.add(userId, m.paperId); } catch { }
        }
    } catch { warnings.push('Some memberships failed to import'); }

    return { warnings };
}

export async function downloadArchiveJson(): Promise<void> {
    const json = await exportArchiveToJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `research-navigator-archive-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export async function uploadAndImportArchiveJson(): Promise<{ warnings: string[] }> {
    return await new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.onchange = async (evt) => {
            const file = (evt.target as HTMLInputElement).files?.[0];
            if (!file) { resolve({ warnings: ['No file selected'] }); return; }
            try {
                const text = await file.text();
                const res = await importArchiveFromJson(text);
                resolve(res);
            } catch (e) {
                resolve({ warnings: ['Import failed: ' + String((e as Error)?.message || e)] });
            }
        };
        input.click();
    });
}


