import { commandBus } from '../command-bus';
import { eventBus } from '../event-bus';
import { applyEventToProjection } from '../projectors';
import type { Artifact, ChatSession, SessionCommand, SessionEvent } from '../../data-access/types';
import { startTextStream } from '@/lib/ai/streaming/start';
import { resolveModelForPurpose } from '@/lib/settings/ai';
import { buildReportOutlineMessages } from '@/features/session/runtime/prompts/report';
import { ArchiveManager } from '@/lib/archive/manager';
const getRepo = () => ArchiveManager.getServices().sessionRepository;

function newId() { return crypto.randomUUID(); }
async function emit(e: SessionEvent) { await eventBus.publish(e); applyEventToProjection(e); }

declare const globalThis: any;

// Ensure singleton for report orchestrator (handles staged report generation)
if (!(globalThis as any).__reportOrchestratorRegistered) {
    (globalThis as any).__reportOrchestratorRegistered = true;

    // Per-session run guard
    if (!(globalThis as any).__reportRunning) (globalThis as any).__reportRunning = new Map<string, { abort(): void }>();
    const running: Map<string, { abort(): void }> = (globalThis as any).__reportRunning;

    commandBus.register(async (cmd: SessionCommand) => {
        if (cmd.type !== 'GenerateReport' && cmd.type !== 'StopReport' && cmd.type !== 'ResumeReport' && cmd.type !== 'RegenerateReportStage') return;

        if (cmd.type === 'StopReport') {
            const run = running.get(cmd.params.sessionId);
            if (run) { try { run.abort(); } catch { } }
            return;
        }

        if (cmd.type === 'GenerateReport') {
            const sessionId = cmd.params.sessionId;
            if (running.has(sessionId)) { try { console.warn('[report][running_exists_skip]', sessionId); } catch { } return; }

            // Prepare prompt (includes cite map and bibtex)
            let messages: string[] = [];
            let citeKeys: Array<{ paperId: string; key: string }> = [];
            let bibtexByKey: Record<string, string> = {};
            let datasetBlock: string = '';
            try {
                const prompt = await buildReportOutlineMessages(sessionId, (cmd.params as any).graphId);
                messages = prompt.outlineMessages;
                citeKeys = prompt.citeMap;
                bibtexByKey = prompt.bibtexByKey;
                datasetBlock = prompt.datasetBlock;
            } catch (err) {
                try { const { toast } = require('sonner'); toast.error('生成报告失败：缺少图谱或数据'); } catch { }
                return;
            }

            const reportMid = `report_${cmd.id}`;
            await emit({ id: newId(), type: 'ReportGenerationStarted', ts: Date.now(), sessionId, payload: { messageId: reportMid, citeKeys, bibtexByKey } as any });

            const thinkingModel = resolveModelForPurpose('thinking');

            // install abort handle for this session
            let currentController: AbortController | null = null;
            const run = { abort: () => { try { currentController?.abort(); } catch { } } };
            running.set(sessionId, run);

            // Outline stage
            await emit({ id: newId(), type: 'ReportOutlineStarted', ts: Date.now(), sessionId, payload: { messageId: reportMid } as any });
            currentController = new AbortController();
            const outlineStream = startTextStream(
                { messages },
                { modelOverride: thinkingModel, temperature: 0.6, signal: currentController.signal, batchingIntervalMs: 80 }
            );
            let outline = '';
            for await (const ev of outlineStream) {
                if (ev.type === 'start') emit({ id: newId(), type: 'AssistantMessageStarted', ts: Date.now(), sessionId, payload: { messageId: reportMid } });
                if (ev.type === 'delta') {
                    outline += ev.text;
                    // 仅写入大纲阶段事件，不再写入主消息内容
                    emit({ id: newId(), type: 'ReportOutlineDelta', ts: Date.now(), sessionId, payload: { messageId: reportMid, delta: ev.text } as any });
                }
                if (ev.type === 'error') {
                    emit({ id: newId(), type: 'AssistantMessageFailed', ts: Date.now(), sessionId, payload: { messageId: reportMid, error: ev.message } });
                    running.delete(sessionId);
                    return;
                }
            }
            const outlineArtifact: Artifact<string> = { id: newId(), kind: 'report_outline', version: 1, data: outline.trim(), meta: { sessionId }, createdAt: Date.now() } as any;
            await getRepo().putArtifact(outlineArtifact);
            await emit({ id: newId(), type: 'ReportOutlineCompleted', ts: Date.now(), sessionId, payload: { messageId: reportMid, outlineArtifactId: outlineArtifact.id } as any });

            // Expansion stage
            await emit({ id: newId(), type: 'ReportExpandStarted', ts: Date.now(), sessionId, payload: { messageId: reportMid } as any });
            const expandPrompt = [
                '基于以下大纲与图谱数据，请逐节扩写成完整中文报告（Markdown）。要求：',
                '- 保留并充分使用 cite 键（形如 [@key]），覆盖尽可能多的相关节点。',
                '- 不要输出引用清单（References），系统会自动渲染。',
                '- 仅可引用提供的数据集中给出的 cite 键，不得自造。',
                '',
                '【图谱数据】',
                datasetBlock,
                '',
                '【大纲】',
                outline
            ].join('\n');
            currentController = new AbortController();
            const expandStream = startTextStream(
                { prompt: expandPrompt },
                { modelOverride: thinkingModel, temperature: 0.55, signal: currentController.signal, batchingIntervalMs: 80 }
            );
            let draft = '';
            for await (const ev of expandStream) {
                if (ev.type === 'delta') {
                    draft += ev.text;
                    // 仅写入扩写阶段事件，不再写入主消息内容
                    emit({ id: newId(), type: 'ReportExpandDelta', ts: Date.now(), sessionId, payload: { messageId: reportMid, delta: ev.text } as any });
                }
                if (ev.type === 'error') {
                    emit({ id: newId(), type: 'AssistantMessageFailed', ts: Date.now(), sessionId, payload: { messageId: reportMid, error: ev.message } });
                    running.delete(sessionId);
                    return;
                }
            }
            const draftArtifact: Artifact<string> = { id: newId(), kind: 'report_draft', version: 1, data: draft.trim(), meta: { sessionId }, createdAt: Date.now() } as any;
            await getRepo().putArtifact(draftArtifact);
            await emit({ id: newId(), type: 'ReportExpandCompleted', ts: Date.now(), sessionId, payload: { messageId: reportMid, draftArtifactId: draftArtifact.id } as any });

            // Abstract stage
            await emit({ id: newId(), type: 'ReportAbstractStarted', ts: Date.now(), sessionId, payload: { messageId: reportMid } as any });
            const abstractPrompt = [
                '请基于以下完整报告生成“单段落”中文学术摘要（150-220字）。只输出摘要正文一段，不要标题，不要列点：',
                '',
                draft.slice(0, 8000)
            ].join('\n');
            currentController = new AbortController();
            const abstractStream = startTextStream(
                { prompt: abstractPrompt },
                { modelOverride: thinkingModel, temperature: 0.5, signal: currentController.signal, batchingIntervalMs: 80 }
            );
            let abstract = '';
            for await (const ev of abstractStream) {
                if (ev.type === 'delta') {
                    abstract += ev.text;
                    emit({ id: newId(), type: 'ReportAbstractDelta', ts: Date.now(), sessionId, payload: { messageId: reportMid, delta: ev.text } as any });
                }
            }
            const abstractArtifact: Artifact<string> = { id: newId(), kind: 'report_abstract', version: 1, data: abstract.trim(), meta: { sessionId }, createdAt: Date.now() } as any;
            await getRepo().putArtifact(abstractArtifact);
            await emit({ id: newId(), type: 'ReportAbstractCompleted', ts: Date.now(), sessionId, payload: { messageId: reportMid, abstractArtifactId: abstractArtifact.id } as any });

            // Assemble final
            const finalText = `# 摘要\n\n${abstract.trim()}\n\n${draft.replace(/^#\s*摘要[\s\S]*?(?:\n{2,}|$)/i, '').trim()}`;

            // Heuristic title generation (no extra LLM call)
            let session: ChatSession | null = null;
            try { session = await getRepo().getSession(sessionId); } catch { }
            const title = deriveReportTitle(draft, finalText, session || undefined);

            const finalArtifact: Artifact<string> = {
                id: newId(),
                kind: 'report_final',
                version: 1,
                data: finalText,
                meta: { sessionId, title },
                createdAt: Date.now()
            } as any;
            await getRepo().putArtifact(finalArtifact);
            await emit({ id: newId(), type: 'ReportFinalAssembled', ts: Date.now(), sessionId, payload: { messageId: reportMid, finalArtifactId: finalArtifact.id, citeKeys, bibtexByKey } as any });

            // Emit final outline rendering for UI (derived from outline text)
            await emit({ id: newId(), type: 'ReportOutlineRendered', ts: Date.now(), sessionId, payload: { messageId: reportMid, outlineText: outline.trim() } as any });

            // 将最终报告一次性写入主消息内容
            emit({ id: newId(), type: 'AssistantMessageDelta', ts: Date.now(), sessionId, payload: { messageId: reportMid, delta: finalText } });

            // Back-compat events for existing UI behavior
            emit({ id: newId(), type: 'AssistantMessageCompleted', ts: Date.now(), sessionId, payload: { messageId: reportMid } });
            emit({ id: newId(), type: 'ReportGenerationCompleted', ts: Date.now(), sessionId, payload: { messageId: reportMid } } as any);

            try { const { toast } = require('sonner'); toast.message('开始生成报告…'); } catch { }
            running.delete(sessionId);
            return;
        }
    });
}

