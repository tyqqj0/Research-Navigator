'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { SidebarProps, SidebarItem } from '@/types';

export const Sidebar: React.FC<SidebarProps> = ({
    collapsed = false,
    onCollapse,
    width = 280,
    theme = 'light',
    items,
    className
}) => {
    const pathname = usePathname();
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

    const toggleExpanded = (key: string) => {
        const newExpanded = new Set(expandedItems);
        if (newExpanded.has(key)) {
            newExpanded.delete(key);
        } else {
            newExpanded.add(key);
        }
        setExpandedItems(newExpanded);
    };

    const isActive = (item: SidebarItem) => {
        if (item.path) {
            return pathname === item.path;
        }
        return false;
    };

    const renderSidebarItem = (item: SidebarItem, level = 0) => {
        const hasChildren = item.children && item.children.length > 0;
        const isExpanded = expandedItems.has(item.key);
        const active = isActive(item);

        return (
            <div key={item.key} className="w-full">
                <div
                    className={cn(
                        'flex items-center justify-between w-full px-3 py-2 text-sm rounded-lg transition-colors',
                        'hover:bg-gray-100 dark:hover:bg-gray-800',
                        active && 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
                        item.disabled && 'opacity-50 cursor-not-allowed',
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700',
                        level > 0 && 'ml-4'
                    )}
                    style={{ paddingLeft: collapsed ? '12px' : `${12 + level * 16}px` }}
                >
                    {item.path && !hasChildren ? (
                        <Link href={item.path} className="flex items-center flex-1 min-w-0">
                            <div className="flex items-center flex-1 min-w-0">
                                {item.icon && (
                                    <span className="flex-shrink-0 w-5 h-5 mr-3">
                                        {item.icon}
                                    </span>
                                )}
                                {!collapsed && (
                                    <span className="truncate">{item.label}</span>
                                )}
                            </div>
                            {!collapsed && item.badge && (
                                <span className="ml-2 px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 rounded-full">
                                    {item.badge}
                                </span>
                            )}
                        </Link>
                    ) : (
                        <button
                            onClick={() => hasChildren && toggleExpanded(item.key)}
                            disabled={item.disabled}
                            className="flex items-center justify-between w-full text-left"
                        >
                            <div className="flex items-center flex-1 min-w-0">
                                {item.icon && (
                                    <span className="flex-shrink-0 w-5 h-5 mr-3">
                                        {item.icon}
                                    </span>
                                )}
                                {!collapsed && (
                                    <span className="truncate">{item.label}</span>
                                )}
                            </div>
                            {!collapsed && (
                                <div className="flex items-center space-x-2">
                                    {item.badge && (
                                        <span className="px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 rounded-full">
                                            {item.badge}
                                        </span>
                                    )}
                                    {hasChildren && (
                                        <svg
                                            className={cn(
                                                'w-4 h-4 transition-transform',
                                                isExpanded ? 'transform rotate-90' : ''
                                            )}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    )}
                                </div>
                            )}
                        </button>
                    )}
                </div>

                {/* 渲染子项 */}
                {hasChildren && isExpanded && !collapsed && (
                    <div className="mt-1">
                        {item.children?.map((child: SidebarItem) => renderSidebarItem(child, level + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <aside
            className={cn(
                'flex flex-col border-r border-gray-200 bg-white transition-all duration-300',
                theme === 'dark' && 'border-gray-700 bg-gray-900',
                className
            )}
            style={{ width: collapsed ? 64 : width }}
        >
            {/* 折叠按钮 */}
            {onCollapse && (
                <div className="flex justify-end p-2">
                    <button
                        onClick={() => onCollapse(!collapsed)}
                        className={cn(
                            'p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800',
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}
                    >
                        <svg
                            className={cn(
                                'w-4 h-4 transition-transform',
                                collapsed ? 'transform rotate-180' : ''
                            )}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                </div>
            )}

            {/* 导航项 */}
            <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
                {items?.map(item => renderSidebarItem(item))}
            </nav>
        </aside>
    );
};
