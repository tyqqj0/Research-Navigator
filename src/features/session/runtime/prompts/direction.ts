export interface DirectionSpec {
    title?: string;
    scope?: string;
    timeframe?: string;
    dataSources?: string[];
    keyQuestions?: string[];
    suggestions?: string[];
}

export const directionXmlTemplate = `
`;

export function buildDirectionPrompt(input: { userQuery: string; version: number; feedback?: string }) {
    const { userQuery, version, feedback } = input;
    // 统一规则：
    // - 若意图清晰：第一行输出 <direction>，后续输出完整方向说明（Markdown 分节即可）
    // - 若意图不清晰：不要输出 <direction>，只输出“澄清问题”（项目列表，具体可回答的要点）
    // - 不要输出任何额外标签或元信息（如“报告：”“原始输入：”“意图标签：”等）
    const base = `你是一名研究策划助理。判断用户意图是否清晰：
清晰 → 第一行必须仅为 <direction>，随后给出完整方向说明（结构化 Markdown）：
- 标题
- 研究网站（列出重点来源）
- 分析结果（边界：范围/方法/对象/场景）
- 关键问题（3-5）
- 建议与下一步（3-5）
- 年份范围与论证依据（简述理由）

不清晰 → 不要输出 <direction>。只输出“澄清问题”：
- 用项目符号列出需要补充的具体信息点（目标/范围/时间/数据来源/预期输出等）
- 内容简洁、可操作，避免泛泛而谈

严禁：
- 不要输出“报告：”“原始用户输入：”“意图标签：”等多余字段
- 不要输出 </direction>（无需闭合），且除第一行外不要再出现 <direction> 标记。
`;
    const refine = version > 1 ? `基于用户补充/反馈进行改写：
- 保留有效信息并提升清晰度与可执行性
- 若仍然不清晰，继续输出“澄清问题”；若已清晰，则按上面的“清晰”规范输出（第一行 <direction>）

用户补充：
${feedback || ''}
` : '';
    return [
        base,
        refine,
        '用户意图：',
        userQuery
    ].filter(Boolean).join('\n');
}

export function extractDirectionText(fullText: string): string {
    try {
        const marker = '<direction>';
        const i = fullText.indexOf(marker);
        if (i < 0) return fullText.trim();
        return fullText.slice(i + marker.length).trim();
    } catch { return fullText; }
}

export function parseDirectionXml(xml: string): { spec?: DirectionSpec; ok: boolean; error?: string } {
    try {
        // 朴素解析（客户端环境，无 DOMParser 依赖复杂度）
        const pick = (tag: string) => {
            const m = xml.match(new RegExp(`<${tag}>([\s\S]*?)<\/${tag}>`));
            return m ? m[1].trim() : undefined;
        };
        const pickList = (parent: string, item: string) => {
            const parentM = xml.match(new RegExp(`<${parent}>[\s\S]*?<\/${parent}>`));
            if (!parentM) return [] as string[];
            const seg = parentM[0];
            const re = new RegExp(`<${item}>([\s\S]*?)<\/${item}>`, 'g');
            const out: string[] = [];
            let m: RegExpExecArray | null;
            while ((m = re.exec(seg)) !== null) out.push(m[1].trim());
            return out;
        };
        const title = pick('title');
        const scope = pick('scope');
        const timeframe = pick('timeframe');
        const dataSources = pickList('dataSources', 'source');
        const keyQuestions = pickList('keyQuestions', 'q');
        const suggestions = pickList('suggestions', 'item');
        const ok = Boolean(title || scope || keyQuestions.length);
        if (!ok) return { ok: false, error: 'direction xml missing core fields' };
        return { ok: true, spec: { title, scope, timeframe, dataSources, keyQuestions, suggestions } };
    } catch (e) {
        return { ok: false, error: (e as Error).message };
    }
}


