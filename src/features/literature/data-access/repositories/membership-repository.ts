/**
 * 👤 User Library Membership Repository - 按档案记录用户拥有的文献列表
 */

import type { CollectionsArchiveDatabase, UserLibraryMembership } from '../database/collections-database';

export class MembershipRepository {
    constructor(private readonly db: CollectionsArchiveDatabase) { }

    async add(userId: string, paperId: string): Promise<void> {
        const now = new Date();
        await this.db.userLibraryMemberships.put({ userId, paperId, addedAt: now } as UserLibraryMembership);
    }

    async remove(userId: string, paperId: string): Promise<void> {
        await this.db.userLibraryMemberships.delete([userId, paperId]);
    }

    async listByUser(userId: string): Promise<UserLibraryMembership[]> {
        return await (this.db.userLibraryMemberships as any).where('userId').equals(userId).toArray();
    }
}

export function createMembershipRepository(db: CollectionsArchiveDatabase) {
    return new MembershipRepository(db);
}



