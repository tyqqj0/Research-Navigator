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
    /** 浮动遮罩是否激活（用于在激活时切换为不透明背景） */
    overlayActive?: boolean;
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
    overlayActive = false,
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
                {/* <div className="flex items-center gap-2">
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
                </div> */}
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
            {/* 用户菜单与昵称：折叠仅头像，展开显示昵称 */}
            <div className="px-2">
                <div className={cn('flex items-center', collapsed ? 'justify-center' : 'justify-start gap-3')}>
                    <div
                        style={{
                            width: collapsed ? 40 : 180,
                            minWidth: collapsed ? 40 : 180,
                            maxWidth: collapsed ? 40 : 180,
                            height: 40,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: collapsed ? 'center' : 'flex-start',
                            overflow: 'hidden',
                        }}
                    >
                        <UserMenu className="h-10 w-12 flex-shrink-0" expandDirection="top" align="start" />
                        {!collapsed && (
                            <span
                                className="text-sm text-foreground/80 truncate"
                                style={{
                                    marginLeft: 12,
                                    maxWidth: 120,
                                    flexGrow: 1,
                                }}
                            >
                                个人中心
                            </span>
                        )}
                    </div>
                </div>
            </div>
            <div className="px-2">
                <Button
                    type="button"
                    variant="ghost"
                    className={cn('w-full', collapsed ? 'justify-center px-0' : 'justify-start px-3')}
                    onClick={() => setThemeMode(theme.isDark ? 'light' : 'dark')}
                >
                    <span className={cn('flex-shrink-0 w-5 h-5 flex items-center justify-center', !collapsed && 'mr-3')}>
                        {theme.isDark ? (
                            <Sun className="w-4 h-4" />
                        ) : (
                            <Moon className="w-4 h-4" />
                        )}
                    </span>
                    {!collapsed && <span>主题</span>}
                </Button>
            </div>
            <div className="px-2">
                <Button asChild variant="ghost" className={cn('w-full', collapsed ? 'justify-center px-0' : 'justify-start px-3')}>
                    <Link href="/settings">
                        <span className={cn('flex-shrink-0 w-5 h-5 flex items-center justify-center', !collapsed && 'mr-3')}>
                            <Settings className="w-4 h-4" />
                        </span>
                        {!collapsed && <span>设置</span>}
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
        <div className="relative h-full">
            {/* 浮动图钉按钮 - 书签样式（不占位，不挤压内容） */}
            {!collapsed && floating && _onTogglePin && (
                <button
                    type="button"
                    onClick={_onTogglePin}
                    aria-label="固定侧边栏"
                    title="固定侧边栏"
                    className={cn(
                        'absolute -top-4 left-4 z-50',
                        'w-9 h-9 rounded-full',
                        'flex items-center justify-center',
                        'transition-transform duration-200',
                        'hover:scale-110 active:scale-95',
                        'theme-background-primary shadow-lg border border-border',
                        'hover:shadow-xl'
                    )}
                >
                    <Pin className={cn('h-4 w-4 transition-transform', _pinned && 'rotate-45')} />
                </button>
            )}
            <Sidebar
                className={cn(
                    className,
                    floating && (
                        overlayActive
                            // 遮罩激活时使用不透明背景，确保侧边栏内容清晰可见
                            ? 'theme-background-primary shadow-xl border border-border rounded-2xl'
                            : 'backdrop-blur-sm bg-background/60 dark:bg-neutral-900/50 shadow-lg border border-border/50 rounded-2xl'
                    )
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
                                collapsed ? 'justify-center px-0' : 'justify-start px-3',
                                sidebarItemVariants({
                                    variant: 'default',
                                    state: isActive(item.path) ? 'active' : 'default',
                                    level: 0
                                })
                            )}
                        >
                            <Link href={item.path || '#'} className="flex items-center w-full">
                                {item.icon && (
                                    <span className={cn('flex-shrink-0 w-5 h-5 flex items-center justify-center text-muted-foreground', !collapsed && 'mr-3')}>
                                        {item.icon}
                                    </span>
                                )}
                                {!collapsed && <span className="truncate">{item.label}</span>}
                            </Link>
                        </Button>
                    ))}
                </nav>

                {/* 历史会话列表（折叠时隐藏，且不重复标题） */}
                {!collapsed && (
                    <div className="mt-4">
                        <SessionList />
                    </div>
                )}
            </Sidebar>
        </div>
    );
};

export default AppSidebar;


