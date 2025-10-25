"use client";

import { useEffect } from 'react';
import { useOAuth } from '@autolabz/oauth-sdk';
import useAuthStore from '@/stores/auth.store';
// Legacy bootstrap using authApi has been deprecated in favor of OAuth SDK

/**
 * AuthBootstrap
 * - On app mount, hydrate auth state from server/browser session (dev_session or /api/auth/me)
 * - Keeps auth store in sync after hard reloads
 */
export function AuthBootstrap() {
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const setLoading = useAuthStore((s) => s.setLoading);
    const login = useAuthStore((s) => s.login);
    const clearAuth = useAuthStore((s) => s.clearAuth);
    const { refreshAuth } = (() => {
        try { return useOAuth(); } catch { return { refreshAuth: () => { } } as any; }
    })();

    useEffect(() => {
        let cancelled = false;
        const bootstrap = async () => {
            // If already authenticated (persisted), nothing to do
            if (isAuthenticated) return;
            setLoading(true);
            try {
                // Ensure SDK rehydrates from localStorage/token storage on hard reloads
                try { refreshAuth?.(); } catch { /* noop */ }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void bootstrap();
        return () => {
            cancelled = true;
        };
    }, [isAuthenticated, setLoading, login, clearAuth]);

    return null;
}

export default AuthBootstrap;


