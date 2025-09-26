import { useSettingsStore } from '@/features/user/settings/data-access/settings-store';
import type { DatasetAuthConfig, DatasetNode, DatasetPaperItem, DatasetNoteItem } from './dataset-types';
import type { IDatasetAdapter } from './dataset-adapter';
import { ExampleDatasetProvider } from './providers/example-provider';

function selectAdapter(provider?: string): IDatasetAdapter {
    // TODO: add real providers mapping
    return new ExampleDatasetProvider();
}

function resolveAuthConfig(override?: Partial<DatasetAuthConfig>): DatasetAuthConfig {
    const ds = useSettingsStore.getState().dataset;
    return {
        apiKey: override?.apiKey ?? ds?.apiKey ?? process.env.NEXT_PUBLIC_DATASET_API_KEY,
        apiBase: override?.apiBase ?? ds?.apiBase ?? process.env.NEXT_PUBLIC_DATASET_API_BASE,
        libraryId: override?.libraryId ?? ds?.libraryId ?? process.env.NEXT_PUBLIC_DATASET_LIBRARY_ID
    };
}

class DatasetServiceImpl {
    private adapter: IDatasetAdapter | null = null;
    private connected = false;

    private async ensureAdapter(override?: Partial<DatasetAuthConfig>) {
        if (!this.adapter) {
            const provider = useSettingsStore.getState().dataset?.provider;
            this.adapter = selectAdapter(provider);
        }
        if (!this.connected) {
            const cfg = resolveAuthConfig(override);
            const res = await this.adapter!.connect(cfg);
            this.connected = !!res.ok;
            if (!this.connected) throw new Error(res.message || 'Dataset connect failed');
        }
    }

    async listNodes(opts?: { authOverride?: Partial<DatasetAuthConfig> }): Promise<DatasetNode[]> {
        await this.ensureAdapter(opts?.authOverride);
        return this.adapter!.listNodes();
    }

    async listPapers(nodeId: string, opts?: { cursor?: string; limit?: number; authOverride?: Partial<DatasetAuthConfig> }): Promise<{ items: DatasetPaperItem[]; next?: string }> {
        await this.ensureAdapter(opts?.authOverride);
        return this.adapter!.listPapers(nodeId, { cursor: opts?.cursor, limit: opts?.limit });
    }

    async listNotesByPaper(paperExternalId: string, opts?: { authOverride?: Partial<DatasetAuthConfig> }): Promise<DatasetNoteItem[]> {
        await this.ensureAdapter(opts?.authOverride);
        return this.adapter!.listNotesByPaper(paperExternalId);
    }
}

export const datasetService = new DatasetServiceImpl();


