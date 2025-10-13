import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getTargetBaseUrl(): string {
    // Server-side only env for backend origin
    const base = process.env.BACKEND_API_BASE_URL || 'http://localhost:8000';
    return base.replace(/\/$/, '');
}

async function proxy(req: Request, { params }: { params: { path: string[] } }) {
    const backendBase = getTargetBaseUrl();
    const url = new URL(req.url);
    const tailPath = (params?.path || []).join('/');
    const targetUrl = `${backendBase}/${tailPath}${url.search}`;

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
    if (process.env.BACKEND_API_KEY) {
        headers.set('Authorization', `Bearer ${process.env.BACKEND_API_KEY}`);
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

        // Tap response for small preview using a cloned stream, then forward original stream
        const contentType = resp.headers.get('content-type') || '';
        const previewEnabled = true;
        if (previewEnabled) {
            try {
                const cloned = resp.clone();
                const buf = Buffer.from(await cloned.arrayBuffer());
                let previewStr: string | undefined;
                const encoding = resp.headers.get('content-encoding') || '';
                try {
                    if (/^(gzip|br|deflate)$/i.test(encoding)) {
                        // best-effort decompress for preview only
                        const zlib = await import('zlib');
                        const decompressed = encoding.toLowerCase() === 'gzip' ? zlib.gunzipSync(buf)
                            : encoding.toLowerCase() === 'deflate' ? zlib.inflateSync(buf)
                                : zlib.brotliDecompressSync(buf);
                        previewStr = decompressed.toString('utf8').slice(0, 200);
                    } else {
                        previewStr = buf.toString('utf8').slice(0, 200);
                    }
                } catch { /* ignore preview failures */ }
                console.debug('[Proxy][upstream-response]', { status: resp.status, contentType, encoding, preview: previewStr });
            } catch { /* noop */ }
        }
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


