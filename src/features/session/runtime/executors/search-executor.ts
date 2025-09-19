import type { Artifact } from '../../data-access/types';

// Mock search: generate N fake paperIds based on query hash
function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0; return Math.abs(h); }

export const searchExecutor = {
    async execute(query: string, size: number = 12): Promise<Artifact<{ paperIds: string[]; query: string }>> {
        const base = hash(query).toString(36).slice(0, 6);
        const paperIds = Array.from({ length: size }).map((_, i) => `paper_${base}_${i}`);
        return { id: crypto.randomUUID(), kind: 'search_batch', version: 1, data: { paperIds, query }, createdAt: Date.now() };
    }
};


