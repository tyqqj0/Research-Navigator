'use client';

import React, { useState } from 'react';
import { Header } from './Header';
import { type SidebarItem } from '@/components/ui';
import { cn } from '@/lib/utils';
import { LayoutProps, MenuActionItem } from '@/types';
import { Home } from 'lucide-react';
import { AppSidebar } from './AppSidebar';

interface MainLayoutProps extends LayoutProps {
    sidebarItems?: SidebarItem[];
    showSidebar?: boolean;
    sidebarCollapsed?: boolean;
    onSidebarCollapse?: (collapsed: boolean) => void;
    headerTitle?: string;
    headerActions?: React.ReactNode;
    showHeader?: boolean;
    pageHeader?: React.ReactNode;
    user?: {
        name: string;
        avatar?: string;
        menu?: MenuActionItem[];
    };
}

export const MainLayout: React.FC<MainLayoutProps> = ({
    children,
    sidebarItems = [],
    showSidebar = true,
    sidebarCollapsed = false,
    onSidebarCollapse,
    headerTitle,
    headerActions,
    showHeader = true,
    pageHeader,
    user,
    className
}) => {
    const [collapsed, setCollapsed] = useState(sidebarCollapsed);

    const handleSidebarCollapse = (newCollapsed: boolean) => {
        setCollapsed(newCollapsed);
        onSidebarCollapse?.(newCollapsed);
    };

    // 默认侧边栏项目
    const defaultSidebarItems: SidebarItem[] = [
        {
            key: 'dashboard',
            label: '仪表板',
            icon: (
                <Home className="w-5 h-5" />
            ),
            path: '/'
        },
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
            key: 'literature',
            label: '文献管理',
            icon: (
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
            ),
            children: [
                {
                    key: 'library',
                    label: '我的文库',
                    path: '/literature/library'
                },
                {
                    key: 'discovery',
                    label: '文献发现',
                    path: '/literature/discovery'
                },
                {
                    key: 'collections',
                    label: '收藏夹',
                    path: '/literature/collections'
                },
                {
                    key: 'notes',
                    label: '笔记',
                    path: '/literature/notes'
                }
            ]
        },
        {
            key: 'projects',
            label: '研究项目',
            icon: (
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
            ),
            children: [
                {
                    key: 'my-projects',
                    label: '我的项目',
                    path: '/projects/my'
                },
                {
                    key: 'shared-projects',
                    label: '共享项目',
                    path: '/projects/shared'
                },
                {
                    key: 'templates',
                    label: '项目模板',
                    path: '/projects/templates'
                }
            ]
        },
        {
            key: 'data',
            label: '数据管理',
            icon: (
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h3m10-12v10a2 2 0 01-2 2h-3M7 7V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10M7 17h10" />
                </svg>
            ),
            children: [
                {
                    key: 'graphs',
                    label: '文献图谱',
                    path: '/data/graphs'
                }
            ]
        }
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
                        user={user}
                    />
                ) : (
                    <div className="md:hidden">
                        <Header
                            title={headerTitle}
                            actions={headerActions}
                            user={user}
                        />
                    </div>
                )}

                {/* 主要内容 */}
                <main className="flex-1 overflow-auto">
                    {pageHeader && (
                        <div className="border-b bg-background">
                            {pageHeader}
                        </div>
                    )}
                    <div className="h-full">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};
