'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SidebarProps, SidebarItem } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

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

        if (hasChildren) {
            return (
                <Collapsible
                    key={item.key}
                    open={isExpanded}
                    onOpenChange={() => toggleExpanded(item.key)}
                    className="w-full"
                >
                    <CollapsibleTrigger asChild>
                        <Button
                            variant="ghost"
                            disabled={item.disabled}
                            className={cn(
                                'w-full justify-start px-3 py-2 h-auto font-normal',
                                'hover:bg-gray-100 dark:hover:bg-gray-800',
                                active && 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
                                item.disabled && 'opacity-50 cursor-not-allowed',
                                theme === 'dark' ? 'text-gray-300' : 'text-gray-700',
                                level > 0 && 'ml-4'
                            )}
                            style={{ paddingLeft: collapsed ? '12px' : `${12 + level * 16}px` }}
                        >
                            <div className="flex items-center justify-between w-full">
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
                                            <Badge variant="secondary" className="text-xs">
                                                {item.badge}
                                            </Badge>
                                        )}
                                        <ChevronRight
                                            className={cn(
                                                'h-4 w-4 transition-transform',
                                                isExpanded && 'transform rotate-90'
                                            )}
                                        />
                                    </div>
                                )}
                            </div>
                        </Button>
                    </CollapsibleTrigger>
                    {!collapsed && (
                        <CollapsibleContent className="mt-1">
                            <div className="space-y-1">
                                {item.children?.map((child: SidebarItem) =>
                                    renderSidebarItem(child, level + 1)
                                )}
                            </div>
                        </CollapsibleContent>
                    )}
                </Collapsible>
            );
        }

        // 简单链接项目
        return (
            <Button
                key={item.key}
                variant="ghost"
                asChild
                disabled={item.disabled}
                className={cn(
                    'w-full justify-start px-3 py-2 h-auto font-normal',
                    'hover:bg-gray-100 dark:hover:bg-gray-800',
                    active && 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
                    item.disabled && 'opacity-50 cursor-not-allowed',
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700',
                    level > 0 && 'ml-4'
                )}
                style={{ paddingLeft: collapsed ? '12px' : `${12 + level * 16}px` }}
            >
                <Link href={item.path || '#'} className="flex items-center flex-1 min-w-0">
                    {item.icon && (
                        <span className="flex-shrink-0 w-5 h-5 mr-3">
                            {item.icon}
                        </span>
                    )}
                    {!collapsed && (
                        <span className="truncate">{item.label}</span>
                    )}
                    {!collapsed && item.badge && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                            {item.badge}
                        </Badge>
                    )}
                </Link>
            </Button>
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
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onCollapse(!collapsed)}
                        className={cn(
                            'h-8 w-8',
                            theme === 'dark' ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-900'
                        )}
                    >
                        {collapsed ? (
                            <ChevronRight className="h-4 w-4" />
                        ) : (
                            <ChevronLeft className="h-4 w-4" />
                        )}
                    </Button>
                </div>
            )}

            {/* 导航项 */}
            <ScrollArea className="flex-1 px-2 py-4">
                <nav className="space-y-1">
                    {items?.map(item => renderSidebarItem(item))}
                </nav>
            </ScrollArea>
        </aside>
    );
};
