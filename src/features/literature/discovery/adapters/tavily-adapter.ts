import type { TavilyConfig, WebSearchItem } from '../types';
import { useSettingsStore } from '@/features/user/settings/data-access/settings-store';

function getConfig(override?: Partial<TavilyConfig>): TavilyConfig {
    const settings = useSettingsStore.getState().search as any;
    const tav = settings.tavily || {};
    const domainStrategy = settings.searchDomainStrategy?.tavily?.domains || { predefined: [], custom: [] };
    const defaultDomains = [...(domainStrategy.predefined || []), ...(domainStrategy.custom || [])].filter(Boolean);
    return {
        apiKey: override?.apiKey || tav.apiKey || process.env.NEXT_PUBLIC_TAVILY_API_KEY || '',
        apiBase: override?.apiBase || tav.apiProxy || process.env.NEXT_PUBLIC_TAVILY_BASE_URL || 'https://api.tavily.com',
        maxResults: override?.maxResults ?? (settings.searchMaxResult || 5),
        includeDomains: override?.includeDomains ?? (defaultDomains.length ? defaultDomains : undefined)
    } as TavilyConfig;
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

    // 支持 includeDomains 透传到 Tavily（其参数名为 include_domains）
    if (cfg.includeDomains && Array.isArray(cfg.includeDomains) && cfg.includeDomains.length) {
        (body as any).include_domains = cfg.includeDomains;
    }

    // 调试：输出 include_domains 实际传参与限制条数
    try { console.debug('[Tavily] request', { include_domains: (body as any).include_domains, max_results: body.max_results }); } catch { }

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


