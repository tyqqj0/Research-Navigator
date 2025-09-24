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

export interface ReportPromptOutline {
    outlineMessages: string[];
    citeMap: Array<{ paperId: string; key: string }>;
    bibtexByKey: Record<string, string>;
    datasetBlock: string;
}

export async function buildReportOutlineMessages(sessionId: SessionId, graphId?: string): Promise<ReportPromptOutline> {
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
        '你是一个严谨的学术研究助理。首先请深度理解下面的图谱数据（节点+边），据此产出“仅包含结构化大纲”的 Markdown。',
        spec ? `已确认研究方向：${spec}` : '当前尚未确认具体研究方向（可根据图谱结构总结主题）。',
        '大纲要求：',
        '- 只输出大纲：包括 H1 标题（# 标题）与层级清晰的章节/小节（##、###）。',
        '- 不要输出正文段落，不要输出任何“摘要/Abstract”。',
        '- 不要在大纲中出现任何引文或 [@key]。',
        '- 尽量按图谱结构组织主题（分组、因果、对比、演化等）。',
        '- 仅用于构思结构，留出可扩写的空间。'
    ].join('\n');

    const datasetBlock = [
        '以下为研究图谱的文本化摘要：',
        '```json',
        '{"nodes": [',
        nodesBlock,
        '],',
        '"edges": [',
        edgesBlock,
        ']}',
        '```'
    ].join('\n');

    const instruction = [
        '请仅输出结构化大纲的 Markdown：',
        '示例结构（仅示意）：',
        '# <报告标题>',
        '## 1. 引言',
        '### 1.1 背景与动机（占位说明，不写正文）',
        '## 2. 主题分组A',
        '### 2.1 关键问题与证据（占位说明）',
        '## 3. 主题分组B',
        '## 4. 讨论',
        '## 5. 结论'
    ].join('\n');

    const final = [header, '', datasetBlock, '', instruction].join('\n\n');
    return { outlineMessages: [final], citeMap, bibtexByKey, datasetBlock };
}


