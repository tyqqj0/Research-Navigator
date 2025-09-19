import type { TavilyConfig, WebSearchItem } from '../types';
import { useSettingsStore } from '@/features/user/settings/data-access/settings-store';

function getConfig(override?: Partial<TavilyConfig>): TavilyConfig {
    const s = useSettingsStore.getState().search.tavily;
    return {
        apiKey: override?.apiKey || s.apiKey || process.env.NEXT_PUBLIC_TAVILY_API_KEY || '',
        apiBase: override?.apiBase || s.apiProxy || process.env.NEXT_PUBLIC_TAVILY_BASE_URL || 'https://api.tavily.com',
        maxResults: override?.maxResults ?? (useSettingsStore.getState().search.searchMaxResult || 5)
    };
}

export async function tavilySearch(query: string, override?: Partial<TavilyConfig>): Promise<WebSearchItem[]> {
    const cfg = getConfig(override);
    if (!cfg.apiKey) throw new Error('缺少 Tavily API Key');

    const url = `${cfg.apiBase!.replace(/\/$/, '')}/search`;
    const body = {
        api_key: cfg.apiKey,
        query,
        include_answers: false,
        include_images: false,
        max_results: Math.max(1, Math.min(cfg.maxResults || 5, 20)),
        search_depth: 'basic'
    } as any;

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`Tavily 请求失败: ${res.status}`);
    const data = await res.json();
    const results = (data.results || data.data || []) as any[];
    return results.map((r: any) => ({
        title: r.title || r.name,
        url: r.url,
        content: r.content || r.snippet || r.description
    })).filter((x: any) => x && x.url);
}


