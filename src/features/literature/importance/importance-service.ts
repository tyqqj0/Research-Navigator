import type {
    ImportanceEvaluator,
    MainlineStrategy,
    RankOptions,
    RankedScore,
    ThresholdMethod,
    ThresholdParams,
    ThresholdResult
} from './ports/types';
import { LocalImportanceAdapter } from './adapters/local-importance-adapter';

type ImportanceServiceConfig = {
    useRemote?: boolean; // reserved for future
};

export class ImportanceService implements ImportanceEvaluator {
    private readonly local: LocalImportanceAdapter;
    private readonly config: ImportanceServiceConfig;

    constructor(config?: ImportanceServiceConfig) {
        this.local = new LocalImportanceAdapter();
        this.config = { useRemote: false, ...(config || {}) };
    }

    async scoreForPaperIds(paperIds: string[], opts?: RankOptions): Promise<RankedScore[]> {
        // Only local for now
        return await this.local.scoreForPaperIds(paperIds, opts);
    }

    async rankPaperIds(paperIds: string[], opts?: RankOptions): Promise<RankedScore[]> {
        return await this.local.rankPaperIds(paperIds, opts);
    }

    async rankCollection(collectionId: string, opts?: RankOptions): Promise<RankedScore[]> {
        return await this.local.rankCollection(collectionId, opts);
    }

    computeThreshold(scores: number[], method?: ThresholdMethod, params?: ThresholdParams): ThresholdResult {
        return this.local.computeThreshold(scores, method, params);
    }

    async selectMainlineFromPaperIds(paperIds: string[], strategy?: MainlineStrategy): Promise<string[]> {
        return await this.local.selectMainlineFromPaperIds(paperIds, strategy);
    }

    async selectMainlineFromCollection(collectionId: string, strategy?: MainlineStrategy): Promise<string[]> {
        return await this.local.selectMainlineFromCollection(collectionId, strategy);
    }
}

export const importanceService = new ImportanceService();




