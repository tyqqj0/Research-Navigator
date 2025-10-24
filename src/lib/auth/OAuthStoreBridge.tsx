"use client";

import { useEffect } from 'react';
import useAuthStore from '@/stores/auth.store';
import { useOAuth } from '@autolabz/oauth-sdk';

/**
 * Sync OAuth context state into our existing Auth Store, so legacy UI works.
 */
export default function OAuthStoreBridge() {
    const { isAuthenticated, user, accessToken } = useOAuth?.() || {} as any;
    const login = useAuthStore((s) => s.login);
    const clearAuth = useAuthStore((s) => s.clearAuth);

    useEffect(() => {
        try {
            console.log('[auth][bridge][state]', {
                isAuthenticated,
                hasUser: !!user,
                hasToken: typeof accessToken === 'string' && accessToken.length > 0,
                userSub: (user as any)?.sub,
                userEmail: (user as any)?.email,
            });
        } catch { /* noop */ }
        const hasToken = typeof accessToken === 'string' && accessToken.length > 0;
        if (isAuthenticated && user && hasToken) {
            const mappedUser = {
                id: String(user.sub || user.id || user.userId || 'oauth-user'),
                email: String(user.email || ''),
                name: String(user.name || user.nickname || user.preferred_username || user.email || 'User'),
                avatar: (user.picture as string | undefined) || undefined,
                createdAt: new Date(),
                lastLoginAt: new Date(),
            };
            try { console.log('[auth][bridge][login]', { id: mappedUser.id, email: mappedUser.email }); } catch { /* noop */ }
            login({ user: mappedUser, token: accessToken });
        } else {
            try { console.log('[auth][bridge][clearAuth]'); } catch { /* noop */ }
            clearAuth();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated, user, accessToken]);

    return null;
}


