"use client";

import React, { useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import useAuthStore from '@/stores/auth.store';
import { Skeleton } from '@/components/ui/skeleton';

interface RequireAuthProps {
    children: React.ReactNode;
}

/**
 * 受保护路由包装：未登录时跳转到 /login，并附带返回地址
 */
export const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const isLoading = useAuthStore((s) => s.isLoading);

    useEffect(() => {
        try { console.log('[auth][guard]', { isLoading, isAuthenticated, pathname }); } catch { /* noop */ }
        if (!isLoading && !isAuthenticated) {
            const returnTo = encodeURIComponent(
                pathname + (searchParams?.toString() ? `?${searchParams?.toString()}` : '')
            );
            router.replace(`/?returnTo=${returnTo}`);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated, isLoading, pathname]);

    if (isLoading || !isAuthenticated) {
        return (
            <div className="p-6 space-y-4">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    return <>{children}</>;
};

export default RequireAuth;


