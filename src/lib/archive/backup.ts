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
    const archiveId = (ArchiveManager as any).getCurrentArchiveId?.() ?? 'unknown';
    try { console.debug('[backup][export][begin]', { archiveId, userId }); } catch { /* noop */ }

    const settingsJson = useSettingsStore.getState().exportSettings();
    const settings = JSON.parse(settingsJson || '{}');

    const sessionsRepo: any = services.sessionRepository as any;
    const [sessions, events, artifacts] = await Promise.all([
        sessionsRepo.listSessions().catch(() => []),
        sessionsRepo.listEvents(undefined).catch(() => []),
        sessionsRepo.listArtifacts(undefined).catch(() => []),
    ]);
    if (!userId || userId === 'anonymous') {
        try { console.warn('[backup][export][anonymous_user]', { note: 'sessions/messages/events export may be empty due to anonymous gating' }); } catch { /* noop */ }
    }
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

    try {
        console.debug('[backup][export][counts]', {
            sessions: (sessions || []).length,
            messages: (messages || []).length,
            events: (events || []).length,
            artifacts: (artifacts || []).length,
            layouts: (layouts || []).length,
            graphs: graphs.length,
            collections: collections.length,
            collectionItems: collectionItems.length,
            memberships: memberships.length
        });
    } catch { /* noop */ }

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

export async function importArchiveFromJson(json: string, options?: { replace?: boolean }): Promise<{ warnings: string[] }> {
    const userId = authStoreUtils.getStoreInstance().getCurrentUserId() || 'anonymous';
    const services = ArchiveManager.getServices();
    const archiveId = (ArchiveManager as any).getCurrentArchiveId?.() ?? 'unknown';
    const warnings: string[] = [];
    let parsed: FullBackupPayload | undefined;
    try { parsed = JSON.parse(json) as FullBackupPayload; } catch { throw new Error('Invalid backup JSON'); }
    if (!parsed || typeof parsed !== 'object') throw new Error('Invalid backup payload');
    if (parsed.userId && parsed.userId !== userId) {
        warnings.push('Backup created by different userId; importing into current user scope.');
    }
    try {
        console.debug('[backup][import][begin]', { archiveId, userId });
        console.debug('[backup][import][options]', { replaceOption: !!options?.replace });
        console.debug('[backup][import][payload_counts]', {
            sessions: Array.isArray(parsed.sessions) ? parsed.sessions.length : 0,
            messages: Array.isArray(parsed.messages) ? parsed.messages.length : 0,
            events: Array.isArray(parsed.events) ? parsed.events.length : 0,
            artifacts: Array.isArray(parsed.artifacts) ? parsed.artifacts.length : 0,
            layouts: Array.isArray(parsed.layouts) ? parsed.layouts.length : 0,
            graphs: Array.isArray(parsed.graphs) ? parsed.graphs.length : 0,
            collections: Array.isArray(parsed.collections) ? parsed.collections.length : 0,
            memberships: Array.isArray(parsed.memberships) ? parsed.memberships.length : 0
        });
        if (String(archiveId) !== String(userId)) {
            console.debug('[backup][import][archive_user_mismatch]', { archiveId, userId, note: 'writing into current archive with records scoped by userId' });
        }
        if (!userId || userId === 'anonymous') {
            console.warn('[backup][import][anonymous_user]', { note: 'UI may not list sessions for anonymous user; sign in to view session data' });
        }
    } catch { /* noop */ }

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

    // Optional replace mode: prune sessions not present in backup
    const replace = !!options?.replace || (parsed as any)?.replace === true || (parsed as any)?.mode === 'replace';
    try {
        console.debug('[backup][import][replace_flags]', {
            optionsReplace: !!options?.replace,
            payloadReplace: (parsed as any)?.replace === true,
            payloadModeReplace: (parsed as any)?.mode === 'replace',
            computedReplace: replace
        });
    } catch { /* noop */ }
    if (replace) {
        try {
            const existing = await repo.listSessions();
            const incomingIds = new Set<string>((parsed.sessions || []).map((s: any) => String((s as any).id)));
            const toDelete = (existing || []).map((s: any) => String((s as any).id)).filter((id: string) => !incomingIds.has(id));
            try { console.debug('[backup][import][replace_prune_begin]', { existingCount: (existing || []).length, incomingCount: incomingIds.size, toDeleteCount: toDelete.length }); } catch { /* noop */ }
            let deletedCount = 0;
            for (const id of toDelete) {
                try { await repo.deleteSession(id); } catch { /* ignore */ }
                try { await repo.deleteMessagesBySession(id); } catch { /* ignore */ }
                try { await repo.deleteEventsBySession(id); } catch { /* ignore */ }
                try { await repo.deleteLayout?.('default', id); } catch { /* ignore */ }
                deletedCount++;
            }
            try { console.debug('[backup][import][replace_prune]', { deleted: deletedCount }); } catch { /* noop */ }
        } catch { warnings.push('Failed to prune missing sessions'); }
    }

    try { console.info('[backup][import][done]', { warningsCount: warnings.length, replace }); } catch { /* noop */ }
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

export async function uploadAndImportArchiveJson(options?: { replace?: boolean }): Promise<{ warnings: string[] }> {
    try { console.debug('[backup][upload_import][open_dialog]', { options: { replace: !!options?.replace } }); } catch { /* noop */ }
    return await new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.onchange = async (evt) => {
            const file = (evt.target as HTMLInputElement).files?.[0];
            if (!file) { resolve({ warnings: ['No file selected'] }); return; }
            try {
                try { console.debug('[backup][upload_import][file_selected]', { name: file.name, size: file.size, replace: !!options?.replace }); } catch { /* noop */ }
                const text = await file.text();
                const res = await importArchiveFromJson(text, options);
                try { console.debug('[backup][upload_import][result]', { warnings: res?.warnings?.length || 0 }); } catch { /* noop */ }
                resolve(res);
            } catch (e) {
                resolve({ warnings: ['Import failed: ' + String((e as Error)?.message || e)] });
            }
        };
        input.click();
    });
}


