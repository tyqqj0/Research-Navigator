'use client';

import React, { useState } from 'react';
import { Header } from './Header';
import { type SidebarItem } from '@/components/ui';
import { cn } from '@/lib/utils';
import { LayoutProps, MenuActionItem } from '@/types';
import { Home } from 'lucide-react';
import { AppSidebar } from './AppSidebar';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

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
        {
            key: 'dashboard',
            label: '仪表板',
            icon: (
                <Home className="w-5 h-5" />
            ),
            path: '/dashboard'
        },
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

    return (
        <div className={cn(
            'flex h-screen theme-background-primary',
            className
        )}>
            {/* 侧边栏 */}
            {showSidebar && (
                <AppSidebar
                    className="hidden md:flex"
                    collapsed={collapsed}
                    onCollapse={handleSidebarCollapse}
                    items={activeSidebarItems}
                />
            )}

            {/* 主内容区域 */}
            <div className="flex flex-col flex-1 min-w-0 theme-text">
                {/* 头部：桌面可隐藏，移动端保留极简顶栏 */}
                {showHeader ? (
                    <Header
                        title={headerTitle}
                        actions={headerActions}
                        rightContent={headerRightContent}
                        user={user}
                        hideUserInfo={hideUserInfo}
                        onOpenSidebar={showSidebar ? () => setMobileSidebarOpen(true) : undefined}
                    />
                ) : (
                    <div className="md:hidden">
                        <Header
                            title={headerTitle}
                            actions={headerActions}
                            rightContent={headerRightContent}
                            user={user}
                            hideUserInfo={hideUserInfo}
                            onOpenSidebar={showSidebar ? () => setMobileSidebarOpen(true) : undefined}
                        />
                    </div>
                )}

                {/* 主要内容 */}
                <main className="flex-1 min-h-0 flex flex-col">
                    {pageHeader && (
                        <div className="shrink-0 border-b border-border bg-background">
                            {pageHeader}
                        </div>
                    )}
                    {/* 仅内容区域滚动，避免顶部边条引起整页1px滚动 */}
                    <div className="min-h-0 flex-1 overflow-auto">
                        <div className="h-full">
                            {children}
                        </div>
                    </div>
                </main>
            </div>

            {/* 移动端覆盖式侧栏 */}
            {showSidebar && (
                <Dialog open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
                    <DialogContent className="md:hidden left-0 top-0 translate-x-0 translate-y-0 w-[280px] max-w-none h-screen p-0 rounded-none border-0 shadow-xl">
                        {/* 无障碍：提供隐藏的标题与描述，消除 Radix 警告 */}
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
