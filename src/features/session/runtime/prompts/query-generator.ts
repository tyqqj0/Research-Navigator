export function buildQueryPrompt(input: {
    directionSpec?: string;
    priorBriefs?: Array<{ id: string; title?: string; firstAuthor?: string; publicationDate?: string; abstract?: string; keywords?: string[] }>;
    round?: number;
}) {
    const direction = (input.directionSpec || '').replace(/<\/?direction>/gi, '').trim();
    const dirShort = direction.split(/\n+/).map(s => s.trim()).filter(Boolean).slice(0, 2).join(' ');
    const briefs = (input.priorBriefs || []).slice(-5).map(b => {
        const k = (b.keywords || []).slice(0, 5).join(', ');
        const line = [b.title, b.firstAuthor, b.publicationDate].filter(Boolean).join(' · ');
        return `- ${line}${k ? ` | keywords: ${k}` : ''}`;
    }).join('\n');
    const round = input.round || 1;
    return `You are a research planner. Generate one short, focused web search query for the next round.

Context (direction, short):
${dirShort || 'N/A'}

Recent briefs (title · firstAuthor · date | keywords):
${briefs || '(none)'}

Constraints:
- Output exactly two parts:
  1) Rationale: ≤ 2 sentences, why this sub-query matters now
  2) Query: a single short query of 3-8 words, no quotes, no trailing punctuation, include concrete terms
- If no good context, still propose a concrete sub-topic, avoid generic words like "trend overview"

Format:
Rationale: <your brief rationale>
Query: <short query>`;
}


