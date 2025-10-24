"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OAuthLoginPage() {
    const router = useRouter();

    useEffect(() => {
        try { console.log('[auth][login][deprecated] redirect to /'); } catch { /* noop */ }
        router.replace('/');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return null;
}


