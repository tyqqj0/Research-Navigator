import { useCallback } from 'react';
import { literatureEntry } from '../data-access';
import type {
    CreateLiteratureInput,
    UpdateLiteratureInput,
    UpdateUserLiteratureMetaInput,
    LibraryItem,
} from '../data-access/models';

export interface UseLiteratureCommandsReturn {
    addByIdentifier: (identifier: string, options?: {
        autoExtractCitations?: boolean;
        addToCollection?: string;
        addToCollections?: string[];
        tags?: string[];
        userMeta?: Partial<import('../data-access/models').CreateUserLiteratureMetaInput> | Partial<import('../data-access/models').UpdateUserLiteratureMetaInput>;
    }) => Promise<LibraryItem>;
    batchImport: (entries: Array<{ type: 'identifier'; data: string; options?: any }>) => Promise<{
        successful: LibraryItem[];
        failed: Array<{ entry: any; error: string }>;
    }>;
    deleteLiterature: (paperId: string) => Promise<boolean>;
    updateLiterature: (paperId: string, updates: UpdateLiteratureInput) => Promise<boolean>;
    updateUserMeta: (paperId: string, updates: UpdateUserLiteratureMetaInput) => Promise<boolean>;
}

export const useLiteratureCommands = (): UseLiteratureCommandsReturn => {
    const addByIdentifier = useCallback(async (
        identifier: string,
        options: Parameters<typeof literatureEntry.addByIdentifier>[1]
    ) => {
        return literatureEntry.addByIdentifier(identifier, options);
    }, []);

    const batchImport = useCallback(async (
        entries: Array<{ type: 'identifier'; data: string; options?: any }>
    ) => {
        return literatureEntry.batchImport(entries);
    }, []);

    const deleteLiterature = useCallback(async (paperId: string) => {
        return literatureEntry.deleteLiterature(paperId);
    }, []);

    const updateLiterature = useCallback(async (
        paperId: string,
        updates: UpdateLiteratureInput
    ) => {
        return literatureEntry.updateLiterature(paperId, updates);
    }, []);

    const updateUserMeta = useCallback(async (
        paperId: string,
        updates: UpdateUserLiteratureMetaInput
    ) => {
        return literatureEntry.updateUserMeta(paperId, updates);
    }, []);

    return {
        addByIdentifier,
        batchImport,
        deleteLiterature,
        updateLiterature,
        updateUserMeta,
    };
};

export default useLiteratureCommands;
