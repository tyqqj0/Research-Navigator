import type { SessionId, ArtifactRef } from '../../data-access/types';
import { ArchiveManager } from '@/lib/archive/manager';
import { useSessionStore } from '../../data-access/session-store';
import { literatureDataAccess } from '@/features/literature/data-access';
const getRepo = () => ArchiveManager.getServices().sessionRepository;

function sliceLast<T>(arr: T[], k: number): T[] { const n = Math.max(0, arr.length - k); return arr.slice(n); }

export async function buildAssistantMessages(sessionId: SessionId, userText: string, recentK: number = 6, inputRefs?: ArtifactRef[] | null): Promise<string[]> {
    const msgs = await getRepo().listMessages(sessionId);
    const session = (useSessionStore.getState() as any).sessions.get(sessionId) as any;
    const spec = session?.meta?.direction?.confirmed ? (session.meta.direction.spec || '') : '';

    const recent = sliceLast(msgs, recentK)
        .map((m: any) => `${m.role === 'user' ? 'U' : m.role === 'assistant' ? 'A' : 'S'}: ${m.content}`)
        .join('\n');

    const header = [
        '你是一个严谨而高效的研究助理。',
        spec ? `已确认研究方向：${spec}` : '当前尚未确认具体研究方向。',
        '以下是最近的对话片段（从早到晚）：',
        recent || '(无历史)'
    ].join('\n');

    const refsBlock = await buildRefsMemoryBlock(inputRefs || []);

    const parts: string[] = [header];
    if (refsBlock) parts.push('\n参考材料：\n' + refsBlock);
    parts.push('\n当前用户消息：');
    parts.push(userText);
    parts.push('\n请用简洁、直接、可执行的方式回复。');
    return parts;
}


async function buildRefsMemoryBlock(refs: ArtifactRef[]): Promise<string> {
    if (!Array.isArray(refs) || refs.length === 0) return '';
    const items: string[] = [];
    const litRefs = refs.filter(r => r && r.kind === 'literature');
    const repRefs = refs.filter(r => r && r.kind === 'report_final');

    if (litRefs.length > 0) {
        const briefs = await Promise.all(litRefs.map(async r => {
            const id = String(r.id);
            try {
                const enhanced = await literatureDataAccess.literatures.getEnhanced(id);
                const title = enhanced?.literature?.title || id;
                const authors = (enhanced?.literature?.authors || []).slice(0, 3).join(', ');
                const year = enhanced?.literature?.year ? ` (${enhanced?.literature?.year})` : '';
                const header = `- [文献] ${title}${authors ? ` — ${authors}${year}` : ''}`;
                const abs = (enhanced?.literature?.abstract || '').trim();
                if (abs) return header + `\n  摘要：` + truncateChinese(abs, 280);
                return header;
            } catch {
                return `- [文献] ${id}`;
            }
        }));
        items.push(...briefs);
    }

    if (repRefs.length > 0) {
        const blocks = await Promise.all(repRefs.map(async r => {
            const id = String(r.id);
            try {
                const a = await getRepo().getArtifact(id);
                if (!a) return `- [报告] ${id}`;
                const title = String((a.meta as any)?.title || '').trim();
                const header = `- [报告] ${title || id}`;
                const text = String(a.data || '').trim();
                const abstract = extractChineseAbstract(text) || text.slice(0, 400);
                return header + (abstract ? `\n  摘要：` + truncateChinese(abstract, 280) : '');
            } catch {
                return `- [报告] ${id}`;
            }
        }));
        items.push(...blocks);
    }

    return items.join('\n');
}

function truncateChinese(s: string, maxChars: number): string {
    if (s.length <= maxChars) return s;
    return s.slice(0, maxChars - 1) + '…';
}

function extractChineseAbstract(text: string): string | undefined {
    const m = text.match(/^#\s*摘要\s*[\r\n]+([\s\S]*?)(?:\n{2,}#|$)/m);
    if (m) return m[1].trim();
    return undefined;
}

