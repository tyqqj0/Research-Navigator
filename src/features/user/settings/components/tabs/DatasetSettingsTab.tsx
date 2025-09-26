'use client';

import { KeyRound, PlugZap, ShieldCheck, Settings2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useDatasetSettings } from '../../data-access';
import React from 'react';

const PROVIDERS = [
    { value: 'zotero', label: 'Zotero', status: 'stable' },
    { value: 'notion', label: 'Notion (预留)', status: 'planned' },
    { value: 'obsidian', label: 'Obsidian (预留)', status: 'planned' },
    { value: 'custom', label: '自定义 (预留)', status: 'planned' }
];

export function DatasetSettingsTab() {
    const { settings, updateSettings } = useDatasetSettings();
    const [testing, setTesting] = React.useState(false);
    const [testMessage, setTestMessage] = React.useState<string | null>(null);

    const doTestConnection = async () => {
        setTesting(true);
        setTestMessage(null);
        try {
            const { datasetService } = await import('@/features/dataset/data-access/dataset-service');
            await datasetService.listNodes({ authOverride: { apiKey: settings?.apiKey } });
            setTestMessage('连接成功，可以拉取外部库结构。');
        } catch (err: any) {
            setTestMessage(`连接失败：${err?.message || '未知错误'}`);
        } finally {
            setTesting(false);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <PlugZap className="w-5 h-5 text-primary" />
                        外部数据源
                    </CardTitle>
                    <CardDescription>
                        连接外部库以读取条目并选择导入
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Tabs defaultValue={settings?.provider || 'zotero'} className="w-full"
                        onValueChange={(val) => updateSettings({ provider: val as any })}
                    >
                        <TabsList className="grid w-full grid-cols-4">
                            {PROVIDERS.map(p => (
                                <TabsTrigger key={p.value} value={p.value}>{p.label}</TabsTrigger>
                            ))}
                        </TabsList>

                        <TabsContent value="zotero" className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="zoteroApiKey">Zotero API Key</Label>
                                    <div className="flex items-center gap-2">
                                        <KeyRound className="w-4 h-4 text-muted-foreground" />
                                        <Input
                                            id="zoteroApiKey"
                                            type="password"
                                            value={settings?.apiKey || ''}
                                            onChange={(e) => updateSettings({ apiKey: e.target.value })}
                                            placeholder="输入 Zotero API Key"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button onClick={doTestConnection} disabled={testing}>
                                    测试连接
                                </Button>
                                {testMessage && (
                                    <Alert className="ml-2">
                                        <ShieldCheck className="h-4 w-4" />
                                        <AlertDescription>{testMessage}</AlertDescription>
                                    </Alert>
                                )}
                            </div>
                        </TabsContent>

                        <TabsContent value="notion">
                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                                <Settings2 className="w-4 h-4" /> 功能规划中
                            </div>
                        </TabsContent>
                        <TabsContent value="obsidian">
                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                                <Settings2 className="w-4 h-4" /> 功能规划中
                            </div>
                        </TabsContent>
                        <TabsContent value="custom">
                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                                <Settings2 className="w-4 h-4" /> 自定义源，敬请期待
                            </div>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>说明</CardTitle>
                    <CardDescription>目前优先支持 Zotero API 读操作；Notion/Obsidian 预留。</CardDescription>
                </CardHeader>
                <CardContent>
                    <ul className="list-disc pl-6 text-sm text-muted-foreground space-y-1">
                        <li>仅拉取外部库结构与条目，导入由文献库入口统一处理。</li>
                        <li>API Key 建议使用只读权限。</li>
                        <li>导入路径：在 Dataset 面板选择条目 → 批量导入并可加入集合。</li>
                    </ul>
                </CardContent>
            </Card>
        </div>
    );
}


