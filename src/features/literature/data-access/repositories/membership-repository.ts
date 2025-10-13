/**
 * 👤 User Library Membership Repository - 按档案记录用户拥有的文献列表
 */

import type { CollectionsArchiveDatabase, UserLibraryMembership } from '../database/collections-database';

export class MembershipRepository {
    constructor(private readonly db: CollectionsArchiveDatabase) { }

    private async ensureDbOpen(): Promise<void> {
        const anyDb: any = this.db as any;
        try {
            if (typeof anyDb?.isOpen === 'function' && !anyDb.isOpen()) {
                await anyDb.open();
            }
        } catch { /* noop */ }
    }

    private async withDexieRetry<T>(op: () => Promise<T>, attempts = 2): Promise<T> {
        let lastErr: unknown = null;
        for (let i = 0; i < Math.max(1, attempts); i++) {
            try {
                await this.ensureDbOpen();
                return await op();
            } catch (e: any) {
                lastErr = e;
                const msg = String(e?.message || e || '');
                const transient = msg.includes('Database has been closed') || msg.includes('DatabaseClosedError') || msg.includes('InvalidState') || msg.includes('VersionChangeError');
                if (!transient || i === attempts - 1) break;
                try { await new Promise(r => setTimeout(r, 40 + i * 40)); } catch { /* noop */ }
            }
        }
        throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
    }

    async add(userId: string, paperId: string): Promise<void> {
        const now = new Date();
        await this.withDexieRetry(async () => {
            return await this.db.userLibraryMemberships.put({ userId, paperId, addedAt: now } as UserLibraryMembership);
        });
    }

    async remove(userId: string, paperId: string): Promise<void> {
        await this.withDexieRetry(async () => {
            return await this.db.userLibraryMemberships.delete([userId, paperId]);
        });
    }

    async listByUser(userId: string): Promise<UserLibraryMembership[]> {
        return await this.withDexieRetry(async () => {
            return await (this.db.userLibraryMemberships as any).where('userId').equals(userId).toArray();
        });
    }
}

export function createMembershipRepository(db: CollectionsArchiveDatabase) {
    return new MembershipRepository(db);
}



