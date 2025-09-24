import { literatureDataAccess } from '@/features/literature/data-access';
import { sessionRepository } from '../../data-access/session-repository';
import type { Artifact, SessionEvent } from '../../data-access/types';

export interface BriefPaperMeta { id: string; title: string; firstAuthor?: string; year?: number; publicationDate?: string; abstract?: string }

export const paperMetadataExecutor = {
    async fetchBriefs(paperIds: string[]): Promise<BriefPaperMeta[]> {
        const items = await Promise.all(paperIds.map(async (id) => {
            try {
                const item = await literatureDataAccess.literatures.getEnhanced(id as any);
                return {
                    id,
                    title: item?.literature?.title || id,
                    firstAuthor: (item?.literature?.authors && item.literature.authors.length > 0) ? String(item.literature.authors[0]) : undefined,
                    year: item?.literature?.year,
                    publicationDate: item?.literature?.publicationDate,
                    abstract: item?.literature?.abstract
                } as BriefPaperMeta;
            } catch {
                return { id, title: id } as BriefPaperMeta;
            }
        }));
        return items;
    },

    async fetchLastRoundBrief(sessionId: string, limit: number = 8): Promise<BriefPaperMeta[]> {
        try {
            const events = await sessionRepository.listEvents(sessionId);
            const searchExecuted = [...(events as SessionEvent[])].filter(e => e.type === 'SearchExecuted');
            if (!searchExecuted.length) return [];
            const last = searchExecuted[searchExecuted.length - 1] as any;
            const batchId = last?.payload?.batchId as string | undefined;
            if (!batchId) return [];
            const artifact = await sessionRepository.getArtifact(batchId) as Artifact | null;
            const paperIds: string[] = (artifact as any)?.data?.paperIds || [];
            if (!paperIds.length) return [];
            return await this.fetchBriefs(paperIds.slice(0, Math.max(0, limit)));
        } catch {
            return [];
        }
    }
};


