'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Settings, ChevronDown, ChevronLeft, ChevronRight, Search as SearchIcon, Sun, Moon } from 'lucide-react';
import { Sidebar, type SidebarItem } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/search-input';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
// import { QuickThemeToggle } from '@/components/ui/theme-mode-toggle';
import { useTheme } from '@/providers';
import useAuthStore from '@/stores/auth.store';
import { authApi } from '@/lib/auth/auth-api';
import { cn } from '@/lib/utils';

interface AppSidebarProps {
    collapsed: boolean;
    onCollapse?: (collapsed: boolean) => void;
    items: SidebarItem[];
    className?: string;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
    collapsed,
    onCollapse,
    items,
    className
}) => {
    const router = useRouter();
    const [query, setQuery] = React.useState('');
    const [showSearch, setShowSearch] = React.useState(false);
    const { theme, setThemeMode } = useTheme();

    const authUser = useAuthStore((s) => s.currentUser);
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const logoutStore = useAuthStore((s) => s.logout);

    const displayUser = isAuthenticated && authUser
        ? { name: authUser.name, avatar: authUser.avatar }
        : undefined;

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = query.trim();
        if (!trimmed) return;
        // 全局搜索：跳转到文献发现页并携带查询
        router.push(`/literature/discovery?q=${encodeURIComponent(trimmed)}`);
        setQuery('');
    };

    const handleLogout = async () => {
        try {
            await authApi.logout();
        } catch { }
        logoutStore();
        router.push('/login');
    };

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
                {/* 用户下拉 */}
                {!collapsed && displayUser && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className={cn('h-9 px-2 theme-pressable-flat', collapsed ? 'w-9 justify-center' : 'justify-start')}
                            >
                                {displayUser.avatar ? (
                                    <Image
                                        src={displayUser.avatar}
                                        alt={displayUser.name}
                                        width={28}
                                        height={28}
                                        className="h-7 w-7 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-medium theme-icon-blue">
                                        {displayUser.name.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                {!collapsed && (
                                    <>
                                        <span className="ml-2 text-sm truncate max-w-[100px]">{displayUser.name}</span>
                                        <ChevronDown className="ml-1 h-4 w-4" />
                                    </>
                                )}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56">
                            <DropdownMenuItem asChild>
                                <Link href="/settings/profile">个人资料</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link href="/projects/my">我的项目</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem>使用帮助</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                                <Link href="/settings">设置</Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600" onClick={handleLogout}>
                                退出登录
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
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

                {/* 折叠按钮 */}
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn('h-9 w-9 theme-pressable-flat', !collapsed && 'ml-auto')}
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
        />
    );
};

export default AppSidebar;


