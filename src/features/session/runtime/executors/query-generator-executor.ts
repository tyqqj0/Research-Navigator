export interface QueryGenContext {
    directionSpec?: string;
    // 简要元数据：标题、首作者、发表日期、摘要、keywords（可精简）
    priorBriefs?: Array<{ id: string; title?: string; firstAuthor?: string; publicationDate?: string; abstract?: string; keywords?: string[] }>;
    recentUserText?: string;
    round?: number;
}

export const queryGeneratorExecutor = {
    async generateNextQuery(ctx: QueryGenContext): Promise<{ query: string; reasoning: string }> {
        // 轻量启发式：从方向里抽取关键词 + 从 priorBriefs 里抽取 top nouns，生成更聚焦的查询
        const base = (ctx.directionSpec || ctx.recentUserText || 'research').slice(0, 80);
        const nouns = new Set<string>();
        (ctx.priorBriefs || []).slice(-5).forEach(b => {
            (b.title || '').split(/\W+/).forEach(w => { if (w.length > 3) nouns.add(w.toLowerCase()); });
            (b.abstract || '').split(/\W+/).forEach(w => { if (w.length > 7) nouns.add(w.toLowerCase()); });
            (b.keywords || []).forEach(k => nouns.add(k.toLowerCase()));
        });
        const top = Array.from(nouns).slice(0, 3).join(' ');
        const round = ctx.round || 1;
        const query = [base, top].filter(Boolean).join(' ').trim();
        const reasoning = `结合方向与近${(ctx.priorBriefs || []).length}条摘要抽取关键词(${top || '无'})，用于第${round}轮检索。`;
        return { query, reasoning };
    }
};


