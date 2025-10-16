'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { HeaderProps } from '@/types';
import { ExpandableUserMenu } from '@/components/ui/expandable-user-menu';
import useAuthStore from '@/stores/auth.store';
import { authApi } from '@/lib/auth/auth-api';

export const Header: React.FC<HeaderProps> = ({
    title = 'Research Navigator',
    logo,
    actions,
    user,
    hideUserInfo,
    className
}) => {
    const router = useRouter();
    const authUser = useAuthStore((s) => s.currentUser);
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const logoutStore = useAuthStore((s) => s.logout);

    const displayUser = isAuthenticated && authUser ? {
        name: authUser.name,
        avatar: authUser.avatar,
    } : user; // 未登录时回退到传入的user（兼容旧实现）

    const handleLogout = async () => {
        try {
            await authApi.logout();
        } catch { }
        logoutStore();
        router.push('/login');
    };
    return (
        <header
            className={cn(
                'h-16 border-b border-gray-200 bg-white shadow-sm theme-primary-background relative z-40',
                className
            )}
        >
            <div className="flex h-full items-center justify-between px-6">
                {/* 左侧：Logo 和标题 */}
                <div className="flex items-center space-x-4">
                    {logo && (
                        <div className="flex items-center">
                            {logo}
                        </div>
                    )}
                    <h1 className={cn(
                        'text-xl font-semibold',
                        'theme-text-primary'
                    )}>
                        {title}
                    </h1>
                </div>

                {/* 右侧：操作按钮和用户信息 */}
                <div className="flex items-center space-x-4">
                    {actions && (
                        <div className="flex items-center space-x-2">
                            {actions}
                        </div>
                    )}

                    {displayUser && !hideUserInfo && (
                        <ExpandableUserMenu
                            user={{
                                name: displayUser.name,
                                email: authUser?.email,
                                avatar: displayUser.avatar,
                            }}
                            onLogout={handleLogout}
                            align="end"
                            expandDirection="bottom"
                        />
                    )}
                </div>
            </div>
        </header>
    );
};
