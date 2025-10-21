"use client";

import { useEffect } from 'react';
import useAuthStore from '@/stores/auth.store';
import { authApi } from '@/lib/auth/auth-api';

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

    useEffect(() => {
        let cancelled = false;
        const bootstrap = async () => {
            // If already authenticated (persisted), nothing to do
            if (isAuthenticated) return;
            setLoading(true);
            try {
                const me = await authApi.getMe();
                if (cancelled) return;
                if (me?.user) {
                    login({ user: me.user, token: me.token ?? null });
                } else {
                    clearAuth();
                }
            } catch {
                if (!cancelled) clearAuth();
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


