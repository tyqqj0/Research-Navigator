/**
 * Settings Dialog - 设置对话框主组件
 */

'use client';

import { useState } from 'react';
import { Settings, X } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

import { AISettingsTab } from './tabs/AISettingsTab';
import { SearchSettingsTab } from './tabs/SearchSettingsTab';
import { UISettingsTab } from './tabs/UISettingsTab';
import { ResearchSettingsTab } from './tabs/ResearchSettingsTab';
import { BackupSettingsTab } from './tabs/BackupSettingsTab';

interface SettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
    const [activeTab, setActiveTab] = useState('ai');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[80vh] p-0">
                <DialogHeader className="px-6 py-4 border-b">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Settings className="w-5 h-5 text-primary" />
                            <DialogTitle className="text-xl">设置</DialogTitle>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onOpenChange(false)}
                            className="h-8 w-8"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </DialogHeader>

                <div className="flex h-full">
                    <Tabs
                        value={activeTab}
                        onValueChange={setActiveTab}
                        className="flex w-full"
                    >
                        {/* 侧边栏导航 */}
                        <div className="w-48 border-r bg-muted/20">
                            <ScrollArea className="h-full">
                                <TabsList className="flex flex-col h-auto w-full p-2 bg-transparent">
                                    <TabsTrigger
                                        value="ai"
                                        className="w-full justify-start px-3 py-2 text-left"
                                    >
                                        🤖 AI 设置
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

                        {/* 主内容区 */}
                        <div className="flex-1">
                            <ScrollArea className="h-full">
                                <div className="p-6">
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
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    );
}
