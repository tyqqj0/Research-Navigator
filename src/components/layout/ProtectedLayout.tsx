'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useOAuth } from '@autolabz/oauth-sdk';

/**
 * ProtectedLayout - 受保护布局组件
 * 
 * 自动监听登录态，未登录时重定向到首页
 * 实现"退出登录自动回到落地页"的效果
 */
export function ProtectedLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { isAuthenticated } = (() => {
        try {
            return useOAuth();
        } catch {
            return { isAuthenticated: false };
        }
    })();

    // 使用 ref 跟踪上一次的认证状态，避免首次加载时误判
    const prevAuthRef = useRef<boolean | null>(null);

    useEffect(() => {
        // 白名单路由：OAuth 回调页不应被重定向
        const isCallbackRoute = pathname === '/oauth-app/callback';
        if (isCallbackRoute) {
            return;
        }

        // 首次加载：记录初始状态，不立即重定向（避免SSR/hydration问题）
        if (prevAuthRef.current === null) {
            prevAuthRef.current = isAuthenticated;
            // 如果初始就是未登录，立即重定向
            if (!isAuthenticated) {
                router.replace('/');
            }
            return;
        }

        // 检测到从已登录变为未登录（即退出登录）
        if (prevAuthRef.current === true && isAuthenticated === false) {
            console.debug('[ProtectedLayout] User logged out, redirecting to landing page');
            router.replace('/');
        }

        // 检测到未登录状态（无论是否状态变化）
        if (!isAuthenticated) {
            router.replace('/');
        }

        // 更新记录
        prevAuthRef.current = isAuthenticated;
    }, [isAuthenticated, pathname, router]);

    // 未登录时显示空白或加载提示（即将跳转）
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-center space-y-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="text-sm text-muted-foreground">正在验证登录状态...</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}

