'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cva, type VariantProps } from 'class-variance-authority';

// ========== 类型定义 ==========
export interface SidebarItem {
    key: string;
    label: string;
    icon?: React.ReactNode;
    path?: string;
    children?: SidebarItem[];
    disabled?: boolean;
    badge?: string | number;
}

// ========== 样式变体定义 ==========
const sidebarVariants = cva(
    // 基础样式 - 使用CSS变量
    "flex flex-col transition-all duration-300 border-r bg-background border-border",
    {
        variants: {
            variant: {
                default: "",
                elevated: "shadow-md",
                ghost: "border-r-0"
            },
            size: {
                default: "",
                compact: "",
                wide: ""
            }
        },
        defaultVariants: {
            variant: "default",
            size: "default"
        }
    }
);

const sidebarItemVariants = cva(
    // 基础样式 - 使用CSS变量和语义化类名
    "w-full justify-start px-3 py-2 h-auto font-normal transition-colors",
    {
        variants: {
            variant: {
                default: "hover:bg-accent hover:text-accent-foreground",
                ghost: "hover:bg-accent/50",
                subtle: "hover:bg-muted"
            },
            state: {
                default: "text-muted-foreground",
                active: "bg-accent text-accent-foreground font-medium",
                disabled: "opacity-50 cursor-not-allowed"
            },
            level: {
                0: "",
                1: "ml-4",
                2: "ml-8",
                3: "ml-12"
            }
        },
        defaultVariants: {
            variant: "default",
            state: "default",
            level: 0
        }
    }
);

const collapseButtonVariants = cva(
    "h-8 w-8 text-muted-foreground hover:text-foreground transition-colors",
    {
        variants: {
            position: {
                end: "",
                start: ""
            }
        },
        defaultVariants: {
            position: "end"
        }
    }
);

// ========== 组件属性接口 ==========
export interface SidebarProps extends VariantProps<typeof sidebarVariants> {
    collapsed?: boolean;
    onCollapse?: (collapsed: boolean) => void;
    width?: number;
    collapsedWidth?: number;
    items?: SidebarItem[];
    className?: string;
    children?: React.ReactNode;
    showCollapseButton?: boolean;
    collapseButtonPosition?: 'start' | 'end';
    // Custom slots rendered above and below the navigation list
    topSlot?: React.ReactNode;
    bottomSlot?: React.ReactNode;
}

// ========== 主组件 ==========
export const Sidebar = React.forwardRef<HTMLElement, SidebarProps>(
    ({
        collapsed = false,
        onCollapse,
        width = 280,
        collapsedWidth = 64,
        items = [],
        className,
        children,
        variant,
        size,
        showCollapseButton = true,
        collapseButtonPosition = 'end',
        topSlot,
        bottomSlot,
        ...props
    }, ref) => {
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

        const isActive = (item: SidebarItem): boolean => {
            if (!item.path) return false;
            if (pathname === item.path) return true;
            // Treat nested routes as active for their parent path, except root
            if (item.path !== '/' && pathname.startsWith(item.path + '/')) return true;
            return false;
        };

        const getItemLevel = (level: number): 0 | 1 | 2 | 3 => {
            return Math.min(level, 3) as 0 | 1 | 2 | 3;
        };

        // ========== 渲染侧边栏项目 ==========
        const renderSidebarItem = (item: SidebarItem, level = 0): React.ReactNode => {
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
                                    'theme-pressable-flat',
                                    sidebarItemVariants({
                                        variant: "default",
                                        state: active ? "active" : item.disabled ? "disabled" : "default",
                                        level: getItemLevel(level)
                                    })
                                )}
                                style={{
                                    paddingLeft: collapsed ? '12px' : `${12 + level * 16}px`
                                }}
                            >
                                <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center flex-1 min-w-0">
                                        {item.icon && (
                                            <span className="flex-shrink-0 w-5 h-5 mr-3 text-muted-foreground">
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
                                                    'h-4 w-4 transition-transform text-muted-foreground',
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
                        'theme-pressable-flat',
                        sidebarItemVariants({
                            variant: "default",
                            state: active ? "active" : item.disabled ? "disabled" : "default",
                            level: getItemLevel(level)
                        })
                    )}
                    style={{
                        paddingLeft: collapsed ? '12px' : `${12 + level * 16}px`
                    }}
                >
                    <Link href={item.path || '#'} className="w-full">
                        <div className="flex items-center justify-between w-full">
                            <div className="flex items-center flex-1 min-w-0">
                                {item.icon && (
                                    <span className="flex-shrink-0 w-5 h-5 mr-3 text-muted-foreground">
                                        {item.icon}
                                    </span>
                                )}
                                {!collapsed && (
                                    <span className="truncate">{item.label}</span>
                                )}
                            </div>
                            {!collapsed && item.badge && (
                                <Badge variant="secondary" className="ml-2 text-xs">
                                    {item.badge}
                                </Badge>
                            )}
                        </div>
                    </Link>
                </Button>
            );
        };

        // ========== 折叠按钮渲染 ==========
        const renderCollapseButton = () => {
            if (!showCollapseButton || !onCollapse) return null;

            return (
                <div className={cn(
                    "flex p-2",
                    collapseButtonPosition === 'start' ? 'justify-start' : 'justify-end'
                )}>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onCollapse(!collapsed)}
                        className={cn('theme-pressable-flat', collapseButtonVariants({ position: collapseButtonPosition }))}
                    >
                        {collapsed ? (
                            <ChevronRight className="h-4 w-4" />
                        ) : (
                            <ChevronLeft className="h-4 w-4" />
                        )}
                    </Button>
                </div>
            );
        };

        return (
            <aside
                ref={ref}
                className={cn(sidebarVariants({ variant, size }), className)}
                style={{ width: collapsed ? collapsedWidth : width }}
                {...props}
            >
                {/* 顶部区域（不随内容滚动） */}
                {(topSlot || showCollapseButton) && (
                    <div className="px-2 pt-2">
                        {topSlot || renderCollapseButton()}
                    </div>
                )}

                {/* 导航项（可滚动） */}
                <ScrollArea className="flex-1 px-2 py-3">
                    {children ? (
                        children
                    ) : (
                        <nav className="space-y-1">
                            {items.map(item => renderSidebarItem(item))}
                        </nav>
                    )}
                </ScrollArea>

                {/* 底部区域固定在最底部 */}
                {bottomSlot && (
                    <div className="px-2 pb-2">
                        {bottomSlot}
                    </div>
                )}
            </aside>
        );
    }
);

Sidebar.displayName = "Sidebar";

// ========== 导出组件和类型 ==========
export { sidebarVariants, sidebarItemVariants, collapseButtonVariants };
// export type { SidebarItem };
