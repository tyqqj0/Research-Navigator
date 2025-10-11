/**
 * 📚 Collections Archive Database - 按档案隔离的集合与用户文库数据库
 */

import Dexie, { Table } from 'dexie';
import type { Collection } from '../models';

export type CollectionItem = {
    collectionId: string;
    paperId: string;
    addedAt: Date;
    addedBy: string;
    order: number;
};

export type UserLibraryMembership = {
    userId: string;
    paperId: string;
    addedAt: Date;
};

export class CollectionsArchiveDatabase extends Dexie {
    collections!: Table<Collection, string>;
    collectionItems!: Table<CollectionItem, [string, string]>;
    userLibraryMemberships!: Table<UserLibraryMembership, [string, string]>; // [userId+paperId]

    constructor(dbName: string) {
        super(dbName);
        this.version(2).stores({
            collections: `
                &id,
                ownerUid,
                name,
                description,
                type,
                isPublic,
                createdAt,
                updatedAt,
                parentId
            `.replace(/\s+/g, ' ').trim(),
            collectionItems: `
                &[collectionId+paperId],
                collectionId,
                paperId,
                addedAt,
                addedBy,
                order,
                [collectionId+addedAt],
                [paperId+addedAt]
            `.replace(/\s+/g, ' ').trim(),
            userLibraryMemberships: `
                &[userId+paperId],
                userId,
                paperId,
                addedAt
            `.replace(/\s+/g, ' ').trim()
        });
    }
}

export function createCollectionsDatabase(archiveId: string): CollectionsArchiveDatabase {
    const safeId = String(archiveId || 'anonymous').slice(0, 64);
    const dbName = `RN_Collections__${safeId}`;
    return new CollectionsArchiveDatabase(dbName);
}


