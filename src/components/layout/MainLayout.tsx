'use client';

import React, { useState } from 'react';
import { Header } from './Header';
import { type SidebarItem } from '@/components/ui';
import { cn } from '@/lib/utils';
import { LayoutProps, MenuActionItem } from '@/types';
import { Home } from 'lucide-react';
import { AppSidebar } from './AppSidebar';
import { navigationUIConfig } from '@/config/ui/navigation.config';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { usePathname } from 'next/navigation';

interface MainLayoutProps extends LayoutProps {
    sidebarItems?: SidebarItem[];
    showSidebar?: boolean;
    sidebarCollapsed?: boolean;
    onSidebarCollapse?: (collapsed: boolean) => void;
    headerTitle?: string;
    headerActions?: React.ReactNode;
    headerRightContent?: React.ReactNode;
    showHeader?: boolean;
    pageHeader?: React.ReactNode;
    user?: {
        name: string;
        avatar?: string;
        menu?: MenuActionItem[];
    };
    hideUserInfo?: boolean;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
    children,
    sidebarItems = [],
    showSidebar = true,
    sidebarCollapsed = false,
    onSidebarCollapse,
    headerTitle,
    headerActions,
    headerRightContent,
    showHeader = true,
    pageHeader,
    user,
    hideUserInfo,
    className
}) => {
    const [collapsed, setCollapsed] = useState(sidebarCollapsed);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const pathname = usePathname();

    // Floating sidebar host state
    const [pinned, setPinned] = useState<boolean>(false);
    const [hoverOpen, setHoverOpen] = useState<boolean>(false);
    const openTimerRef = React.useRef<number | null>(null);
    const closeTimerRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        try {
            const v = localStorage.getItem('ui:sidebar:pinned');
            if (v !== null) {
                setPinned(v === '1');
            } else {
                setPinned(navigationUIConfig.defaultPinned);
                localStorage.setItem('ui:sidebar:pinned', navigationUIConfig.defaultPinned ? '1' : '0');
            }
        } catch { /* noop */ }
    }, []);
    const togglePin = React.useCallback(() => {
        setPinned(prev => {
            const next = !prev;
            try { localStorage.setItem('ui:sidebar:pinned', next ? '1' : '0'); } catch { /* noop */ }
            return next;
        });
    }, []);

    const handleSidebarCollapse = (newCollapsed: boolean) => {
        setCollapsed(newCollapsed);
        onSidebarCollapse?.(newCollapsed);
    };

    // 默认侧边栏项目（按“研究 → 文库 → 图谱 → 仪表盘 → 文献发现 → 其他（笔记）”排列）
    const defaultSidebarItems: SidebarItem[] = [
        {
            key: 'research',
            label: '研究',
            icon: (
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
            ),
            path: '/research'
        },
        {
            key: 'library',
            label: '我的文库',
            icon: (
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
            ),
            path: '/literature/library'
        },
        {
            key: 'graphs',
            label: '文献图谱',
            icon: (
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h3m10-12v10a2 2 0 01-2 2h-3M7 7V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10M7 17h10" />
                </svg>
            ),
            path: '/data/graphs'
        },
        // {
        //     key: 'dashboard',
        //     label: '仪表板',
        //     icon: (
        //         <Home className="w-5 h-5" />
        //     ),
        //     path: '/dashboard'
        // },
        {
            key: 'discovery',
            label: '文献发现',
            icon: (
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
            ),
            path: '/literature/discovery'
        },
        // {
        //     key: 'notes',
        //     label: '笔记',
        //     icon: (
        //         <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
        //             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        //         </svg>
        //     ),
        //     path: '/literature/notes'
        // }
    ];

    const activeSidebarItems = sidebarItems.length > 0 ? sidebarItems : defaultSidebarItems;
    const effectiveHideUserInfo = hideUserInfo ?? !navigationUIConfig.headerShowUser;

    // Hover intent handlers for floating sidebar
    const beginOpenWithDelay = React.useCallback(() => {
        if (pinned) return;
        if (closeTimerRef.current) { window.clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
        if (openTimerRef.current) { window.clearTimeout(openTimerRef.current); }
        openTimerRef.current = window.setTimeout(() => setHoverOpen(true), navigationUIConfig.hoverOpenDelayMs) as unknown as number;
    }, [pinned]);
    const closeWithDelay = React.useCallback(() => {
        if (pinned) return;
        if (openTimerRef.current) { window.clearTimeout(openTimerRef.current); openTimerRef.current = null; }
        if (closeTimerRef.current) { window.clearTimeout(closeTimerRef.current); }
        closeTimerRef.current = window.setTimeout(() => setHoverOpen(false), navigationUIConfig.hoverCloseDelayMs) as unknown as number;
    }, [pinned]);

    const isOverlayActive = showSidebar && !pinned && hoverOpen;
    // 侧边栏宽度（含与内容之间的间距 12px）；用于桌面端内容左偏移
    const currentSidebarLeftOffset = showSidebar ? ((pinned ? navigationUIConfig.panelWidth : navigationUIConfig.railWidth) + 12) : 0;
    // 遮罩从屏幕最左边开始，覆盖整个屏幕（侧边栏 z-50 会浮在上面）
    const overlayLeftOffset = 0;
    const isResearchRoot = pathname === '/research';

    return (
        <div
            className={cn('relative h-screen theme-background-primary', className)}
            style={{
                // 仅作为 CSS 变量提供给 md+ 断点下的内容容器使用
                // 移动端不直接使用该变量（由类名控制为 0）
                // 注意：不在此处直接设置 marginLeft，避免影响遮罩定位
                ['--content-left-offset' as any]: `${currentSidebarLeftOffset}px`
            }}
        >
            {/* Floating sidebar host (desktop) */}
            {showSidebar && (
                <>
                    {/* Sidebar panel (always render; toggles between rail and panel) */}
                    <div
                        className="hidden md:block fixed left-3 z-50"
                        onMouseEnter={beginOpenWithDelay}
                        onMouseLeave={closeWithDelay}
                        style={{
                            top: navigationUIConfig.floatingMarginY,
                            bottom: navigationUIConfig.floatingMarginY
                        }}
                    >
                        <AppSidebar
                            className="h-full"
                            collapsed={!pinned && !hoverOpen}
                            onCollapse={handleSidebarCollapse}
                            items={activeSidebarItems}
                            width={navigationUIConfig.panelWidth}
                            collapsedWidth={navigationUIConfig.railWidth}
                            floating
                            pinned={pinned}
                            onTogglePin={navigationUIConfig.allowPin ? togglePin : undefined}
                            overlayActive={isOverlayActive}
                        />
                    </div>

                    {/* Overlay dimmer - 从侧边栏右边缘开始覆盖整个右侧区域 */}
                    {isOverlayActive && (
                        <div
                            className="hidden md:block fixed z-40"
                            style={{
                                top: 0,
                                right: 0,
                                bottom: 0,
                                left: overlayLeftOffset,
                                // 使用主题感知的柔和遮罩：与背景色做混合
                                background: `color-mix(in srgb, var(--color-background-inverse) ${Math.round(navigationUIConfig.overlayAlpha * 100)}%, transparent)`
                            }}
                            onClick={() => setHoverOpen(false)}
                            aria-hidden
                        />
                    )}
                </>
            )}

            {/* Content wrapper (blur/offset) */}
            <div
                className={cn('flex flex-col min-w-0 theme-text h-full', 'md:ml-[var(--content-left-offset)]')}
                style={{
                    // 保留轻微模糊提升焦点层级，但移除整体透明度降低，避免双重变暗
                    filter: isOverlayActive ? `blur(${navigationUIConfig.blurRadius}px)` : undefined,
                    transition: 'margin-left 200ms ease, filter 150ms ease'
                }}
            >
                {/* Header：移动端始终显示，桌面端可按场景显示 */}
                <div className="md:hidden">
                    <Header
                        title={headerTitle}
                        actions={headerActions}
                        rightContent={headerRightContent}
                        user={user}
                        hideUserInfo={effectiveHideUserInfo}
                        onOpenSidebar={showSidebar ? () => setMobileSidebarOpen(true) : undefined}
                        variant={isResearchRoot ? 'transparent' : 'default'}
                    />
                </div>
                {isResearchRoot ? (
                    <div className="hidden md:block">
                        <Header
                            title={headerTitle}
                            actions={headerActions}
                            rightContent={headerRightContent}
                            user={user}
                            hideUserInfo={effectiveHideUserInfo}
                            onOpenSidebar={showSidebar ? () => setMobileSidebarOpen(true) : undefined}
                            variant="transparent"
                        />
                    </div>
                ) : null}

                {/* Main content */}
                <main className="flex-1 min-h-0 flex flex-col">
                    {pageHeader && (
                        <div className="shrink-0 border-b border-border bg-background">
                            {pageHeader}
                        </div>
                    )}
                    <div className="min-h-0 flex-1 overflow-auto">
                        <div className="h-full">
                            {children}
                        </div>
                    </div>
                </main>
            </div>

            {/* Mobile overlay sidebar (unchanged) */}
            {showSidebar && (
                <Dialog open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
                    <DialogContent className="md:hidden left-0 top-0 translate-x-0 translate-y-0 w-[280px] max-w-none h-screen p-0 rounded-none border-0 shadow-xl">
                        <DialogTitle className="sr-only">移动端导航</DialogTitle>
                        <DialogDescription className="sr-only">应用的侧边栏导航</DialogDescription>
                        <AppSidebar
                            className="h-full"
                            collapsed={false}
                            onCollapse={() => { /* no-op in mobile overlay */ }}
                            items={activeSidebarItems}
                        />
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
};
