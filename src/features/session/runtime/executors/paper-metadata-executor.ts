import { literatureDataAccess } from '@/features/literature/data-access';

export interface BriefPaperMeta { id: string; title: string; firstAuthor?: string; year?: number; abstract?: string }

export const paperMetadataExecutor = {
    async fetchBriefs(paperIds: string[]): Promise<BriefPaperMeta[]> {
        const items = await Promise.all(paperIds.map(async (id) => {
            try {
                const item = await literatureDataAccess.literatures.getEnhanced(id as any);
                return {
                    id,
                    title: item?.literature?.title || id,
                    firstAuthor: item?.literature?.authors?.[0]?.name,
                    year: item?.literature?.year,
                    abstract: item?.literature?.abstract
                } as BriefPaperMeta;
            } catch {
                return { id, title: id } as BriefPaperMeta;
            }
        }));
        return items;
    }
};


