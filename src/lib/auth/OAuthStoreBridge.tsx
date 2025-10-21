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
        if (isAuthenticated && user) {
            const mappedUser = {
                id: String(user.sub || user.id || user.userId || 'oauth-user'),
                email: String(user.email || ''),
                name: String(user.name || user.nickname || user.preferred_username || user.email || 'User'),
                avatar: (user.picture as string | undefined) || undefined,
                createdAt: new Date(),
                lastLoginAt: new Date(),
            };
            login({ user: mappedUser, token: typeof accessToken === 'string' ? accessToken : null });
        } else {
            clearAuth();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated, user, accessToken]);

    return null;
}


