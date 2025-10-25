'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Settings, Search as SearchIcon, Sun, Moon, Pin } from 'lucide-react';
import { Sidebar, type SidebarItem, sidebarItemVariants } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/search-input';
// import { AuthAvatar } from '@autolabz/oauth-sdk';
import { UserMenu } from '@/components/auth/UserMenu';
import { SessionList } from '@/features/session/ui/SessionList';
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
    /** 浮动模式：显示玻璃态与阴影，通常由 FloatingSidebarHost 托管 */
    floating?: boolean;
    /** 是否被图钉固定（由宿主控制） */
    pinned?: boolean;
    /** 切换图钉固定 */
    onTogglePin?: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
    collapsed,
    onCollapse,
    items,
    className,
    width = 210,
    collapsedWidth = 64,
    floating = false,
    pinned: _pinned = false,
    onTogglePin: _onTogglePin,
}) => {
    const router = useRouter();
    const pathname = usePathname();
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
            {/* 顶部行：左侧搜索入口，右侧仅在展开时显示图钉 */}
            <div className={cn('flex items-center gap-2 px-2', collapsed ? 'justify-center' : 'justify-between')}>
                <div className="flex items-center gap-2">
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
                </div>
                {!collapsed && floating && _onTogglePin && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 theme-pressable-flat"
                        onClick={_onTogglePin}
                        aria-label="固定侧边栏"
                        title="固定侧边栏"
                    >
                        <Pin className="h-4 w-4" />
                    </Button>
                )}
            </div>

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
            {/* 用户菜单迁移至底部常驻位 */}
            <div className="px-2">
                <UserMenu className={cn('h-10 w-10 justify-start', collapsed && 'justify-center')} expandDirection="top" align="start" />
            </div>
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

    const isActive = (path?: string) => {
        if (!path) return false;
        if (pathname === path) return true;
        if (path !== '/' && pathname.startsWith(path + '/')) return true;
        return false;
    };

    return (
        <Sidebar
            className={cn(
                className,
                floating && 'backdrop-blur-sm bg-background/60 dark:bg-neutral-950/50 shadow-lg border border-border/50 rounded-2xl'
            )}
            collapsed={collapsed}
            onCollapse={onCollapse}
            showCollapseButton={false}
            topSlot={TopSlot}
            bottomSlot={BottomSlot}
            width={width}
            collapsedWidth={collapsedWidth}
        >
            {/* 自定义滚动区域内容：导航 + 历史会话 */}
            <nav className="space-y-1">
                {items.map(item => (
                    <Button
                        key={item.key}
                        variant="ghost"
                        asChild
                        className={cn(
                            'theme-pressable-flat',
                            sidebarItemVariants({
                                variant: 'default',
                                state: isActive(item.path) ? 'active' : 'default',
                                level: 0
                            })
                        )}
                        style={{ paddingLeft: collapsed ? '12px' : '12px' }}
                    >
                        <Link href={item.path || '#'} className="w-full">
                            <div className="flex items-center justify-between w-full">
                                <div className="flex items-center flex-1 min-w-0">
                                    {item.icon && (
                                        <span className="flex-shrink-0 w-5 h-5 mr-3 text-muted-foreground">{item.icon}</span>
                                    )}
                                    {!collapsed && <span className="truncate">{item.label}</span>}
                                </div>
                            </div>
                        </Link>
                    </Button>
                ))}
            </nav>

            {/* 历史会话列表（折叠时隐藏，且不重复标题） */}
            <div className="mt-4">
                {!collapsed && (
                    <>
                        <SessionList />
                    </>
                )}
            </div>
        </Sidebar>
    );
};

export default AppSidebar;


