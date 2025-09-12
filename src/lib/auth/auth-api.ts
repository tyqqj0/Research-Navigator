/**
 * Auth API (Mock) - 统一前端鉴权适配层
 * 未来可替换为真实后端HTTP调用而不影响上层UI/Store
 */

import type { UserProfile } from '@/stores/auth.store';

export interface LoginParams {
    email: string;
    name?: string;
    password?: string;
    code?: string;
}

export interface RegisterParams {
    email: string;
    name: string;
    password?: string;
}

export interface AuthResult {
    user: UserProfile;
    token: string | null;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const authApi = {
    async login(params: LoginParams): Promise<AuthResult> {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: params.email, password: params.password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '登录失败');
        return {
            user: {
                ...data.user,
                createdAt: new Date(data.user.createdAt),
                lastLoginAt: new Date(data.user.lastLoginAt),
            },
            token: data.token ?? null,
        };
    },

    async register(params: RegisterParams): Promise<AuthResult> {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '注册失败');
        return {
            user: {
                ...data.user,
                createdAt: new Date(data.user.createdAt),
                lastLoginAt: new Date(data.user.lastLoginAt),
            },
            token: data.token ?? null,
        };
    },

    async getMe(): Promise<AuthResult | null> {
        const res = await fetch('/api/auth/me');
        if (!res.ok) return null;
        const data = await res.json();
        if (!data || !data.user) return null;
        return {
            user: {
                ...data.user,
                createdAt: new Date(data.user.createdAt),
                lastLoginAt: new Date(data.user.lastLoginAt),
            },
            token: data.token ?? null,
        };
    },

    async logout(): Promise<void> {
        await fetch('/api/auth/logout', { method: 'POST' });
    },
};

export default authApi;


