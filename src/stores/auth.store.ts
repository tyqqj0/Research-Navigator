/**
 * 🔐 Authentication Store - 用户身份认证状态管理
 * 
 * 负责管理用户身份状态，提供安全的用户ID获取方法
 * 
 * 设计原则：
 * 1. 单一职责 - 只管理身份认证状态
 * 2. 安全优先 - 提供安全的用户ID获取方法
 * 3. 简单易用 - 为Service层提供便捷的API
 * 4. 可扩展 - 为未来的用户管理功能预留接口
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

/**
 * 👤 用户基本信息
 */
export interface UserProfile {
    id: string;
    email: string;
    name: string;
    avatar?: string;
    createdAt: Date;
    lastLoginAt: Date;
}

/**
 * 🔒 认证错误
 */
export class AuthenticationError extends Error {
    constructor(message: string = 'Authentication required') {
        super(message);
        this.name = 'AuthenticationError';
    }
}

/**
 * 🏪 Auth Store状态接口
 */
export interface AuthStoreState {
    // 👤 用户状态
    currentUser: UserProfile | null;
    token: string | null;
    isAuthenticated: boolean;

    // 🔄 加载状态
    isLoading: boolean;
    error: string | null;

    // 🔧 核心方法 - Service层的主要依赖
    getCurrentUserId(): string;
    requireAuth(): string;

    // 🎯 身份管理方法
    setCurrentUser: (user: UserProfile | null) => void;
    setToken: (token: string | null) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    clearAuth: () => void;

    // 🔍 查询方法
    isUserLoggedIn: () => boolean;
    getUserId: () => string | null;
    getUserEmail: () => string | null;
}

/**
 * 🏪 Auth Store实现
 */
export const useAuthStore = create<AuthStoreState>()(
    immer((set, get) => ({
        // 📊 初始状态
        currentUser: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,

        // 🔧 核心方法 - Service层专用
        getCurrentUserId: () => {
            const state = get();
            return state.currentUser?.id || '';
        },

        requireAuth: () => {
            const state = get();
            const userId = state.currentUser?.id;

            if (!userId) {
                throw new AuthenticationError('Please login to continue');
            }

            return userId;
        },

        // 🎯 状态管理方法
        setCurrentUser: (user) => {
            set((state) => {
                state.currentUser = user;
                state.isAuthenticated = !!user;
                state.error = null;

                // 用户登录时清除加载状态
                if (user) {
                    state.isLoading = false;
                }
            });
        },

        setToken: (token) => {
            set((state) => {
                state.token = token;
            });
        },

        setLoading: (loading) => {
            set((state) => {
                state.isLoading = loading;
                if (loading) {
                    state.error = null;
                }
            });
        },

        setError: (error) => {
            set((state) => {
                state.error = error;
                state.isLoading = false;
            });
        },

        clearAuth: () => {
            set((state) => {
                state.currentUser = null;
                state.token = null;
                state.isAuthenticated = false;
                state.isLoading = false;
                state.error = null;
            });
        },

        // 🔍 便捷查询方法
        isUserLoggedIn: () => {
            return !!get().currentUser;
        },

        getUserId: () => {
            return get().currentUser?.id || null;
        },

        getUserEmail: () => {
            return get().currentUser?.email || null;
        },
    }))
);

/**
 * 🛠️ Auth Store工具方法
 */
export const authStoreUtils = {
    /**
     * 🔧 获取Auth Store的静态引用（用于Service层依赖注入）
     */
    getStoreInstance: () => useAuthStore.getState(),

    /**
     * 🎭 开发模式：设置测试用户
     */
    setDevelopmentUser: (userId: string = 'dev-user-001') => {
        const testUser: UserProfile = {
            id: userId,
            email: 'dev@example.com',
            name: 'Development User',
            avatar: undefined,
            createdAt: new Date(),
            lastLoginAt: new Date(),
        };

        useAuthStore.getState().setCurrentUser(testUser);
        console.log(`🎭 Development user set: ${userId}`);
    },

    /**
     * 🧪 测试模式：创建Mock Auth Store
     */
    createMockAuthStore: (userId: string = 'test-user-001') => ({
        getCurrentUserId: () => userId,
        requireAuth: () => userId,
        isUserLoggedIn: () => true,
        getUserId: () => userId,
    }),
};

// 🎭 开发模式自动设置测试用户
if (process.env.NODE_ENV === 'development') {
    // 延迟设置，避免初始化竞态条件
    setTimeout(() => {
        authStoreUtils.setDevelopmentUser();
    }, 100);
}

export default useAuthStore;
