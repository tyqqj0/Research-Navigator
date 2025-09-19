import { startTextStream } from '@/lib/ai/streaming/start';

export interface DirectionRun {
    abort(): void;
}

function buildPrompt(input: { userQuery: string; version: number; feedback?: string }) {
    const { userQuery, version, feedback } = input;
    const preface = version > 1
        ? `已收到用户反馈，请据此改写：\n${feedback || ''}`
        : '请将用户的研究意图细化为一个清晰的研究方向与目标';
    return [
        `${preface}。要求：\n- 明确子领域与范围边界\n- 给出3-5个关键研究问题\n- 说明时间范围与数据来源\n- 给出实施建议（仅列要点）\n\n用户意图：${userQuery}`
    ].join('\n');
}

export const directionExecutor = {
    generateProposal(opts: { userQuery: string; version: number; feedback?: string; onComplete: (text: string) => void; onError: (msg: string) => void }): DirectionRun {
        const controller = new AbortController();
        let buf = '';
        (async () => {
            try {
                const prompt = buildPrompt({ userQuery: opts.userQuery, version: opts.version, feedback: opts.feedback });
                const stream = startTextStream({ prompt }, { signal: controller.signal });
                for await (const ev of stream) {
                    if (ev.type === 'delta') buf += ev.text;
                    else if (ev.type === 'done') opts.onComplete(buf);
                    else if (ev.type === 'error') opts.onError(ev.message);
                    else if (ev.type === 'aborted') opts.onError('aborted');
                }
            } catch (e) {
                opts.onError((e as Error).message);
            }
        })();
        return { abort() { try { controller.abort('user'); } catch { /* ignore */ } } };
    }
};


