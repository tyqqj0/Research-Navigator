import { NextRequest, NextResponse } from 'next/server';

// 允许匿名访问的路径前缀
const PUBLIC_PATHS = new Set<string>([
    '/login',
    '/register',
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
    // Dev bypass for OAuth integration
    if (process.env.NEXT_PUBLIC_DISABLE_AUTH_MIDDLEWARE === 'true') {
        return NextResponse.next();
    }
    const { pathname, search } = req.nextUrl;
    if (isPublicPath(pathname)) {
        return NextResponse.next();
    }

    const hasSession = !!req.cookies.get('dev_session')?.value;
    if (hasSession) {
        return NextResponse.next();
    }

    const url = req.nextUrl.clone();
    url.pathname = '/login';
    const returnTo = encodeURIComponent(pathname + (search || ''));
    url.search = `?returnTo=${returnTo}`;
    return NextResponse.redirect(url);
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};




