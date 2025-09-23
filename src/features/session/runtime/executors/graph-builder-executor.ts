import type { Artifact } from '../../data-access/types';
import { startTextStream } from '@/lib/ai/streaming/start';
import { resolveModelForPurpose } from '@/lib/settings/ai';

export interface Edge { sourceId: string; targetId: string; relation: string; confidence: number; rationale?: string }

export const graphBuilderExecutor = {
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
    async structureEdgesFromText(text: string, idMap: Record<string, string>): Promise<Artifact<Edge[]>> {
        const model = resolveModelForPurpose('task');
        const ids = Object.keys(idMap);
        // 指令：从自然语言候选说明中抽取边
        const instruction = [
            '请从以下中文候选关系说明文本中抽取结构化边数组，JSON 数组格式，每个元素：',
            '{"sourceId":"...","targetId":"...","relation":"引用|改进|对比|同一主题|应用|影响","rationale":"一句中文理由","confidence":0.0-1.0}',
            `仅允许使用以下节点ID：${ids.join(', ')}`,
            '若说明中未出现或不明确，跳过，不要臆造。输出纯 JSON（不加注释与多余文本）。',
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
        try {
            // 尝试提取第一个 JSON 数组
            const m = buf.match(/\[([\s\S]*?)\]/);
            const json = m ? `[${m[1]}]` : buf;
            parsed = JSON.parse(json);
        } catch {
            parsed = [];
        }
        const edges: Edge[] = (Array.isArray(parsed) ? parsed : []).map((e: any) => ({
            sourceId: idMap[e.sourceId] || e.sourceId,
            targetId: idMap[e.targetId] || e.targetId,
            relation: String(e.relation || 'related'),
            confidence: Math.max(0, Math.min(1, Number(e.confidence ?? 0.5))),
            rationale: typeof e.rationale === 'string' ? e.rationale : undefined,
        })).filter((e: Edge) => Boolean(idMap[e.sourceId]) && Boolean(idMap[e.targetId]) && e.sourceId !== e.targetId);
        return { id: crypto.randomUUID(), kind: 'graph_edges', version: 1, data: edges, createdAt: Date.now() };
    }
};


