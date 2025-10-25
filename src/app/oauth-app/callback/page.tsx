"use client";

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useOAuth } from '@autolabz/oauth-sdk';

export default function OAuthCallbackPage() {
    const router = useRouter();
    const search = useSearchParams();
    const { handleRedirect, isAuthenticated, accessToken } = useOAuth();
    const redirectUri = process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI || `${typeof window !== 'undefined' ? window.location.origin : ''}/oauth-app/callback`;

    useEffect(() => {
        // If no code present and already authed, go home
        const code = search?.get('code');
        const error = search?.get('error');
        const hasToken = typeof accessToken === 'string' && accessToken.length > 0;
        let hasLogoutIntent = false;
        try {
            hasLogoutIntent = sessionStorage.getItem('oauth:logout-intent') === '1';
        } catch { }

        if (hasLogoutIntent) {
            // 用户刚刚点击了退出，不要继续处理 OAuth 回调，回到首页
            router.replace('/');
            return;
        }
        if (!code && !error && isAuthenticated && hasToken) {
            router.replace('/research');
            return;
        }
        handleRedirect({ fetchUserinfo: true, redirectUri })
            .then(() => {

                router.replace('/research');
            })
            .catch((e) => {

                router.replace('/');
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="text-center space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="text-sm text-gray-600">正在处理登录...</p>
            </div>
        </div>
    );
}


