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

    const headers = new Headers();
    // Forward selected headers
    const hopByHop = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade']);
    req.headers.forEach((value, key) => {
        const lower = key.toLowerCase();
        if (!hopByHop.has(lower) && lower !== 'authorization') {
            headers.set(key, value);
        }
    });
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
            // Strip hop-by-hop headers and encoding-specific headers
            if (!hopByHop.has(key.toLowerCase()) && key.toLowerCase() !== 'content-encoding') {
                respHeaders.set(key, value);
            }
        });

        const responseBody = await resp.arrayBuffer();
        return new NextResponse(responseBody, { status: resp.status, statusText: resp.statusText, headers: respHeaders });
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


