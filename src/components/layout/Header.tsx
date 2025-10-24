'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { HeaderProps } from '@/types';
import { AuthAvatar } from '@autolabz/oauth-sdk';

export const Header: React.FC<HeaderProps> = ({
    title = 'Research Navigator',
    logo,
    actions,
    rightContent,
    user,
    hideUserInfo,
    className,
    onOpenSidebar
}) => {
    const redirectUri = (() => {
        if (typeof window !== 'undefined') {
            return process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI || `${window.location.origin}/oauth-app/callback`;
        }
        return process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI || '/oauth-app/callback';
    })();
    const scope = process.env.NEXT_PUBLIC_OAUTH_SCOPE || 'openid profile email';
    const profileUrl = process.env.NEXT_PUBLIC_OAUTH_PROFILE_URL;
    const buildState = () => {
        try {
            const payload = {
                returnTo: typeof window !== 'undefined' ? window.location.href : '/',
                nonce: (typeof crypto !== 'undefined' && (crypto as any).randomUUID?.()) || String(Date.now()),
            };
            const json = JSON.stringify(payload);
            return btoa(encodeURIComponent(json));
        } catch { return ''; }
    };
    return (
        <header
            className={cn(
                'h-16 border-b border-gray-200 bg-white shadow-sm theme-primary-background relative z-40',
                className
            )}
        >
            <div className="flex h-full items-center justify-between px-4 md:px-6">
                {/* 左侧：Logo 和标题 */}
                <div className="flex items-center space-x-3 md:space-x-4">
                    {/* 移动端汉堡按钮 */}
                    <button
                        type="button"
                        aria-label="打开侧边栏"
                        onClick={onOpenSidebar}
                        className={cn(
                            'md:hidden inline-flex items-center justify-center rounded-md p-2 theme-text-primary hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring'
                        )}
                    >
                        {/* simple hamburger icon */}
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="3" y1="6" x2="21" y2="6"></line>
                            <line x1="3" y1="12" x2="21" y2="12"></line>
                            <line x1="3" y1="18" x2="21" y2="18"></line>
                        </svg>
                    </button>
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

                {/* 右侧：自定义内容 或 默认的操作按钮和用户信息 */}
                {rightContent ? (
                    <div className="flex items-center space-x-3 md:space-x-4">
                        {rightContent}
                    </div>
                ) : (
                    <div className="flex items-center space-x-3 md:space-x-4">
                        {actions && (
                            <div className="hidden sm:flex items-center space-x-2">
                                {actions}
                            </div>
                        )}

                        {!hideUserInfo && (
                            <AuthAvatar
                                className="hidden md:inline-flex"
                                redirectUri={redirectUri}
                                scope={scope}
                                profileUrl={profileUrl}
                                state={buildState}
                                align="end"
                            />
                        )}
                    </div>
                )}
            </div>
        </header>
    );
};
