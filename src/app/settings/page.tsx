/**
 * Settings Page - 设置页面
 */

'use client';

import { useState } from 'react';
import { ArrowLeft, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useRouter } from 'next/navigation';

import { AISettingsTab } from '@/features/user/settings/components/tabs/AISettingsTab';
import { SearchSettingsTab } from '@/features/user/settings/components/tabs/SearchSettingsTab';
import { UISettingsTab } from '@/features/user/settings/components/tabs/UISettingsTab';
import { ResearchSettingsTab } from '@/features/user/settings/components/tabs/ResearchSettingsTab';
import { BackupSettingsTab } from '@/features/user/settings/components/tabs/BackupSettingsTab';

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState('ai');
    const router = useRouter();

    return (
        <div className="min-h-screen bg-background">
            {/* 顶部导航栏 */}
            <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex items-center justify-between h-16 px-4">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.back()}
                            className="h-8 w-8"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                        <div className="flex items-center gap-2">
                            <Settings className="w-5 h-5 text-blue-600" />
                            <h1 className="text-xl font-semibold">设置</h1>
                        </div>
                    </div>
                </div>
            </div>

            {/* 主内容区 */}
            <div className="container px-4 py-6">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <div className="flex gap-6">
                        {/* 左侧导航 */}
                        <div className="w-64 flex-shrink-0">
                            <div className="sticky top-6">
                                <ScrollArea className="h-[calc(100vh-12rem)]">
                                    <TabsList className="w-full flex-col h-auto p-1 bg-muted/50">
                                        <TabsTrigger
                                            value="ai"
                                            className="w-full justify-start px-3 py-2 text-left"
                                        >
                                            🤖 AI设置
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="search"
                                            className="w-full justify-start px-3 py-2 text-left"
                                        >
                                            🔍 搜索设置
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="ui"
                                            className="w-full justify-start px-3 py-2 text-left"
                                        >
                                            🎨 界面设置
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="research"
                                            className="w-full justify-start px-3 py-2 text-left"
                                        >
                                            📚 研究设置
                                        </TabsTrigger>
                                        <Separator className="my-2" />
                                        <TabsTrigger
                                            value="backup"
                                            className="w-full justify-start px-3 py-2 text-left"
                                        >
                                            💾 备份管理
                                        </TabsTrigger>
                                    </TabsList>
                                </ScrollArea>
                            </div>
                        </div>

                        {/* 右侧内容 */}
                        <div className="flex-1 min-w-0">
                            <ScrollArea className="h-[calc(100vh-12rem)]">
                                <div className="pr-4">
                                    <TabsContent value="ai" className="mt-0">
                                        <AISettingsTab />
                                    </TabsContent>

                                    <TabsContent value="search" className="mt-0">
                                        <SearchSettingsTab />
                                    </TabsContent>

                                    <TabsContent value="ui" className="mt-0">
                                        <UISettingsTab />
                                    </TabsContent>

                                    <TabsContent value="research" className="mt-0">
                                        <ResearchSettingsTab />
                                    </TabsContent>

                                    <TabsContent value="backup" className="mt-0">
                                        <BackupSettingsTab />
                                    </TabsContent>
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                </Tabs>
            </div>
        </div>
    );
}
