'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, LogOut, User, HelpCircle, FolderOpen, ChevronRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export interface UserMenuAction {
    label: string;
    icon?: React.ReactNode;
    onClick?: () => void;
    href?: string;
    variant?: 'default' | 'danger';
}

export interface ExpandableUserMenuProps {
    user: {
        name: string;
        email?: string;
        avatar?: string;
    };
    actions?: UserMenuAction[];
    onLogout?: () => void;
    className?: string;
    /**
     * 展开方向：'bottom' | 'top' | 'left' | 'right'
     * 默认 'bottom'（向下展开）
     */
    expandDirection?: 'bottom' | 'top' | 'left' | 'right';
    /**
     * 对齐方式
     */
    align?: 'start' | 'center' | 'end';
}

/**
 * 扩展式用户菜单组件
 * 
 * 特点：
 * - 默认只显示圆形头像
 * - 点击后平滑扩展为卡片
 * - 支持自定义菜单项
 * - 流畅的动画效果
 */
export const ExpandableUserMenu: React.FC<ExpandableUserMenuProps> = ({
    user,
    actions = [],
    onLogout,
    className,
    expandDirection = 'bottom',
    align = 'end',
}) => {
    const [isOpen, setIsOpen] = useState(false);

    // 默认菜单项
    const defaultActions: UserMenuAction[] = [
        // { label: '个人资料', icon: <User className="w-4 h-4" />, href: '/settings/profile' },
        // { label: '我的项目', icon: <FolderOpen className="w-4 h-4" />, href: '/projects/my' },
        // { label: '使用帮助', icon: <HelpCircle className="w-4 h-4" />, onClick: () => console.log('Help') },
    ];

    const menuActions = actions.length > 0 ? actions : defaultActions;

    // 用户名首字母（用于头像占位符）
    const userInitial = user.name.charAt(0).toUpperCase();

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    className={cn(
                        'relative h-10 w-12 rounded-full p-0 overflow-hidden',
                        'theme-pressable-flat transition-all duration-200',
                        'hover:ring-2 hover:ring-primary/20',
                        className
                    )}
                    aria-label="用户菜单"
                >
                    {user.avatar ? (
                        <Image
                            src={user.avatar}
                            alt={user.name}
                            width={40}
                            height={40}
                            className="h-full w-full object-cover rounded-full"
                        />
                    ) : (
                        <div className="h-full w-full flex items-center justify-center text-white text-sm font-semibold theme-icon-blue rounded-full">
                            {userInitial}
                        </div>
                    )}
                </Button>
            </PopoverTrigger>

            <PopoverContent
                align={align}
                side={expandDirection}
                sideOffset={8}
                className="w-72 p-0 overflow-hidden"
                asChild
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                >
                    {/* 用户信息头部 */}
                    <div className="p-4 bg-gradient-to-br from-primary/5 to-primary/10">
                        <div className="flex items-center gap-3">
                            {/* 头像 */}
                            <div className="relative flex-shrink-0">
                                {user.avatar ? (
                                    <Image
                                        src={user.avatar}
                                        alt={user.name}
                                        width={48}
                                        height={48}
                                        className="h-12 w-12 rounded-full object-cover ring-2 ring-white/50"
                                    />
                                ) : (
                                    <div className="h-12 w-12 rounded-full flex items-center justify-center text-white text-lg font-semibold theme-icon-blue ring-2 ring-white/50">
                                        {userInitial}
                                    </div>
                                )}
                            </div>

                            {/* 用户信息 */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate">
                                    {user.name}
                                </p>
                                {user.email && (
                                    <p className="text-xs text-muted-foreground truncate">
                                        {user.email}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* 菜单项 */}
                    <div className="p-1">
                        {menuActions.map((action, index) => (
                            <React.Fragment key={index}>
                                {action.href ? (
                                    <Link href={action.href} className="block">
                                        <motion.button
                                            whileHover={{ backgroundColor: 'rgba(0, 0, 0, 0.03)' }}
                                            whileTap={{ scale: 0.98 }}
                                            className={cn(
                                                'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm',
                                                'transition-colors',
                                                'text-foreground hover:bg-accent',
                                                action.variant === 'danger' && 'text-destructive hover:bg-destructive/10'
                                            )}
                                            onClick={() => {
                                                action.onClick?.();
                                                setIsOpen(false);
                                            }}
                                        >
                                            {action.icon && (
                                                <span className="flex-shrink-0">
                                                    {action.icon}
                                                </span>
                                            )}
                                            <span className="flex-1 text-left">{action.label}</span>
                                            <ChevronRight className="w-3 h-3 opacity-40" />
                                        </motion.button>
                                    </Link>
                                ) : (
                                    <motion.button
                                        whileHover={{ backgroundColor: 'rgba(0, 0, 0, 0.03)' }}
                                        whileTap={{ scale: 0.98 }}
                                        className={cn(
                                            'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm',
                                            'transition-colors',
                                            'text-foreground hover:bg-accent',
                                            action.variant === 'danger' && 'text-destructive hover:bg-destructive/10'
                                        )}
                                        onClick={() => {
                                            action.onClick?.();
                                            setIsOpen(false);
                                        }}
                                    >
                                        {action.icon && (
                                            <span className="flex-shrink-0">
                                                {action.icon}
                                            </span>
                                        )}
                                        <span className="flex-1 text-left">{action.label}</span>
                                    </motion.button>
                                )}
                            </React.Fragment>
                        ))}
                    </div>

                    {/* 设置和退出 */}
                    {onLogout && (
                        <>
                            <Separator />
                            <div className="p-1">
                                <Link href="/settings" className="block">
                                    <motion.button
                                        whileHover={{ backgroundColor: 'rgba(0, 0, 0, 0.03)' }}
                                        whileTap={{ scale: 0.98 }}
                                        className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-foreground hover:bg-accent"
                                        onClick={() => setIsOpen(false)}
                                    >
                                        <Settings className="w-4 h-4" />
                                        <span className="flex-1 text-left">设置</span>
                                    </motion.button>
                                </Link>
                                <Separator className="my-1" />
                                <motion.button
                                    whileHover={{ backgroundColor: 'rgba(239, 68, 68, 0.05)' }}
                                    whileTap={{ scale: 0.98 }}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-destructive hover:bg-destructive/10"
                                    onClick={() => {
                                        onLogout();
                                        setIsOpen(false);
                                    }}
                                >
                                    <LogOut className="w-4 h-4" />
                                    <span className="flex-1 text-left">退出登录</span>
                                </motion.button>
                            </div>
                        </>
                    )}
                </motion.div>
            </PopoverContent>
        </Popover>
    );
};

export default ExpandableUserMenu;

