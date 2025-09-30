"use client";

import { useCallback, useMemo, useRef, useState } from 'react';
import { literatureEntry, normalizeLiteratureIdentifier } from '@/features/literature/data-access';
import { backendApiService } from '@/features/literature/data-access/services/backend-api-service';
import { webDiscovery } from '@/features/literature/discovery/web-discovery-service';

export interface QuickAddCandidate {
    id: string;
    title?: string;
    snippet?: string;
    bestIdentifier?: string | null;
    meta?: Record<string, any>;
}

export type QuickAddMode = 'idle' | 'identifier' | 'search';

export interface UseLiteratureQuickAddOptions {
    defaultCollectionId?: string | null;
}

export interface UseLiteratureQuickAddReturn {
    input: string;
    setInput: (v: string) => void;
    mode: QuickAddMode;
    isLoading: boolean;
    error: string | null;
    selectedCollectionId: string | null;
    setSelectedCollectionId: (id: string | null) => void;
    candidates: QuickAddCandidate[];
    parseOrSearch: () => Promise<void>;
    addSingle: (identifier?: string) => Promise<string | null>;
    addMultiple: (identifiers: string[]) => Promise<{ success: string[]; failed: Array<{ id: string; error: string }> }>;
    reset: () => void;
}

const HEX40_RE = /^[0-9a-fA-F]{40}$/;

