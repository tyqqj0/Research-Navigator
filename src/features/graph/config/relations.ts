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


// Three-category visual system
export type RelationCategory = 'support' | 'refute' | 'related';

export const RELATION_CATEGORIES: RelationCategory[] = ['support', 'refute', 'related'];

export const RELATION_CATEGORY_LABELS: Record<RelationCategory, string> = {
    support: '支持',
    refute: '反驳',
    related: '相关/引用'
};

// Category colors (light/dark friendly choices)
export const RELATION_CATEGORY_COLORS: Record<RelationCategory, string> = {
    support: '#2563EB', // blue-600
    refute: '#E11D48',  // rose-600
    related: '#9CA3AF'  // gray-400/500
};

// Map fine-grained relations into 3 categories
export const RELATION_CATEGORY: Record<Relation, RelationCategory> = {
    citation: 'related',
    extends: 'support',
    contrasts: 'refute',
    same_topic: 'related',
    applies: 'support',
    influences: 'support',
    related: 'related'
};

export function getRelationCategory(r: Relation): RelationCategory {
    return RELATION_CATEGORY[r] ?? 'related';
}

export function getRelationColor(r: Relation): string {
    return RELATION_CATEGORY_COLORS[getRelationCategory(r)];
}

// Back-compat color map per relation now collapsed to 3-category palette
export const RELATION_COLORS: Record<Relation, string> = {
    citation: getRelationColor('citation'),
    extends: getRelationColor('extends'),
    contrasts: getRelationColor('contrasts'),
    same_topic: getRelationColor('same_topic'),
    applies: getRelationColor('applies'),
    influences: getRelationColor('influences'),
    related: getRelationColor('related')
};

export function isRelatedDashed(r: Relation): boolean {
    return getRelationCategory(r) === 'related';
}


