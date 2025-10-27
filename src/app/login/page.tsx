"use client";

import React, { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        try { console.log('[auth][legacy-login] redirect to /'); } catch { /* noop */ }
        router.replace('/');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return null;
}