export function useLiteratureQuickAdd(options: UseLiteratureQuickAddOptions = {}): UseLiteratureQuickAddReturn {
    const { defaultCollectionId = null } = options;

    const [input, setInput] = useState('');
    const [mode, setMode] = useState<QuickAddMode>('idle');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [candidates, setCandidates] = useState<QuickAddCandidate[]>([]);
    const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(defaultCollectionId || null);

    const lastQueryRef = useRef<string>('');

    const parseOrSearch = useCallback(async () => {
        const raw = (input || '').trim();
        if (!raw) return;
        setIsLoading(true);
        setError(null);
        setCandidates([]);
        lastQueryRef.current = raw;

        try {
            // Decision tree
            // 1) explicit prefix or URL/DOI handling using helper
            const byHelper = normalizeLiteratureIdentifier(raw).normalized;

            // Do NOT auto-treat bare 40-hex as S2 without explicit prefix
            const normalizedCandidate = byHelper;

            // Accept as identifier only if clearly valid.
            const s2Payload = normalizedCandidate.match(/^(.+)$/i)?.[1] || null;
            const isValidS2 = !!(s2Payload && HEX40_RE.test(s2Payload));
            const isOtherKnownPrefix = /^(CorpusId:|DOI:|ARXIV:|MAG:|ACL:|PMID:|PMCID:)/i.test(normalizedCandidate);
            const acceptAsIdentifier = isValidS2 || isOtherKnownPrefix;

            if (acceptAsIdentifier) {
                setMode('identifier');
                // Prefetch metadata to render a richer single-candidate card. Ignore prefetch errors silently.
                try {
                    const item = await backendApiService.getPaper(normalizedCandidate);
                    const snippet = (item as any)?.abstract ? String((item as any).abstract) : undefined;
                    setCandidates([
                        {
                            id: 'id-0',
                            title: item?.title,
                            snippet,
                            bestIdentifier: normalizedCandidate,
                            meta: { kind: 'identifier', paperId: item?.paperId, year: (item as any)?.year, publication: (item as any)?.publication },
                        },
                    ]);
                } catch {
                    setCandidates([
                        { id: 'id-0', title: undefined, snippet: undefined, bestIdentifier: normalizedCandidate, meta: { kind: 'identifier' } },
                    ]);
                }
                return;
            }

            // 2) Fallback to discovery search (natural language)
            setMode('search');
            const dom = (require('@/features/user/settings/data-access/settings-store') as any).useSettingsStore?.getState?.().search?.searchDomainStrategy?.tavily?.domains || { predefined: [], custom: [] };
            const includeDomains = [...(dom.predefined || []), ...(dom.custom || [])].filter(Boolean);
            const res = await webDiscovery.searchWeb(raw, { limit: 8, includeDomains: includeDomains.length ? includeDomains : undefined });
            const mapped: QuickAddCandidate[] = (res?.candidates || []).map((c: any) => ({
                id: String(c.id || cryptoRandomId()),
                title: c.title,
                snippet: c.snippet || c.description,
                bestIdentifier: c.bestIdentifier || null,
                meta: c,
            }));

            // Prefetch metadata for candidates that have a valid identifier (skip URL and invalid S2)
            const idsForPrefetch = Array.from(new Set(
                mapped
                    .map((c) => c.bestIdentifier)
                    .filter((v): v is string => typeof v === 'string' && v.length > 0)
                    .map((v) => v.trim())
                    .map((v) => {
                        const isBareHex = HEX40_RE.test(v);
                        if (isBareHex && !/^\w+:/.test(v)) return `${v}`;
                        return v;
                    })
                    .filter((v) => {
                        if (/^URL:/i.test(v)) return false;
                        const s2 = v.match(/^(.+)$/i)?.[1] || null;
                        if (s2 && !HEX40_RE.test(s2)) return false;
                        return /^(|CorpusId:|DOI:|ARXIV:|MAG:|ACL:|PMID:|PMCID:)/i.test(v);
                    })
            ));

            if (idsForPrefetch.length > 0) {
                try {
                    const items = await backendApiService.getPapersBatch(idsForPrefetch);
                    const byId = new Map<string, any>();
                    (items || []).forEach((it: any) => { if (it?.paperId) byId.set(String(it.paperId), it); });

                    const enhanced = mapped.map((c) => {
                        const rawId = c.bestIdentifier?.trim() || '';
                        const normId = HEX40_RE.test(rawId) && !/^\w+:/.test(rawId) ? `${rawId}` : rawId;
                        const item = normId ? byId.get(normId) : undefined;
                        if (item) {
                            return {
                                ...c,
                                title: c.title || item.title,
                                snippet: c.snippet || (item as any)?.abstract,
                                meta: { ...c.meta, paperId: item.paperId, year: (item as any)?.year, publication: (item as any)?.publication },
                            } as QuickAddCandidate;
                        }
                        return c;
                    });
                    setCandidates(enhanced);
                } catch {
                    setCandidates(mapped);
                }
            } else {
                setCandidates(mapped);
            }
        } catch (e: any) {
            setError(e?.message || '解析失败');
        } finally {
            setIsLoading(false);
        }
    }, [input]);

    const addSingle = useCallback(async (identifier?: string): Promise<string | null> => {
        const id = (identifier || candidates[0]?.bestIdentifier || '').trim();
        if (!id) return null;
        setIsLoading(true);
        setError(null);
        try {
            const opt: any = {};
            if (selectedCollectionId) opt.addToCollection = selectedCollectionId;
            const item = await literatureEntry.addByIdentifier(id, opt);
            return item.paperId;
        } catch (e: any) {
            setError(e?.message || '添加失败');
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [candidates, selectedCollectionId]);

    const addMultiple = useCallback(async (identifiers: string[]) => {
        const uniq = Array.from(new Set((identifiers || []).filter(Boolean)));
        const success: string[] = [];
        const failed: Array<{ id: string; error: string }> = [];
        for (const id of uniq) {
            try {
                const opt: any = {};
                if (selectedCollectionId) opt.addToCollection = selectedCollectionId;
                const item = await literatureEntry.addByIdentifier(id, opt);
                success.push(item.paperId);
            } catch (e: any) {
                failed.push({ id, error: e?.message || '添加失败' });
            }
        }
        return { success, failed };
    }, [selectedCollectionId]);

    const reset = useCallback(() => {
        setInput('');
        setMode('idle');
        setError(null);
        setCandidates([]);
        setSelectedCollectionId(defaultCollectionId || null);
    }, [defaultCollectionId]);

    return {
        input,
        setInput,
        mode,
        isLoading,
        error,
        selectedCollectionId,
        setSelectedCollectionId,
        candidates,
        parseOrSearch,
        addSingle,
        addMultiple,
        reset,
    };
}

function cryptoRandomId(): string {
    try { return (crypto as any).randomUUID(); } catch { /* fallback */ }
    return `cand_${Math.random().toString(36).slice(2)}`;
}

export default useLiteratureQuickAdd;


