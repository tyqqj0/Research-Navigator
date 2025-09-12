"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi } from '@/lib/auth/auth-api';
import useAuthStore from '@/stores/auth.store';

export default function RegisterPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const loginStore = useAuthStore((s) => s.login);
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        try {
            const result = await authApi.register({ email, name, password });
            loginStore({ user: result.user, token: result.token });
            const returnTo = searchParams?.get('returnTo') || '/';
            router.replace(returnTo);
        } catch (err: any) {
            setError(err?.message || '注册失败，请重试');
        } finally {
            setIsSubmitting(false);
        }
    };

    useEffect(() => {
        if (isAuthenticated) {
            const returnTo = searchParams?.get('returnTo') || '/';
            router.replace(returnTo);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated]);

    if (isAuthenticated) return null;

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>注册账号</CardTitle>
                    <CardDescription>创建新账户以使用 Research Navigator</CardDescription>
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
                            <Label htmlFor="name">昵称</Label>
                            <Input
                                id="name"
                                type="text"
                                placeholder="你的名字"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">密码</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="至少 6 位"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        {error && (
                            <div className="text-sm text-red-600">{error}</div>
                        )}
                        <Button type="submit" className="w-full" disabled={isSubmitting}>
                            {isSubmitting ? '注册中...' : '注册并登录'}
                        </Button>
                        <div className="text-sm text-center mt-2">
                            已有账号？
                            <Button variant="link" type="button" onClick={() => router.push('/login')}>
                                去登录
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}


