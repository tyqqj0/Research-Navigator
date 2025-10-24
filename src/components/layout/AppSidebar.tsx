'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Settings, ChevronLeft, ChevronRight, Search as SearchIcon, Sun, Moon } from 'lucide-react';
import { Sidebar, type SidebarItem } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/search-input';
// import { AuthAvatar } from '@autolabz/oauth-sdk';
import { UserMenu } from '@/components/auth/UserMenu';
// import { QuickThemeToggle } from '@/components/ui/theme-mode-toggle';
import { useTheme } from '@/providers';
import useAuthStore from '@/stores/auth.store';
import { cn } from '@/lib/utils';
// OAuth hooks are only available inside `oauth-app` subtree

interface AppSidebarProps {
    collapsed: boolean;
    onCollapse?: (collapsed: boolean) => void;
    items: SidebarItem[];
    className?: string;
    /** 侧边栏展开宽度（像素） */
    width?: number;
    /** 侧边栏折叠宽度（像素） */
    collapsedWidth?: number;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
    collapsed,
    onCollapse,
    items,
    className,
    width = 210,
    collapsedWidth = 64,
}) => {
    const router = useRouter();
    const [query, setQuery] = React.useState('');
    const [showSearch, setShowSearch] = React.useState(false);
    const { theme, setThemeMode } = useTheme();

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

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = query.trim();
        if (!trimmed) return;
        // 全局搜索：跳转到文献发现页并携带查询
        router.push(`/literature/discovery?q=${encodeURIComponent(trimmed)}`);
        setQuery('');
    };

    // Logout is handled by AuthAvatar internally.

    // 初始化与持久化折叠状态
    React.useEffect(() => {
        try {
            const stored = localStorage.getItem('app:sidebar-collapsed');
            if (stored !== null) {
                onCollapse?.(stored === '1');
                return;
            }
            if (typeof window !== 'undefined' && window.innerWidth < 1280) {
                onCollapse?.(true);
            }
        } catch { }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    React.useEffect(() => {
        try {
            localStorage.setItem('app:sidebar-collapsed', collapsed ? '1' : '0');
        } catch { }
    }, [collapsed]);

    const TopSlot = (
        <div className={cn('space-y-3', collapsed && 'px-0')}>
            {/* 顶部紧凑行：用户、搜索按钮、折叠按钮 */}
            <div className={cn('flex items-center gap-2 px-2', collapsed ? 'justify-center' : undefined)}>
                {/* 用户菜单（自定义组件） - 仅在展开状态下显示 */}
                {!collapsed && (
                    <UserMenu
                        className=""
                        expandDirection="bottom"
                        align="start"
                    />
                )}

                {/* 搜索按钮（点击展开输入） */}
                {!collapsed && (
                    <Button
                        type="button"
                        variant="ghost"
                        className="h-9 px-2 theme-pressable-flat"
                        onClick={() => setShowSearch(v => !v)}
                    >
                        <SearchIcon className="h-4 w-4" />
                        <span className="ml-2">搜索</span>
                    </Button>
                )}

                {/* 折叠按钮（移动端隐藏，使用顶部汉堡触发） */}
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn('h-9 w-9 theme-pressable-flat hidden md:inline-flex', !collapsed && 'ml-auto')}
                    onClick={() => onCollapse?.(!collapsed)}
                    aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
                >
                    {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </Button>
            </div>

            {/* 可展开的搜索输入（非折叠时显示） */}
            {!collapsed && showSearch && (
                <form onSubmit={handleSearchSubmit} className="px-2">
                    <SearchInput
                        value={query}
                        onChange={setQuery}
                        onClear={() => setQuery('')}
                        placeholder="搜索文献/作者/关键词..."
                        autoFocus
                    />
                </form>
            )}
        </div>
    );

    const BottomSlot = (
        <div className={cn('space-y-2 py-2', collapsed && 'px-0')}>
            <div className="px-2">
                <Button
                    type="button"
                    variant="ghost"
                    className={cn('w-full justify-start', collapsed && 'justify-center')}
                    onClick={() => setThemeMode(theme.isDark ? 'light' : 'dark')}
                >
                    {theme.isDark ? (
                        <Sun className="w-4 h-4" />
                    ) : (
                        <Moon className="w-4 h-4" />
                    )}
                    {!collapsed && <span className="ml-2">主题</span>}
                </Button>
            </div>
            <div className="px-2">
                <Button asChild variant="ghost" className={cn('w-full justify-start', collapsed && 'justify-center')}>
                    <Link href="/settings">
                        <Settings className="w-4 h-4" />
                        {!collapsed && <span className="ml-2">设置</span>}
                    </Link>
                </Button>
            </div>
        </div>
    );

    return (
        <Sidebar
            className={className}
            collapsed={collapsed}
            onCollapse={onCollapse}
            items={items}
            showCollapseButton={false}
            topSlot={TopSlot}
            bottomSlot={BottomSlot}
            width={width}
            collapsedWidth={collapsedWidth}
        />
    );
};

export default AppSidebar;


