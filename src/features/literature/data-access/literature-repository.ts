// Literature Domain - Repository (Dexie)
// 文献领域数据仓库

import Dexie, { Table } from 'dexie';
import type {
    LiteratureItem,
    LiteratureCollection,
    CitationRelation,
    LiteratureNote,
    LiteratureSearchQuery,
    LiteratureSearchResult
} from './literature-types';

class LiteratureDatabase extends Dexie {
    literature!: Table<LiteratureItem>;
    collections!: Table<LiteratureCollection>;
    citations!: Table<CitationRelation>;
    notes!: Table<LiteratureNote>;

    constructor() {
        super('ResearchNavigatorLiterature');

        this.version(1).stores({
            literature: 'id, title, *authors, publishedDate, journal, doi, *tags, createdAt, updatedAt',
            collections: 'id, name, createdAt, updatedAt',
            citations: 'id, sourceLiteratureId, targetLiteratureId, relationshipType, createdAt',
            notes: 'id, literatureId, category, createdAt, updatedAt'
        });
    }
}

const db = new LiteratureDatabase();

export class LiteratureRepository {
    // Literature CRUD operations
    async getAllLiterature(): Promise<LiteratureItem[]> {
        return await db.literature.orderBy('createdAt').reverse().toArray();
    }

    async getLiteratureById(id: string): Promise<LiteratureItem | undefined> {
        return await db.literature.get(id);
    }

    async addLiterature(item: LiteratureItem): Promise<string> {
        return await db.literature.add(item);
    }

    async updateLiterature(id: string, updates: Partial<LiteratureItem>): Promise<number> {
        return await db.literature.update(id, { ...updates, updatedAt: new Date() });
    }

    async deleteLiterature(id: string): Promise<void> {
        await db.literature.delete(id);
        // Also delete related notes and citations
        await this.deleteNotesByLiteratureId(id);
        await this.deleteCitationsByLiteratureId(id);
    }

    // Search operations
    async searchLiterature(query: LiteratureSearchQuery): Promise<LiteratureSearchResult> {
        let collection = db.literature.toCollection();

        // Apply filters
        if (query.query) {
            collection = collection.filter(item =>
                item.title.toLowerCase().includes(query.query!.toLowerCase()) ||
                item.abstract?.toLowerCase().includes(query.query!.toLowerCase()) ||
                item.authors.some(author => author.toLowerCase().includes(query.query!.toLowerCase()))
            );
        }

        if (query.tags && query.tags.length > 0) {
            collection = collection.filter(item =>
                query.tags!.some(tag => item.tags.includes(tag))
            );
        }

        if (query.authors && query.authors.length > 0) {
            collection = collection.filter(item =>
                query.authors!.some(author =>
                    item.authors.some(itemAuthor =>
                        itemAuthor.toLowerCase().includes(author.toLowerCase())
                    )
                )
            );
        }

        if (query.dateRange) {
            collection = collection.filter(item => {
                if (!item.publishedDate) return false;
                return item.publishedDate >= query.dateRange!.start &&
                    item.publishedDate <= query.dateRange!.end;
            });
        }

        const items = await collection.toArray();

        return {
            items,
            total: items.length,
            page: 1,
            pageSize: items.length
        };
    }

    // Collection operations
    async getAllCollections(): Promise<LiteratureCollection[]> {
        return await db.collections.orderBy('name').toArray();
    }

    async addCollection(collection: LiteratureCollection): Promise<string> {
        return await db.collections.add(collection);
    }

    async updateCollection(id: string, updates: Partial<LiteratureCollection>): Promise<number> {
        return await db.collections.update(id, { ...updates, updatedAt: new Date() });
    }

    async deleteCollection(id: string): Promise<void> {
        await db.collections.delete(id);
    }

    // Note operations
    async getNotesByLiteratureId(literatureId: string): Promise<LiteratureNote[]> {
        return await db.notes.where('literatureId').equals(literatureId).toArray();
    }

    async addNote(note: LiteratureNote): Promise<string> {
        return await db.notes.add(note);
    }

    async updateNote(id: string, updates: Partial<LiteratureNote>): Promise<number> {
        return await db.notes.update(id, { ...updates, updatedAt: new Date() });
    }

    async deleteNote(id: string): Promise<void> {
        await db.notes.delete(id);
    }

    async deleteNotesByLiteratureId(literatureId: string): Promise<number> {
        return await db.notes.where('literatureId').equals(literatureId).delete();
    }

    // Citation operations
    async getCitationsByLiteratureId(literatureId: string): Promise<CitationRelation[]> {
        return await db.citations
            .where('sourceLiteratureId').equals(literatureId)
            .or('targetLiteratureId').equals(literatureId)
            .toArray();
    }

    async addCitation(citation: CitationRelation): Promise<string> {
        return await db.citations.add(citation);
    }

    async deleteCitation(id: string): Promise<void> {
        await db.citations.delete(id);
    }

    async deleteCitationsByLiteratureId(literatureId: string): Promise<number> {
        return await db.citations
            .where('sourceLiteratureId').equals(literatureId)
            .or('targetLiteratureId').equals(literatureId)
            .delete();
    }

    // Bulk operations
    async bulkAddLiterature(items: LiteratureItem[]): Promise<string[]> {
        return await db.literature.bulkAdd(items, { allKeys: true });
    }

    async exportData(): Promise<{
        literature: LiteratureItem[];
        collections: LiteratureCollection[];
        citations: CitationRelation[];
        notes: LiteratureNote[];
    }> {
        const [literature, collections, citations, notes] = await Promise.all([
            this.getAllLiterature(),
            this.getAllCollections(),
            db.citations.toArray(),
            db.notes.toArray()
        ]);

        return { literature, collections, citations, notes };
    }

    async importData(data: {
        literature?: LiteratureItem[];
        collections?: LiteratureCollection[];
        citations?: CitationRelation[];
        notes?: LiteratureNote[];
    }): Promise<void> {
        await db.transaction('rw', [db.literature, db.collections, db.citations, db.notes], async () => {
            if (data.literature) {
                await db.literature.bulkPut(data.literature);
            }
            if (data.collections) {
                await db.collections.bulkPut(data.collections);
            }
            if (data.citations) {
                await db.citations.bulkPut(data.citations);
            }
            if (data.notes) {
                await db.notes.bulkPut(data.notes);
            }
        });
    }
}

// Singleton instance
export const literatureRepository = new LiteratureRepository();