// Extract a reasonable report title using content and session hints
function deriveReportTitle(draft: string, finalText: string, session?: ChatSession): string {
    // 1) Prefer first top-level heading (excluding 摘要)
    const pickHeading = (text: string): string | undefined => {
        const m = text.match(/^#\s+(.+)$/m);
        const h = m ? m[1].trim() : '';
        if (h && !/^摘要$/i.test(h)) return sanitizeTitle(h);
        return undefined;
    };
    const fromDraft = pickHeading(draft);
    if (fromDraft) return fromDraft;
    const fromFinal = pickHeading(finalText);
    if (fromFinal) return fromFinal;

    // 2) Use direction spec or session title as hint
    const directionSpec = safeGet(session, s => (s.meta as any)?.direction?.spec as string | undefined);
    if (directionSpec) return sanitizeTitle(truncate(directionSpec, 40)) + ' · 报告';
    if (session?.title) return sanitizeTitle(truncate(session.title, 40)) + ' · 报告';

    // 3) Fallback to timestamped generic title
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const ts = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return `研究报告 ${ts}`;
}

function truncate(s: string, max: number): string { return s.length > max ? s.slice(0, max) : s; }
function sanitizeTitle(s: string): string { return s.replace(/[#`\n\r]/g, ' ').replace(/\s+/g, ' ').trim(); }
function safeGet<T, R>(obj: T | undefined, fn: (o: T) => R | undefined): R | undefined { try { return obj ? fn(obj) : undefined; } catch { return undefined; } }


