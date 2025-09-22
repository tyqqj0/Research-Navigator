import type { SessionId } from '../../data-access/types';
import { useSessionStore } from '../../data-access/session-store';
import { exportGraphBriefDataset } from '@/features/graph/data-access/graph-io';

function escapeBraces(text: string | undefined): string {
    if (!text) return '';
    return String(text).replace(/[{}]/g, (m) => (m === '{' ? '\\{' : '\\}'));
}

function toBibtexEntry(node: { id: string; title?: string; firstAuthor?: string; year?: number | string; abstract?: string }, key: string): string {
    const title = escapeBraces(node.title || key);
    const author = escapeBraces(node.firstAuthor || 'Unknown');
    const year = String(node.year || '').trim();
    return `@article{${key},\n  title={${title}},\n  author={${author}},\n  year={${year}}\n}`;
}

function generateCiteKeyBase(node: { id: string; title?: string; firstAuthor?: string; year?: number | string }): string {
    const firstAuthor = (node.firstAuthor || 'Anon').replace(/[^A-Za-z]/g, '') || 'Anon';
    const yearStr = String(node.year || '').replace(/[^0-9]/g, '') || '0000';
    const titleWord = (node.title || '').split(/\s+/).filter(Boolean)[0] || 'Work';
    const titleToken = titleWord.replace(/[^A-Za-z0-9]/g, '');
    return `${firstAuthor}${titleToken}${yearStr}`.slice(0, 24);
}

export interface ReportPrompt {
    messages: string[];
    citeMap: Array<{ paperId: string; key: string }>;
    bibtexByKey: Record<string, string>;
}

export async function buildReportMessages(sessionId: SessionId, graphId?: string): Promise<ReportPrompt> {
    const session = (useSessionStore.getState() as any).sessions.get(sessionId) as any;
    const gid: string | undefined = graphId || session?.meta?.graphId;
    if (!gid) throw new Error('No graph available for report generation');

    const { nodes, edges } = await exportGraphBriefDataset(gid);

    const spec: string = session?.meta?.direction?.confirmed ? (session.meta.direction.spec || '') : '';

    // nodesBlock will be constructed after citeMap so that we can include key/cite per node

    const edgesBlock = edges
        .map((e) => ({ from: e.from, to: e.to, relation: e.relation, fromTitle: e.fromTitle, toTitle: e.toTitle }))
        .map((e) => `{"from":"${e.from}","to":"${e.to}","relation":"${e.relation}","fromTitle":"${(e.fromTitle || '').replace(/"/g, '\\"')}","toTitle":"${(e.toTitle || '').replace(/"/g, '\\"')}"}`)
        .join('\n');

    // Build short cite keys and BibTeX map
    const tmpKeys = nodes.map((n: any) => generateCiteKeyBase(n));
    const seen = new Map<string, number>();
    const citeMap: Array<{ paperId: string; key: string }> = nodes.map((n: any, idx: number) => {
        const base = tmpKeys[idx];
        const count = (seen.get(base) || 0) + 1;
        seen.set(base, count);
        const suffix = count === 1 ? '' : `_${String.fromCharCode(96 + count)}`; // _a _b ...
        return { paperId: n.id, key: `${base}${suffix}` };
    });
    const bibtexByKey: Record<string, string> = Object.fromEntries(nodes.map((n: any, i: number) => {
        const key = citeMap[i].key;
        return [key, toBibtexEntry(n, key)];
    }));
    // Build nodes block with embedded citation fields
    const nodesBlock = nodes
        .map((n: any, i: number) => {
            const key = citeMap[i].key;
            return {
                id: n.id,
                key,
                cite: `[@${key}]`,
                title: n.title,
                firstAuthor: n.firstAuthor,
                year: n.year,
                abstract: n.abstract
            };
        })
        .map((n: any) => `{"id":"${n.id}","key":"${n.key}","cite":"${n.cite}","title":"${(n.title || '').replace(/"/g, '\\"')}","firstAuthor":"${(n.firstAuthor || '').replace(/"/g, '\\"')}","year":"${n.year || ''}","abstract":"${(n.abstract || '').replace(/"/g, '\\"')}"}`)
        .join('\n');

    const header = [
        '你是一个严谨的学术研究助理。请根据给定的图谱数据，详细分析并参考图谱的内容结构，设计并撰写一篇结构清晰的中文研究报告。',
        spec ? `已确认研究方向：${spec}` : '当前尚未确认具体研究方向（可根据图谱结构总结主题）。',
        '写作要求：',
        '- 使用学术语气与精炼表达，输出 Markdown。',
        '- 先给出关键发现的要点摘要（3-6 条），随后展开论述。',
        '- 正文里的所有引文仅使用每个节点提供的 cite（形如 [@key]），可直接复制该字段到正文。',
        '- 不要输出“References/参考文献”章节，不要在输出中粘贴任何 BibTeX；参考文献将由系统自动渲染。',
        '- 仅可引用数据集中给出的文献（区分大小写，不得自造或修改 key）。',
        '- 注意不要捏造不存在的文献或事实，必要时说明不确定性。'
    ].join('\n');

    const dataset = [
        '以下为研究图谱的文本化摘要：',
        '```json\n{"nodes": [',
        nodesBlock,
        '],',
        '"edges": [',
        edgesBlock,
        ']}\n```'
    ].join('\n');

    // No separate refs context; keys are embedded in nodes

    const instruction = [
        '请据此使用md语法生成一篇“结构化综述/报告”，建议包含：',
        '1. 摘要',
        '2. 引言（问题背景与动机）',
        '3. 相关工作/主题分组（结合图谱结构，分主题阐述）',
        '4. 方法/证据整合（如适用）',
        '5. 讨论（局限、分歧、未来方向）',
        '6. 结论'
    ].join('\n');

    const final = [header, '', dataset, '', instruction].join('\n\n');
    return { messages: [final], citeMap, bibtexByKey };
}


