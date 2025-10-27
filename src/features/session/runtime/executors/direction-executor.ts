import { startTextStream } from '@/lib/ai/streaming/start';
import { resolveModelForPurpose } from '@/lib/settings/ai';
import { buildDirectionPrompt } from '../prompts/direction';

export interface DirectionRun { abort(): void }
export interface DirectionCallbacks {
    onDelta?: (delta: string) => void;
    onComplete: (text: string) => void;
    onAborted?: (reason: string) => void;
    onError: (message: string) => void;
    onNeedsClarification?: (questions: string) => void;
}

function buildPrompt(input: { userQuery: string; version: number; feedback?: string }) { return buildDirectionPrompt(input); }

export const directionExecutor = {
    generateProposal(opts: { userQuery: string; version: number; feedback?: string } & DirectionCallbacks): DirectionRun {
        const controller = new AbortController();
        let buf = '';
        (async () => {
            try {
                const prompt = buildPrompt({ userQuery: opts.userQuery, version: opts.version, feedback: opts.feedback });
                try { console.debug('[exec][direction][prompt]', { version: opts.version, hasFeedback: Boolean(opts.feedback), preview: String(prompt).slice(0, 160) }); } catch { }
                const model = resolveModelForPurpose('thinking');
                const stream = startTextStream({ prompt }, { signal: controller.signal, modelOverride: model, temperature: 0.6 });
                for await (const ev of stream) {
                    if (ev.type === 'start') { try { console.debug('[exec][direction][stream][start]'); } catch { } }
                    // 不再向外抛出 delta，避免在判定阶段把“澄清问题”当成提案内容渲染
                    if (ev.type === 'delta') { buf += ev.text; }
                    else if (ev.type === 'done') {
                        try { console.debug('[exec][direction][stream][done]', { total: buf.length }); } catch { }
                        // 严格要求：必须包含 <direction> 标记，否则走澄清分支
                        const hasMarker = buf.toLowerCase().includes('<direction>');
                        if (!hasMarker) {
                            const fallback = buf.trim() || '请补充您的意图，例如目标、范围、时间、来源与输出期望。';
                            try { opts.onNeedsClarification?.(fallback); } catch { }
                        } else {
                            opts.onComplete(buf);
                        }
                    }
                    else if (ev.type === 'error') { try { console.debug('[exec][direction][stream][error]', ev.message); } catch { } opts.onError(ev.message); }
                    else if (ev.type === 'aborted') { try { console.debug('[exec][direction][stream][aborted]'); } catch { } opts.onAborted?.('aborted'); }
                }
            } catch (e) {
                try { console.debug('[exec][direction][exception]', (e as Error).message); } catch { }
                opts.onError((e as Error).message);
            }
        })();
        return { abort() { try { controller.abort('user'); } catch { /* ignore */ } } };
    }
};


