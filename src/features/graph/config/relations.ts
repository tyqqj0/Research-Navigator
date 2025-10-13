// Centralized relations configuration used by UI and runtime prompts/parsers

export type Relation =
    | 'citation'
    | 'extends'
    | 'contrasts'
    | 'same_topic'
    | 'applies'
    | 'influences'
    | 'related';

export const ALLOWED_RELATIONS: Relation[] = [
    'citation',
    'extends',
    'contrasts',
    'same_topic',
    'applies',
    'influences',
    'related'
];

export const RELATION_LABELS: Record<Relation, string> = {
    citation: '引用（citation）',
    extends: '扩展/改进（extends）',
    contrasts: '对比/反驳（contrasts）',
    same_topic: '同一主题（same_topic）',
    applies: '应用（applies）',
    influences: '影响（influences）',
    related: '相关（related）'
};

// Chinese synonyms mapping to canonical relations
export const RELATION_CN_SYNONYMS: Record<string, Relation> = {
    '引用': 'citation',
    '被引用': 'citation',
    '改进': 'extends',
    '扩展': 'extends',
    '对比': 'contrasts',
    '反驳': 'contrasts',
    '同一主题': 'same_topic',
    '同主题': 'same_topic',
    '应用': 'applies',
    '影响': 'influences',
    '相关': 'related'
};

// For prompts
export const RELATION_PROMPT_LIST: string = ALLOWED_RELATIONS.join(', ');
export const RELATION_UNION_FOR_JSON: string = ALLOWED_RELATIONS.join('|');

export function normalizeRelation(input: unknown): Relation {
    const raw = String(input || '').trim();
    if (!raw) return 'related';
    const lower = raw.toLowerCase();
    if ((ALLOWED_RELATIONS as string[]).includes(lower)) return lower as Relation;
    const mapped = RELATION_CN_SYNONYMS[raw] || RELATION_CN_SYNONYMS[lower];
    return (mapped as Relation) || 'related';
}


// Suggested UI colors for relation types (soft, high-contrast palette)
export const RELATION_COLORS: Record<Relation, string> = {
    citation: '#64748B',   // slate-500
    extends: '#16A34A',    // green-600
    contrasts: '#EF4444',  // red-500
    same_topic: '#0EA5E9', // sky-500
    applies: '#F59E0B',    // amber-500
    influences: '#8B5CF6', // violet-500
    related: '#94A3B8'     // slate-400
};


