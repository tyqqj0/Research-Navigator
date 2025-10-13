"use client";

import React, { useEffect, useState } from 'react';
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
    const clearAuth = useAuthStore((s) => s.clearAuth);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const safeResolveReturnTo = (): string => {
        const raw = searchParams?.get('returnTo');
        if (!raw) return '/';
        let decoded = raw;
        try {
            decoded = decodeURIComponent(raw);
        } catch {
            // ignore decode errors, fallback to raw
        }
        // Only allow same-origin path starting with '/'
        if (!decoded.startsWith('/')) return '/';
        // Prevent open redirect to protocols like //evil.com
        if (decoded.startsWith('//')) return '/';
        return decoded || '/';
    };

    const hasDevSessionCookie = (): boolean => {
        if (typeof document === 'undefined') return false;
        return document.cookie.includes('dev_session=');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        try {
            const result = await authApi.login({ email, password });
            loginStore({ user: result.user, token: result.token });
            router.replace(safeResolveReturnTo());
        } catch (err: any) {
            setError(err?.message || '登录失败，请重试');
        } finally {
            setIsSubmitting(false);
        }
    };

    useEffect(() => {
        if (!isAuthenticated) return;
        if (hasDevSessionCookie()) {
            router.replace(safeResolveReturnTo());
        } else {
            // 本地状态显示已登录，但无会话cookie，视为失效会话并重置
            clearAuth();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated]);

    if (isAuthenticated && hasDevSessionCookie()) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="text-sm text-gray-600">已登录，正在跳转...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
            <div className="hidden lg:flex flex-col justify-center p-12 bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 text-white">
                <h2 className="text-3xl font-semibold mb-4">Research Navigator</h2>
                <p className="text-sm text-white/80">智能研究助手 · 更快发现与管理文献</p>
                <div className="mt-8 space-y-2 text-white/70 text-sm">
                    <div>• 智能检索 · 高质量来源聚合</div>
                    <div>• 笔记与标签 · 管理与回顾高效</div>
                    <div>• 引文追踪 · 知识网络洞察</div>
                </div>
            </div>
            <div className="flex items-center justify-center p-6">
                <Card className="w-full max-w-md shadow-xl">
                    <CardHeader>
                        <CardTitle>登录 Research Navigator</CardTitle>
                        <CardDescription>使用注册的邮箱与密码登录</CardDescription>
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
                                <Label htmlFor="password">密码</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="输入密码"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                            {error && (
                                <div className="text-sm text-red-600">{error}</div>
                            )}
                            <Button type="submit" className="w-full" disabled={isSubmitting}>
                                {isSubmitting ? '登录中...' : '登录'}
                            </Button>
                            <div className="text-sm text-center mt-2">
                                还没有账号？
                                <Button variant="link" type="button" onClick={() => router.push('/register')}>
                                    去注册
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}


