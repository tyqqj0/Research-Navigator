'use client';

import React from 'react';
import Image from 'next/image';
import { Settings, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
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

export const Header: React.FC<HeaderProps> = ({
    title = 'Research Navigator',
    logo,
    actions,
    user,
    className
}) => {
    const router = useRouter();
    return (
        <header
            className={cn(
                'h-16 border-b border-gray-200 bg-white shadow-sm theme-primary-background',
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
                        'text-xl font-semibold',
                        'theme-text-primary'
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



                    {user && (
                        <div className="flex items-center space-x-3">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="flex items-center space-x-2 h-auto p-2">
                                        {user.avatar ? (
                                            <Image
                                                src={user.avatar}
                                                alt={user.name}
                                                width={32}
                                                height={32}
                                                className="h-8 w-8 rounded-full object-cover"
                                            />
                                        ) : (
                                            <div className={cn(
                                                'h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-medium',
                                                'theme-icon-blue'
                                            )}>
                                                {user.name.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <span className={cn(
                                            'text-sm font-medium',
                                            // 'theme-primary-background'
                                        )}>
                                            {user.name}
                                        </span>
                                        <ChevronDown className="h-4 w-4" />
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
                                    <DropdownMenuItem onClick={() => router.push('/settings')}>
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
        </header>
    );
};
