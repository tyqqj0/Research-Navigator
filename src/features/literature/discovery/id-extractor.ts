import type { DiscoveryCandidate, DiscoveredIdentifier, WebSearchItem } from './types';

const DOI_REGEX = /10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i;
const ARXIV_REGEX = /(arxiv\.org\/abs\/\d{4}\.\d{4,5})|(arXiv:\d{4}\.\d{4,5})/i;
const S2_REGEX = /semanticscholar\.org\/paper\/([A-Za-z0-9-]+)/i;

function hashId(input: string): string {
    try {
        // 简易 hash（避免引入额外依赖）
        let h = 0;
        for (let i = 0; i < input.length; i++) h = Math.imul(31, h) + input.charCodeAt(i) | 0;
        return `D${Math.abs(h)}`;
    } catch {
        return `D${Date.now()}`;
    }
}

function extractIdentifiersFromText(text: string): DiscoveredIdentifier[] {
    const out: DiscoveredIdentifier[] = [];
    if (!text) return out;
    const doi = text.match(DOI_REGEX)?.[0];
    if (doi) out.push({ kind: 'DOI', value: doi });
    const arx = text.match(ARXIV_REGEX)?.[0]?.replace(/^.*?(arXiv:\d{4}\.\d{4,5}|\d{4}\.\d{4,5}).*$/i, (m, g1) => (g1.startsWith('arXiv:') ? g1 : `arXiv:${g1}`));
    if (arx) out.push({ kind: 'ARXIV', value: arx });
    const s2 = text.match(S2_REGEX)?.[1];
    if (s2) out.push({ kind: 'S2', value: s2 });
    return out;
}

export function buildCandidatesFromWebResults(query: string, items: WebSearchItem[]): DiscoveryCandidate[] {
    const candidates: DiscoveryCandidate[] = [];
    items.forEach((item, idx) => {
        const text = `${item.title || ''} ${item.content || ''} ${item.url}`;
        const extracted = [
            ...extractIdentifiersFromText(text),
        ];
        // URL 兜底
        extracted.push({ kind: 'URL', value: item.url });

        // 决策优先级：S2 > DOI > ARXIV > URL
        const best = extracted.find(x => x.kind === 'S2')
            || extracted.find(x => x.kind === 'DOI')
            || extracted.find(x => x.kind === 'ARXIV')
            || extracted.find(x => x.kind === 'URL');

        const site = (() => {
            try { return new URL(item.url).hostname; } catch { return undefined; }
        })();

        const id = hashId(`${query}#${idx}#${item.url}`);
        candidates.push({
            id,
            title: item.title,
            snippet: item.content,
            sourceUrl: item.url,
            site,
            extracted,
            bestIdentifier: best ? normalizeIdentifier(best) : undefined,
            confidence: best?.kind === 'S2' ? 0.95 : best?.kind === 'DOI' ? 0.9 : best?.kind === 'ARXIV' ? 0.8 : 0.6,
        });
    });
    return candidates;
}

export function normalizeIdentifier(id: DiscoveredIdentifier): string {
    if (id.kind === 'S2') return `S2:${id.value}`;
    if (id.kind === 'DOI') return `DOI:${id.value}`;
    if (id.kind === 'ARXIV') return id.value.startsWith('arXiv:') ? id.value : `ARXIV:${id.value}`;
    return `URL:${id.value}`;
}


