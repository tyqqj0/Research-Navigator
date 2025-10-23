"use client";

import React, { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function RegisterPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    useEffect(() => {
        const returnTo = encodeURIComponent((searchParams?.get('returnTo') || '/'));
        router.replace(`/oauth-app/login?returnTo=${returnTo}`);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return null;
}


