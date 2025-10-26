import { NextRequest, NextResponse } from 'next/server';

// 允许匿名访问的路径前缀
const PUBLIC_PATHS = new Set<string>([
    '/oauth-app/callback',
    '/oauth-app/login',
]);

function isPublicPath(pathname: string): boolean {
    if (PUBLIC_PATHS.has(pathname)) return true;
    if (pathname.startsWith('/_next/')) return true;
    if (pathname.startsWith('/api/')) return true;
    if (pathname.startsWith('/favicon')) return true;
    if (pathname.startsWith('/assets/')) return true;
    if (pathname.startsWith('/images/')) return true;
    if (pathname.startsWith('/fonts/')) return true;
    return false;
}

export function middleware(req: NextRequest) {
    // For now, rely on client-side RequireAuth. Keep middleware permissive.
    // Optionally, implement SSR session cookie gate later.
    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};




