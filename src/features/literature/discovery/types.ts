export type IdentifierKind = 'S2' | 'DOI' | 'ARXIV' | 'URL';

export interface DiscoveredIdentifier {
    kind: IdentifierKind;
    value: string;
}

export interface DiscoveryCandidate {
    id: string; // query+rank 哈希
    title?: string;
    snippet?: string;
    venue?: string;
    publication?: string;
    year?: number;
    sourceUrl: string;
    site?: string;
    extracted: DiscoveredIdentifier[];
    bestIdentifier?: string; // 规范化: S2: / DOI: / ARXIV: / URL:
    confidence: number; // 0..1
}

export interface DiscoveryResult {
    query: string;
    candidates: DiscoveryCandidate[];
}

export interface WebSearchItem {
    title?: string;
    url: string;
    content?: string;
}

export interface TavilyConfig {
    apiKey: string;
    apiBase?: string; // 可选代理或自建中转
    maxResults?: number;
    includeDomains?: string[];
}

export interface WebDiscoveryAPI {
    searchWeb(query: string, opts?: { limit?: number; includeDomains?: string[] }): Promise<DiscoveryResult>;
    resolveToPaperIds(candidates: DiscoveryCandidate[]): Promise<{ paperIds: string[]; resolved: Array<{ candidateId: string; paperId: string }> }>;
    addCandidateToLibrary(candidate: DiscoveryCandidate, options?: any): Promise<{ paperId: string }>;
    addIdentifierToLibrary(identifier: string, options?: any): Promise<{ paperId: string }>;
}


