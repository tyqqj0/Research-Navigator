export interface QueryGenContext {
    directionSpec?: string;
    priorSummaries?: Array<{ round: number; query: string; added: number }>;
    recentUserText?: string;
}

export const queryGeneratorExecutor = {
    async generateNextQuery(ctx: QueryGenContext): Promise<{ query: string; reasoning: string }> {
        // Minimal heuristic placeholder; later can swap to LLM
        const base = ctx.directionSpec?.slice(0, 48) || ctx.recentUserText || 'research';
        const round = (ctx.priorSummaries?.length || 0) + 1;
        const query = `${base} ${round} trend overview`.trim();
        const reasoning = 'Heuristic: append round index and broaden scope.';
        return { query, reasoning };
    }
};


