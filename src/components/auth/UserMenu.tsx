"use client";

import React, { useMemo, useCallback } from 'react';
import { useOAuth } from '@autolabz/oauth-sdk';
import { Button } from '@/components/ui/button';
import { ExpandableUserMenu } from '@/components/ui/expandable-user-menu';
import { LogIn, User as UserIcon, LogOut } from 'lucide-react';

interface UserMenuProps {
    className?: string;
    /** 展开方向：'bottom' | 'top' | 'left' | 'right' */
    expandDirection?: 'bottom' | 'top' | 'left' | 'right';
    /** 对齐方式 */
    align?: 'start' | 'center' | 'end';
}

/**
 * 应用内用户菜单：
 * - 未登录：展示登录按钮，触发 OAuth 登录
 * - 已登录：展示精美卡片，仅包含“用户主页”和“退出登录”两项
 * 不使用 SDK 内置的菜单外观，复用现有 UI 风格
 */
export const UserMenu: React.FC<UserMenuProps> = ({ className, expandDirection = 'top', align = 'center' }) => {
    const { isAuthenticated, user, startLogin, logout, logoutSession } = (() => {
        try { return useOAuth(); } catch { return { isAuthenticated: false, user: undefined, startLogin: async () => { }, logout: async () => { }, logoutSession: async () => { } } as any; }
    })();

    const redirectUri = useMemo(() => {
        if (typeof window !== 'undefined') {
            return process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI || `${window.location.origin}/oauth-app/callback`;
        }
        return process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI || '/oauth-app/callback';
    }, []);

    const scope = process.env.NEXT_PUBLIC_OAUTH_SCOPE || 'openid profile email';
    const profileUrl = process.env.NEXT_PUBLIC_OAUTH_PROFILE_URL;

    const buildState = useCallback(() => {
        try {
            const payload = {
                returnTo: typeof window !== 'undefined' ? window.location.href : '/',
                nonce: (typeof crypto !== 'undefined' && (crypto as any).randomUUID?.()) || String(Date.now()),
            } as const;
            const json = JSON.stringify(payload);
            return btoa(encodeURIComponent(json));
        } catch { return ''; }
    }, []);

    const handleLogin = useCallback(async () => {
        await startLogin({
            redirectUri,
            scope,
            usePkce: true,
            additionalParams: { state: buildState() },
        });
    }, [buildState, redirectUri, scope, startLogin]);

    const handleLogout = useCallback(async () => {
        try { sessionStorage.setItem('oauth:logout-intent', '1'); } catch { /* noop */ }
        try {
            // Prefer full sign-out to terminate server session so next login prompts for credentials
            await logoutSession();
        } catch {
            // Fallback: at least terminate current app/server session
            try { await logoutSession?.(); } catch { /* noop */ }
        } finally {
            try { sessionStorage.removeItem('oauth:logout-intent'); } catch { /* noop */ }
        }
    }, [logout, logoutSession]);

    const displayUser = useMemo(() => {
        const name = (user?.nickname || user?.name || user?.username || user?.preferred_username || user?.email || 'User') as string;
        const email = (user?.email || user?.mail || undefined) as string | undefined;
        const avatar = (user?.avatar || user?.avatarUrl || user?.picture || undefined) as string | undefined;
        return { name, email, avatar };
    }, [user]);

    if (!isAuthenticated) {
        return (
            <Button
                type="button"
                variant="ghost"
                className="h-9 px-2 theme-pressable-flat"
                onClick={handleLogin}
            >
                <LogIn className="h-4 w-4" />
                <span className="ml-2">登录</span>
            </Button>
        );
    }

    const actions = [
        ...(profileUrl ? [{ label: '用户主页', icon: <UserIcon className="w-4 h-4" />, href: profileUrl }] : []),
        { label: '退出登录', icon: <LogOut className="w-4 h-4" />, onClick: handleLogout, variant: 'danger' as const },
    ];

    return (
        <ExpandableUserMenu
            user={displayUser}
            actions={actions}
            className={className}
            expandDirection={expandDirection}
            align={align}
            morphFromTrigger
        />
    );
};

export default UserMenu;


