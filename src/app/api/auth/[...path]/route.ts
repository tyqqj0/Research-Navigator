import { NextRequest, NextResponse } from 'next/server';

// Proxy OAuth/auth requests via same-origin to avoid mixed content in browsers.
// Upstream base URL should be configured as an environment variable on the server only.
const upstreamBase = process.env.AUTH_UPSTREAM_INTERNAL_BASE_URL || process.env.AUTH_UPSTREAM_BASE_URL || process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;

if (!upstreamBase) {
  // Intentionally not throwing at import time in case of ISR/edge differences
  // We'll validate at request time below.
}

function joinUrl(base: string, path: string) {
  const b = base.replace(/\/$/, '');
  const p = path.replace(/^\//, '');
  return `${b}/${p}`;
}

async function handle(req: NextRequest, { params }: { params: { path?: string[] } }) {
  const { path = [] } = params;
  const upstream = upstreamBase;
  if (!upstream) {
    return NextResponse.json({ error: 'Auth upstream not configured' }, { status: 500 });
  }

  // Build target URL
  const targetPath = path.join('/');
  const targetUrl = new URL(joinUrl(upstream, targetPath));
  // Preserve search params
  const reqUrl = new URL(req.url);
  reqUrl.searchParams.forEach((v, k) => targetUrl.searchParams.set(k, v));

  // Prepare init
  const headers = new Headers(req.headers);
  // Strip hop-by-hop / host headers
  headers.delete('host');
  headers.delete('content-length');
  headers.delete('connection');
  headers.set('x-forwarded-proto', 'https');
  headers.set('x-forwarded-host', req.headers.get('host') || '');

  const init: RequestInit = {
    method: req.method,
    headers,
    // Only pass body for methods that may have one
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body,
    duplex: 'half',
  } as any;

  try {
    const resp = await fetch(targetUrl.toString(), init);
    const respHeaders = new Headers(resp.headers);
    // Ensure CORS is same-origin friendly
    respHeaders.delete('access-control-allow-origin');
    respHeaders.delete('access-control-allow-credentials');
    return new NextResponse(resp.body, {
      status: resp.status,
      headers: respHeaders,
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Upstream fetch failed', message: String(e?.message || e) }, { status: 502 });
  }
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE, handle as HEAD, handle as OPTIONS };


