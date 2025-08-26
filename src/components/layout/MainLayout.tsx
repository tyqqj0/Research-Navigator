'use client';

import React, { useState, useEffect } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { cn } from '@/lib/utils';
import { LayoutProps, SidebarItem, MenuActionItem } from '@/types';

interface MainLayoutProps extends LayoutProps {
    sidebarItems?: SidebarItem[];
    showSidebar?: boolean;
    sidebarCollapsed?: boolean;
    onSidebarCollapse?: (collapsed: boolean) => void;
    headerTitle?: string;
    headerActions?: React.ReactNode;
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
    user,
    className
}) => {
    const [collapsed, setCollapsed] = useState(sidebarCollapsed);
    const [theme, setTheme] = useState<'light' | 'dark'>('light');

    useEffect(() => {
        // 检查系统主题偏好
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        setTheme(mediaQuery.matches ? 'dark' : 'light');

        const handleChange = (e: MediaQueryListEvent) => {
            setTheme(e.matches ? 'dark' : 'light');
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

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
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v0M8 5a2 2 0 012-2h4a2 2 0 012 2v0" />
                </svg>
            ),
            path: '/'
        },
        {
            key: 'research',
            label: '研究',
            icon: (
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            ),
            children: [
                {
                    key: 'search',
                    label: '文献搜索',
                    path: '/research/search'
                },
                {
                    key: 'analysis',
                    label: '趋势分析',
                    path: '/research/analysis'
                },
                {
                    key: 'discovery',
                    label: '发现洞察',
                    path: '/research/discovery'
                }
            ]
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
                    key: 'collections',
                    label: '收藏夹',
                    path: '/literature/collections'
                },
                {
                    key: 'notes',
                    label: '笔记',
                    path: '/literature/notes'
                },
                {
                    key: 'citations',
                    label: '引用管理',
                    path: '/literature/citations'
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
            key: 'visualization',
            label: '数据可视化',
            icon: (
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
            ),
            children: [
                {
                    key: 'charts',
                    label: '图表分析',
                    path: '/visualization/charts'
                },
                {
                    key: 'networks',
                    label: '网络图',
                    path: '/visualization/networks'
                },
                {
                    key: 'timeline',
                    label: '时间线',
                    path: '/visualization/timeline'
                }
            ]
        },
        {
            key: 'chat',
            label: 'AI 助手',
            icon: (
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
            ),
            path: '/chat'
        },
        {
            key: 'settings',
            label: '设置',
            icon: (
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            ),
            children: [
                {
                    key: 'profile',
                    label: '个人资料',
                    path: '/settings/profile'
                },
                {
                    key: 'preferences',
                    label: '偏好设置',
                    path: '/settings/preferences'
                },
                {
                    key: 'integrations',
                    label: '集成设置',
                    path: '/settings/integrations'
                }
            ]
        }
    ];

    const activeSidebarItems = sidebarItems.length > 0 ? sidebarItems : defaultSidebarItems;

    return (
        <div className={cn(
            'flex h-screen bg-gray-50 dark:bg-gray-900',
            className
        )}>
            {/* 侧边栏 */}
            {showSidebar && (
                <Sidebar
                    collapsed={collapsed}
                    onCollapse={handleSidebarCollapse}
                    theme={theme}
                    items={activeSidebarItems}
                />
            )}

            {/* 主内容区域 */}
            <div className="flex flex-col flex-1 min-w-0">
                {/* 头部 */}
                <Header
                    title={headerTitle}
                    actions={headerActions}
                    user={user}
                    theme={theme}
                />

                {/* 主要内容 */}
                <main className="flex-1 overflow-auto">
                    <div className="h-full">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};
