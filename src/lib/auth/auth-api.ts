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
        await delay(400);
        const now = new Date();
        const mockUser: UserProfile = {
            id: `user_${Math.random().toString(36).slice(2, 10)}`,
            email: params.email,
            name: params.name || params.email.split('@')[0] || 'User',
            avatar: undefined,
            createdAt: now,
            lastLoginAt: now,
        };
        // 注意：纯前端demo不返回真实token
        const token = null;
        return { user: mockUser, token };
    },

    async register(params: RegisterParams): Promise<AuthResult> {
        await delay(600);
        const now = new Date();
        const mockUser: UserProfile = {
            id: `user_${Math.random().toString(36).slice(2, 10)}`,
            email: params.email,
            name: params.name,
            avatar: undefined,
            createdAt: now,
            lastLoginAt: now,
        };
        return { user: mockUser, token: null };
    },

    async getMe(): Promise<AuthResult | null> {
        // 真实项目中应从后端读取会话（cookie）并返回用户
        await delay(200);
        return null;
    },

    async logout(): Promise<void> {
        await delay(100);
    },
};

export default authApi;


