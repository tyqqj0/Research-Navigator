"use client";

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi } from '@/lib/auth/auth-api';
import useAuthStore from '@/stores/auth.store';

export default function LoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const loginStore = useAuthStore((s) => s.login);
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        try {
            const result = await authApi.login({ email, name });
            loginStore({ user: result.user, token: result.token });
            const returnTo = searchParams?.get('returnTo') || '/';
            router.replace(returnTo);
        } catch (err: any) {
            setError(err?.message || '登录失败，请重试');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isAuthenticated) {
        const returnTo = searchParams?.get('returnTo') || '/';
        router.replace(returnTo);
        return null;
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>登录 Research Navigator</CardTitle>
                    <CardDescription>当前为本地演示登录，未来可无缝接入后端</CardDescription>
                </CardHeader>
                <CardContent>
                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <div className="space-y-2">
                            <Label htmlFor="email">邮箱</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="name">昵称（可选）</Label>
                            <Input
                                id="name"
                                type="text"
                                placeholder="你的名字"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                        {error && (
                            <div className="text-sm text-red-600">{error}</div>
                        )}
                        <Button type="submit" className="w-full" disabled={isSubmitting}>
                            {isSubmitting ? '登录中...' : '登录'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}


