/**
 * Auth API (Mock) - 统一前端鉴权适配层
 * 未来可替换为真实后端HTTP调用而不影响上层UI/Store
 */

import type { UserProfile } from '@/stores/auth.store';
import { browserFindUserByEmail, browserCreateUser, browserUpdateUser, browserReadAllUsers } from '@/lib/auth/browser-user-db';

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

const MODE = process.env.NEXT_PUBLIC_AUTH_MODE || 'server';
const isBrowser = typeof window !== 'undefined';

function setDevSessionCookie(userId: string) {
    if (!isBrowser) return;
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `dev_session=${encodeURIComponent(userId)}; Path=/; SameSite=Lax; Expires=${expires}`;
}

function clearDevSessionCookie() {
    if (!isBrowser) return;
    document.cookie = `dev_session=; Path=/; Max-Age=0; SameSite=Lax`;
}

function getDevSessionCookie(): string | null {
    if (!isBrowser) return null;
    const match = document.cookie.match(/(?:^|;\s*)dev_session=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
}

export const authApi = {
    async login(params: LoginParams): Promise<AuthResult> {
        if (MODE === 'browser' && isBrowser) {
            const user = browserFindUserByEmail(params.email);
            if (!user) throw new Error('用户不存在');
            if (user.passwordHash !== (params.password || '')) throw new Error('邮箱或密码错误');
            user.lastLoginAt = new Date().toISOString();
            browserUpdateUser(user);
            setDevSessionCookie(user.id);
            return {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    avatar: user.avatar,
                    createdAt: new Date(user.createdAt),
                    lastLoginAt: new Date(user.lastLoginAt),
                },
                token: 'dev-session',
            };
        }

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
        if (MODE === 'browser' && isBrowser) {
            const exists = browserFindUserByEmail(params.email);
            if (exists) throw new Error('邮箱已被注册');
            const record = browserCreateUser({ email: params.email, name: params.name, password: params.password || '' });
            setDevSessionCookie(record.id);
            return {
                user: {
                    id: record.id,
                    email: record.email,
                    name: record.name,
                    avatar: record.avatar,
                    createdAt: new Date(record.createdAt),
                    lastLoginAt: new Date(record.lastLoginAt),
                },
                token: 'dev-session',
            };
        }

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
        if (MODE === 'browser' && isBrowser) {
            const userId = getDevSessionCookie();
            if (!userId) return null;
            const users = browserReadAllUsers();
            const user = users.find((u) => u.id === userId);
            if (!user) return null;
            return {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    avatar: user.avatar,
                    createdAt: new Date(user.createdAt),
                    lastLoginAt: new Date(user.lastLoginAt),
                },
                token: 'dev-session',
            };
        }

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
        if (MODE === 'browser' && isBrowser) {
            clearDevSessionCookie();
            return;
        }
        await fetch('/api/auth/logout', { method: 'POST' });
    },
};

export default authApi;


