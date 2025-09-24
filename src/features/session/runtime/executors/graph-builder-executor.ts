import type { Artifact } from '../../data-access/types';
import { ALLOWED_RELATIONS, RELATION_CN_SYNONYMS, RELATION_PROMPT_LIST, RELATION_UNION_FOR_JSON, normalizeRelation } from '@/features/graph/config/relations';
import { startTextStream } from '@/lib/ai/streaming/start';
import { resolveModelForPurpose } from '@/lib/settings/ai';

export interface Edge { sourceId: string; targetId: string; relation: string; confidence: number; rationale?: string; evidence?: string[]; tags?: string[] }

export const graphBuilderExecutor = {
    async thinkingPhase1(
        briefs: Array<{ id: string; title: string; firstAuthor?: string; year?: number; publicationDate?: string; abstract?: string }>,
        opts?: { onDelta?: (delta: string) => void }
    ): Promise<Artifact<string>> {
        const model = resolveModelForPurpose('thinking');
        const sorted = briefs.slice().sort((a, b) => (a.year || 0) - (b.year || 0));
        const prompt = [
            '你是一个图谱关系分析专家。请对给定论文（按时间从早到晚）进行安静思考，输出“语义分群 + 主线脉络”的分析文本。',
            '要求：\n  - 按主题聚类（如 预训练、对比学习、多模态 等）；\n  - 给出主线脉络（关键里程碑从旧到新）；\n  - 仅使用已给信息，不要捏造；\n  - 输出中文、用分点与小标题，避免过长。',
            '',
            '节点（id｜title｜firstAuthor｜year｜abstract≤160）：',
            sorted.map(p => `- ${p.id}｜${p.title}${p.firstAuthor ? `｜${p.firstAuthor}` : ''}${p.year ? `｜${p.year}` : ''}${p.abstract ? `｜摘要：${String(p.abstract).slice(0, 160)}` : ''}`).join('\n')
        ].join('\n');
        const stream = startTextStream({ prompt }, { modelOverride: model, temperature: 0.4 });
        let buf = '';
        for await (const ev of stream) {
            if (ev.type === 'delta') { buf += ev.text; opts?.onDelta?.(ev.text); }
        }
        return { id: crypto.randomUUID(), kind: 'graph_thinking_p1', version: 1, data: buf.trim(), createdAt: Date.now() };
    },
    async thinkingPhase2TextTitles(
        briefs: Array<{ id: string; title: string; firstAuthor?: string; year?: number; publicationDate?: string; abstract?: string }>,
        opts?: { onDelta?: (delta: string) => void }
    ): Promise<Artifact<string>> {
        const model = resolveModelForPurpose('thinking');
        const sorted = briefs.slice().sort((a, b) => (a.year || 0) - (b.year || 0));
        const titles = sorted.map(p => p.title).filter(Boolean);
        const minEdges = Math.max(sorted.length - 1, 12);
        const prompt = [
            '在上一步“语义分群与主线”的基础上，请以自然语言产出候选关系，使用论文标题而不是 ID。',
            `要求：\n  - 使用下方提供的标题，逐字复用，避免同义改写；\n  - 先产出能够自前至后贯穿主线的关系（mainline），再补充支线（sideline）；\n  - 尽量提高覆盖度，覆盖≥80% 节点；不少于指定最少条数；\n  - 关系可取：${RELATION_PROMPT_LIST}；\n  - 每条关系给出一句中文理由（rationale），可附少量 evidence 关键词；\n  - 严禁捏造未出现的论文；若不确定，跳过。`,
            '',
            `最少关系数：${minEdges}`,
            '允许使用的标题列表（请逐字使用）：',
            titles.map((t, i) => `- [${i + 1}] ${t}`).join('\n'),
            '',
            '节点（title｜firstAuthor｜year｜abstract≤160）：',
            sorted.map(p => `- ${p.title}${p.firstAuthor ? `｜${p.firstAuthor}` : ''}${p.year ? `｜${p.year}` : ''}${p.abstract ? `｜摘要：${String(p.abstract).slice(0, 160)}` : ''}`).join('\n'),
            '',
            '输出格式建议（示例，非必须严格一致）：',
            '《Title A》 → 《Title B》：citation（tags: mainline, topicX）。理由：…… 证据：[…, …]'
        ].join('\n');
        const stream = startTextStream({ prompt }, { modelOverride: model, temperature: 0.25 });
        let buf = '';
        for await (const ev of stream) {
            if (ev.type === 'delta') { buf += ev.text; opts?.onDelta?.(ev.text); }
        }
        return { id: crypto.randomUUID(), kind: 'relation_text_titles', version: 1, data: buf.trim(), createdAt: Date.now() };
    },
    async thinkingPhase2Jsonl(
        briefs: Array<{ id: string; title: string; firstAuthor?: string; year?: number; publicationDate?: string; abstract?: string }>,
        opts?: { onDelta?: (delta: string) => void }
    ): Promise<Artifact<string>> {
        const model = resolveModelForPurpose('thinking');
        const ids = briefs.map(p => p.id).join(', ');
        const prompt = [
            '在上一步语义分群与主线的基础上，产出候选关系说明的 JSON Lines（JSONL）。',
            '严格只输出 JSONL，每行一个对象，字段：{"sourceId","targetId","relation","confidence","rationale","evidence","tags"}。',
            `约束：\n  - relation 取值（英文）：${RELATION_PROMPT_LIST}；\n  - tags 可包含："mainline","sideline","important","weak_evidence" 及主题词；\n  - confidence∈[0,1]；evidence 为字符串数组（可为证据摘要、术语、短引片段）。\n  - 仅使用已给 id，不能捏造；不确定就跳过。`,
            '',
            `允许的节点ID：${ids}`,
            '节点（id｜title｜year｜abstract≤160）：',
            briefs.map(p => `- ${p.id}｜${p.title}${p.year ? `｜${p.year}` : ''}${p.abstract ? `｜摘要：${String(p.abstract).slice(0, 160)}` : ''}`).join('\n')
        ].join('\n');
        const stream = startTextStream({ prompt }, { modelOverride: model, temperature: 0.25 });
        let buf = '';
        for await (const ev of stream) {
            if (ev.type === 'delta') { buf += ev.text; opts?.onDelta?.(ev.text); }
        }
        return { id: crypto.randomUUID(), kind: 'relation_jsonl', version: 1, data: buf.trim(), createdAt: Date.now() };
    },
    async proposeRelationsText(papers: Array<{ id: string; title: string; abstract?: string }>): Promise<Artifact<string>> {
        const model = resolveModelForPurpose('thinking');
        const prompt = [
            '你是一个图谱关系分析专家。根据以下论文列表，先进行思考与归纳，提出可能的主题分组与候选关系，输出结构化的中文说明文本。',
            '要求：不要捏造，不要引用未出现的论文；只基于给定内容进行合理假设。',
            '格式建议：每行一个候选关系，形如：PaperA 与 PaperB 的关系：引用/对比/改进/同一主题 等，并给出一句理由。',
            '',
            '论文列表：',
            papers.map(p => `- ${p.id}｜${p.title}${p.abstract ? `｜摘要：${p.abstract.slice(0, 200)}` : ''}`).join('\n')
        ].join('\n');
        const stream = startTextStream({ prompt }, { modelOverride: model, temperature: 0.5 });
        let buf = '';
        for await (const ev of stream) {
            if (ev.type === 'delta') buf += ev.text;
        }
        return { id: crypto.randomUUID(), kind: 'relation_text', version: 1, data: buf.trim(), createdAt: Date.now() };
    },
    async proposeRelationsJsonl(papers: Array<{ id: string; title: string; abstract?: string }>): Promise<Artifact<string>> {
        const model = resolveModelForPurpose('thinking');
        const ids = papers.map(p => p.id).join(', ');
        const prompt = [
            '你是一个学术图谱构建助理。请阅读给定论文列表，进行安静思考后，仅输出 JSONL（每行一个 JSON 对象），每行描述一条候选关系边。',
            `严格要求：
  - 只允许使用给定的 paperId 作为 sourceId/targetId。
  - 不要产生任何解释性文本或 markdown，只输出 JSON Lines。
  - relation 取值建议（英文）：citation, extends, contrasts, same_topic, applies, influences, related。
  - 每行对象字段：{"sourceId","targetId","relation","confidence","rationale","tags"}
  - confidence 为 [0,1] 的数字；tags 为字符串数组（如 ["citation","method","dataset"]）。
  - 如果不确定，请省略该行，不要臆造。`,
            '',
            `允许的节点ID：${ids}`,
            '论文列表：',
            papers.map(p => `- ${p.id}｜${p.title}${p.abstract ? `｜摘要：${p.abstract.slice(0, 160)}` : ''}`).join('\n')
        ].join('\n');
        const stream = startTextStream({ prompt }, { modelOverride: model, temperature: 0.3 });
        let buf = '';
        for await (const ev of stream) {
            if (ev.type === 'delta') buf += ev.text;
        }
        // 存储原始 JSONL 文本
        return { id: crypto.randomUUID(), kind: 'relation_jsonl', version: 1, data: buf.trim(), createdAt: Date.now() };
    },
    async structureEdgesFromText(text: string, idMap: Record<string, string>, opts?: { titles?: string[]; maxEdges?: number }): Promise<Artifact<Edge[]>> {
        const model = resolveModelForPurpose('task');
        const idsOrTitles = Object.keys(idMap);
        const titles = Array.isArray(opts?.titles) ? opts!.titles! : undefined;
        const allow = new Set(ALLOWED_RELATIONS);
        const instruction = [
            '请从以下候选关系说明文本中抽取结构化边，输出 JSON 数组。每个元素字段：',
            `{"sourceId":"...","targetId":"...","relation":"${RELATION_UNION_FOR_JSON}","rationale":"一句中文理由","confidence":0.0-1.0,"tags":["..."],"evidence":["..."]}`,
            titles && titles.length ? `仅允许使用以下“标题”来标识论文（必须逐字匹配）：\n${titles.map(t => `- ${t}`).join('\n')}` : `仅允许使用以下节点：${idsOrTitles.join(', ')}`,
            'sourceId/targetId 可以填写“上面的标题”或“对应的 ID”（若你知道）。若无法唯一确定，请跳过该条。',
            '严格只输出纯 JSON 数组，不要使用任何 Markdown 代码块（如 ```json），不要输出反引号、语言标签或多余文本。',
            '',
            '候选说明：',
            text
        ].join('\n');
        const stream = startTextStream({ prompt: instruction }, { modelOverride: model, temperature: 0.1 });
        let buf = '';
        for await (const ev of stream) {
            if (ev.type === 'delta') buf += ev.text;
        }
        let parsed: any[] = [];
        // 先进行清洗：去除 Markdown 代码块围栏与零宽字符
        const stripFence = (s: string): string => {
            const fence = s.match(/```[a-zA-Z0-9_-]*\s*([\s\S]*?)\s*```/);
            if (fence && fence[1]) return fence[1];
            return s;
        };
        const stripZW = (s: string): string => s.replace(/[\u200B-\u200D\uFEFF]/g, '');
        const cleaned = stripZW(stripFence(buf.trim()));
        // 平衡提取顶层 JSON 数组，避免 lastIndexOf 截断
        const extractTopArray = (s: string): string | null => {
            let start = -1, depth = 0;
            for (let i = 0; i < s.length; i++) {
                const ch = s[i];
                if (ch === '[') { if (start === -1) start = i; depth++; }
                else if (ch === ']') { depth--; if (depth === 0 && start !== -1) return s.slice(start, i + 1); }
            }
            return null;
        };
        try {
            const arr = extractTopArray(cleaned) || cleaned;
            parsed = JSON.parse(arr);
        } catch {
            parsed = [];
        }
        const normalizeTitle = (s?: string) => (s || '')
            .toLowerCase()
            .replace(/[\s\-_:;,./\\]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        // Build normalized lookup for titles (and keep exact for ids)
        const exactMap = idMap;
        const normalizedMap: Record<string, string> = {};
        for (const k of Object.keys(idMap)) {
            const nk = normalizeTitle(k);
            if (nk) normalizedMap[nk] = idMap[k];
        }
        // diagnostics counters (declared before use)
        const unmatchedSamples: string[] = [];
        let droppedMissingMapping = 0;
        let droppedSelfLoop = 0;
        let droppedInvalidRel = 0;
        const toId = (v: any): string | undefined => {
            if (!v || typeof v !== 'string') return undefined;
            if (exactMap[v]) return exactMap[v];
            const n = normalizeTitle(v);
            if (normalizedMap[n]) return normalizedMap[n];
            if (unmatchedSamples.length < 6) unmatchedSamples.push(v);
            droppedMissingMapping++;
            return undefined;
        };
        const maxEdges = Math.max(0, Number(opts?.maxEdges ?? 300));
        const out: Edge[] = [];
        for (const e of (Array.isArray(parsed) ? parsed : [])) {
            const src = toId(e.sourceId);
            const dst = toId(e.targetId);
            if (!src || !dst) { continue; }
            if (src === dst) { droppedSelfLoop++; continue; }
            let rel = normalizeRelation(e.relation);
            if (!allow.has(rel)) { droppedInvalidRel++; rel = 'related'; }
            const conf = Math.max(0, Math.min(1, Number(e.confidence ?? 0.5)));
            const tags: string[] | undefined = Array.isArray(e.tags) ? e.tags.filter((t: any) => typeof t === 'string').slice(0, 4) as string[] : undefined;
            const rationale: string | undefined = typeof e.rationale === 'string' ? e.rationale : undefined;
            const evidence: string[] | undefined = Array.isArray(e.evidence)
                ? (e.evidence.filter((t: any) => typeof t === 'string').slice(0, 6) as string[])
                : (typeof e.evidence === 'string' ? [e.evidence] : undefined);
            out.push({ sourceId: src, targetId: dst, relation: rel, confidence: conf, rationale, evidence, tags });
            if (out.length >= maxEdges) break;
        }
        const edges: Edge[] = out;

        // 调试
        // 在流式拼完 buf 后立刻打印（长度与预览）
        const preview = buf.length > 1200 ? `${buf.slice(0, 600)} … ${buf.slice(-500)}` : buf;
        console.debug('[exec][graph] step3 raw', {
            size: buf.length,
            hasBracket: /\[/.test(buf) && /\]/.test(buf),
            firstBracket: buf.indexOf('['),
            lastBracket: buf.lastIndexOf(']'),
            preview
        });


        try {
            console.debug('[exec][graph] step3 parsed', {
                isArray: Array.isArray(parsed),
                len: Array.isArray(parsed) ? parsed.length : 0
            });
        } catch { /* noop */ }

        const normalizedMapSize = Object.keys(normalizedMap).length;

        // const toId = (v: any): string | undefined => {
        //     if (!v || typeof v !== 'string') return undefined;
        //     if (idMap[v]) return idMap[v];
        //     const n = normalizeTitle(v);
        //     if (normalizedMap[n]) return normalizedMap[n];
        //     if (unmatchedSamples.length < 6) unmatchedSamples.push(v);
        //     droppedMissingMapping++;
        //     return undefined;
        // };

        // ... 循环结束后：
        console.debug('[exec][graph] step3 map_summary', {
            normalizedMapSize,
            droppedMissingMapping,
            droppedSelfLoop,
            droppedInvalidRel,
            unmatchedSamples
        });

        console.debug('[exec][graph] step3 emit', { emitted: out.length });
        return { id: crypto.randomUUID(), kind: 'graph_edges', version: 1, data: edges, createdAt: Date.now() };
    },
    structureEdgesFromJsonl(jsonl: string, idMap: Record<string, string>, limits?: { maxLines?: number; maxEdges?: number; maxTagsPerEdge?: number }): Artifact<Edge[]> {
        const maxLines = limits?.maxLines ?? 200;
        const maxEdges = limits?.maxEdges ?? 300;
        const maxTags = limits?.maxTagsPerEdge ?? 4;
        const allow = new Set(ALLOWED_RELATIONS);
        const lines = jsonl.split(/\r?\n/).map(l => l.trim()).filter(Boolean).slice(0, maxLines);
        const out: Edge[] = [];
        for (const line of lines) {
            let obj: any;
            try { obj = JSON.parse(line); } catch { continue; }
            const src = idMap[obj.sourceId] || obj.sourceId;
            const dst = idMap[obj.targetId] || obj.targetId;
            if (!idMap[src] || !idMap[dst]) continue;
            if (src === dst) continue;
            let rel = normalizeRelation(obj.relation);
            if (!allow.has(rel)) rel = 'related';
            const confNum = Math.max(0, Math.min(1, Number(obj.confidence ?? 0.5)));
            const tags = Array.isArray(obj.tags) ? obj.tags.filter((t: any) => typeof t === 'string').slice(0, maxTags) as string[] : undefined;
            const rationale = typeof obj.rationale === 'string' ? obj.rationale : undefined;
            const evidence: string[] | undefined = Array.isArray(obj.evidence)
                ? (obj.evidence.filter((t: any) => typeof t === 'string').slice(0, 6) as string[])
                : (typeof obj.evidence === 'string' ? [obj.evidence] : undefined);
            out.push({ sourceId: src, targetId: dst, relation: rel, confidence: confNum, rationale, evidence, tags });
            if (out.length >= maxEdges) break;
        }
        console.debug('[exec][graph] step3 emit', { emitted: out.length });
        return { id: crypto.randomUUID(), kind: 'graph_edges', version: 1, data: out, createdAt: Date.now() };
    }
};


