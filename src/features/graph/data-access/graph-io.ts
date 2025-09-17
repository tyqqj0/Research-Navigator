// Research Graph Domain - Public IO helpers (import/export only)

import type { GraphImportResult } from './graph-types';
import { graphRepository } from './graph-repository';

export async function exportGraphToJson(graphId: string): Promise<string> {
    return await graphRepository.exportGraphToJson(graphId);
}

export async function importGraphFromJson(json: string, options?: { overwrite?: boolean; generateNewId?: boolean }): Promise<GraphImportResult> {
    return await graphRepository.importGraphFromJson(json, options);
}


