'use client';

import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HeaderProps } from '@/types';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { SettingsDialog } from '@/features/user/settings';

export const Header: React.FC<HeaderProps> = ({
    title = 'Research Navigator',
    logo,
    actions,
    user,
    theme = 'light',
    className
}) => {
    const [settingsOpen, setSettingsOpen] = useState(false);
    return (
        <header
            className={cn(
                'h-16 border-b border-gray-200 bg-white shadow-sm',
                theme === 'dark' && 'border-gray-700 bg-gray-900',
                className
            )}
        >
            <div className="flex h-full items-center justify-between px-6">
                {/* 左侧：Logo 和标题 */}
                <div className="flex items-center space-x-4">
                    {logo && (
                        <div className="flex items-center">
                            {logo}
                        </div>
                    )}
                    <h1 className={cn(
                        'text-xl font-semibold text-gray-900',
                        theme === 'dark' && 'text-white'
                    )}>
                        {title}
                    </h1>
                </div>

                {/* 右侧：操作按钮和用户信息 */}
                <div className="flex items-center space-x-4">
                    {actions && (
                        <div className="flex items-center space-x-2">
                            {actions}
                        </div>
                    )}

                    {/* 设置按钮 */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSettingsOpen(true)}
                        className={cn(
                            'h-8 w-8',
                            theme === 'dark' && 'text-gray-300 hover:text-white'
                        )}
                    >
                        <Settings className="h-4 w-4" />
                    </Button>

                    {user && (
                        <div className="flex items-center space-x-3">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="flex items-center space-x-2 h-auto p-2">
                                        {user.avatar ? (
                                            <img
                                                src={user.avatar}
                                                alt={user.name}
                                                className="h-8 w-8 rounded-full object-cover"
                                            />
                                        ) : (
                                            <div className={cn(
                                                'h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium'
                                            )}>
                                                {user.name.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <span className={cn(
                                            'text-sm font-medium text-gray-700',
                                            theme === 'dark' && 'text-gray-300'
                                        )}>
                                            {user.name}
                                        </span>
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                    <DropdownMenuItem>
                                        个人资料
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>
                                        我的项目
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>
                                        使用帮助
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                                        <Settings className="mr-2 h-4 w-4" />
                                        设置
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-red-600">
                                        退出登录
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    )}
                </div>
            </div>

            {/* 设置对话框 */}
            <SettingsDialog
                open={settingsOpen}
                onOpenChange={setSettingsOpen}
            />
        </header>
    );
};
