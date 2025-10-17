import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function resolveUpstream(tailPath: string): { base: string; authHeader?: string; kind: 'ai' | 'research' } {
    const cleanTail = (tailPath || '').replace(/^\/+/, '');
    const aiBase = (process.env.BACKEND_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
    const researchBase = (process.env.RESEARCH_API_BASE_URL || '').replace(/\/$/, '') || aiBase;

    // Heuristic routing by path prefix:
    // - /v1/... or /chat/completions or /responses -> AI upstream
    // - /api/... -> research backend
    const isResearch = /^api\b/i.test(cleanTail);
    const isAI = /^v\d+\b/i.test(cleanTail) || /^chat\/completions/i.test(cleanTail) || /^responses/i.test(cleanTail);

    if (isResearch && !isAI) {
        const auth = process.env.RESEARCH_API_KEY ? `Bearer ${process.env.RESEARCH_API_KEY}` : undefined;
        return { base: researchBase, authHeader: auth, kind: 'research' };
    }

    // Default to AI upstream
    const auth = process.env.BACKEND_API_KEY ? `Bearer ${process.env.BACKEND_API_KEY}` : undefined;
    return { base: aiBase, authHeader: auth, kind: 'ai' };
}

async function proxy(req: Request, { params }: { params: { path: string[] } }) {
    const url = new URL(req.url);
    const tailPath = (params?.path || []).join('/');
    const upstream = resolveUpstream(tailPath);
    const targetUrl = `${upstream.base}/${tailPath}${url.search}`;

    try {
        // 轻量级入站日志（避免记录敏感信息/大体积 body）
        const hdrs: Record<string, string> = {};
        req.headers.forEach((v, k) => { if (['content-type'].includes(k.toLowerCase())) hdrs[k] = v; });
        console.debug('[Proxy][incoming]', { method: req.method, targetUrl, headers: hdrs });
    } catch { /* noop */ }

    const headers = new Headers();
    // Forward selected headers
    const hopByHop = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade']);
    req.headers.forEach((value, key) => {
        const lower = key.toLowerCase();
        if (!hopByHop.has(lower) && lower !== 'authorization') {
            headers.set(key, value);
        }
    });
    // 为避免 Node 层解压后浏览器再次解压导致 ERR_CONTENT_DECODING_FAILED，强制上游返回未压缩主体
    headers.set('accept-encoding', 'identity');
    // Inject server-side Authorization if configured; this avoids exposing secrets to the browser
    if (upstream.authHeader) {
        headers.set('Authorization', upstream.authHeader);
    }

    const method = req.method.toUpperCase();
    const isBodyless = method === 'GET' || method === 'HEAD';

    // Prepare body according to content-type
    let body: BodyInit | undefined = undefined;
    if (!isBodyless) {
        const contentType = req.headers.get('content-type') || '';
        if (contentType.includes('application/json') || contentType.includes('text/')) {
            body = await req.text();
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
            body = await req.text();
        } else if (contentType.includes('multipart/form-data')) {
            const form = await (req as any).formData?.();
            body = form as any;
        } else {
            const ab = await req.arrayBuffer();
            body = ab as any;
        }
    }

    try {
        const resp = await fetch(targetUrl, {
            method,
            headers,
            body,
            redirect: 'follow',
            // Do not cache proxied responses by default
            cache: 'no-store'
        });

        const respHeaders = new Headers();
        resp.headers.forEach((value, key) => {
            // Strip hop-by-hop headers and encoding-related headers to prevent double-decoding in browser
            const lower = key.toLowerCase();
            if (!hopByHop.has(lower) && lower !== 'content-length' && lower !== 'content-encoding') {
                respHeaders.set(key, value);
            }
        });

        // Stream passthrough: do not clone/tap body to avoid buffering SSE
        const contentType = resp.headers.get('content-type') || '';
        try { console.debug('[Proxy][upstream-response]', { status: resp.status, contentType }); } catch { /* noop */ }
        return new NextResponse(resp.body, { status: resp.status, statusText: resp.statusText, headers: respHeaders });
    } catch (err: any) {
        return NextResponse.json({ error: 'Upstream request failed', message: String(err?.message || err) }, { status: 502 });
    }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const PATCH = proxy;
export const OPTIONS = proxy;


