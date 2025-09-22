import { startTextStream } from '@/lib/ai/streaming/start';
import { buildDirectionPrompt, parseDirectionXml } from '../prompts/direction';

export interface DirectionRun { abort(): void }
export interface DirectionCallbacks {
    onDelta?: (delta: string) => void;
    onComplete: (text: string) => void;
    onAborted?: (reason: string) => void;
    onError: (message: string) => void;
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
                const stream = startTextStream({ prompt }, { signal: controller.signal });
                for await (const ev of stream) {
                    if (ev.type === 'start') { try { console.debug('[exec][direction][stream][start]'); } catch { } }
                    if (ev.type === 'delta') { buf += ev.text; try { opts.onDelta?.(ev.text); } catch { } }
                    else if (ev.type === 'done') {
                        try { console.debug('[exec][direction][stream][done]', { total: buf.length }); } catch { }
                        // 尝试解析 XML，不强制要求成功；若成功则回传整段文本
                        const parsed = parseDirectionXml(buf);
                        if (!parsed.ok) {
                            // 附加一个轻量提示，后续可由 orchestrator 触发澄清
                        }
                        opts.onComplete(buf);
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


