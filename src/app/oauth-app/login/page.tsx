"use client";

import { useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useOAuth } from '@autolabz/oauth-sdk';

export default function OAuthLoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { startLogin, isAuthenticated, accessToken } = useOAuth();
    const redirectUri = process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI || `${typeof window !== 'undefined' ? window.location.origin : ''}/oauth-app/callback`;

    const doLogin = useCallback(async () => {
        await startLogin({
            redirectUri,
            scope: process.env.NEXT_PUBLIC_OAUTH_SCOPE || 'openid profile email',
            usePkce: true,
        });
    }, [redirectUri, startLogin]);

    useEffect(() => {
        const returnTo = searchParams?.get('returnTo') || '/';
        if (isAuthenticated && typeof accessToken === 'string' && accessToken.length > 0) {
            router.replace(returnTo);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated, accessToken]);

    return (
        <div className="min-h-screen flex items-center justify-center p-6">
            <Card className="w-full max-w-md shadow-xl">
                <CardHeader>
                    <CardTitle>使用 OAuth 登录</CardTitle>
                    <CardDescription>将跳转到授权页面完成登录</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button className="w-full" onClick={doLogin}>
                        前往登录
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}


