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
    // 如果用户意图不清晰，则不要输出标记<direction>，而是询问用户意图。
    const prefix = version > 1
        ? `已收到用户反馈，请在保留有效内容的基础上进行改写，并再次给出完整 <direction> 标记与报告：\n${feedback || ''}`
        : `你是一名研究策划助理。你需要判断用户意图是否清晰，如果清晰，则输出一个报告：仅需在第一行输出一个标记 <direction>，随后紧跟完整报告内容（可用 Markdown 分节、列表、加粗等）。
            写作建议（可参考）：
            - 标题
                - 研究网站（列出重点来源）
            - 分析结果（范围、方法、对象、场景的边界）
            - 关键问题（3 - 5 个）
            - 建议与下一步（3 - 5 条）
            - 年份范围
                - 论证依据（简述理由）

            严格要求：
            - 第一行必须是 < direction >
                - 内容尽量结构化，使用 Markdown 即可
        `;
    return [
        prefix,
        '',
        '用户意图：',
        userQuery,
        // '',
        // directionXmlTemplate
    ].join('\n');
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


