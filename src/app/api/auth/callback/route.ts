import { NextRequest, NextResponse } from 'next/server';

export function GET(request: NextRequest) {
    const target = new URL('/oauth-app/callback', request.nextUrl.origin);
    // Preserve all query parameters from the OAuth server
    request.nextUrl.searchParams.forEach((value, key) => {
        target.searchParams.set(key, value);
    });
    return NextResponse.redirect(target, { status: 302 });
}


