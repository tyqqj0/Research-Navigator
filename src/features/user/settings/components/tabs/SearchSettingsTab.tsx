/**
 * Search Settings Tab - 搜索设置选项卡
 */

'use client';

import { Search, Settings2 } from 'lucide-react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { useSearchSettings } from '../../data-access';

const SEARCH_PROVIDERS = [
    { value: 'tavily', label: 'Tavily', description: '综合搜索引擎', status: 'stable' },
    { value: 'exa', label: 'Exa', description: '学术论文搜索', status: 'stable' },
    { value: 'firecrawl', label: 'Firecrawl', description: '网页爬取', status: 'beta' },
    { value: 'bocha', label: 'Bocha', description: '中文优化搜索', status: 'beta' },
    { value: 'searxng', label: 'SearXNG', description: '开源元搜索', status: 'stable' }
];

const CRAWLERS = [
    { value: 'jina', label: 'Jina Reader', description: '智能内容提取' },
    { value: 'firecrawl', label: 'Firecrawl', description: '专业爬虫服务' },
    { value: 'builtin', label: '内置爬虫', description: '基础HTML解析' }
];

const getStatusColor = (status: string) => {
    switch (status) {
        case 'stable': return 'bg-green-100 text-green-800';
        case 'beta': return 'bg-primary/10 text-primary';
        case 'experimental': return 'bg-orange-100 text-orange-800';
        default: return 'bg-gray-100 text-gray-800';
    }
};

export function SearchSettingsTab() {
    const { settings, updateSettings } = useSearchSettings();

    return (
        <div className="space-y-6">
            {/* 基础设置 */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Search className="w-5 h-5 text-primary" />
                        搜索配置
                    </CardTitle>
                    <CardDescription>
                        配置搜索引擎和爬虫设置
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <Label htmlFor="enableSearch">启用搜索功能</Label>
                            <p className="text-sm text-muted-foreground">
                                开启后可以搜索互联网内容
                            </p>
                        </div>
                        <Switch
                            id="enableSearch"
                            checked={settings.enableSearch}
                            onCheckedChange={(checked) => updateSettings({ enableSearch: checked })}
                        />
                    </div>

                    {settings.enableSearch && (
                        <>
                            <Separator />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="searchProvider">搜索引擎</Label>
                                    <Select
                                        value={settings.searchProvider}
                                        onValueChange={(value: string) => updateSettings({ searchProvider: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="选择搜索引擎" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SEARCH_PROVIDERS.map(provider => (
                                                <SelectItem key={provider.value} value={provider.value}>
                                                    <div className="flex items-center justify-between w-full">
                                                        <div>
                                                            <div className="font-medium">{provider.label}</div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {provider.description}
                                                            </div>
                                                        </div>
                                                        <Badge className={getStatusColor(provider.status)}>
                                                            {provider.status}
                                                        </Badge>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="crawler">内容爬虫</Label>
                                    <Select
                                        value={settings.crawler}
                                        onValueChange={(value: string) => updateSettings({ crawler: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="选择爬虫" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {CRAWLERS.map(crawler => (
                                                <SelectItem key={crawler.value} value={crawler.value}>
                                                    <div>
                                                        <div className="font-medium">{crawler.label}</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {crawler.description}
                                                        </div>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="parallelSearch">并行搜索数</Label>
                                    <div className="px-3">
                                        <Slider
                                            value={[settings.parallelSearch]}
                                            onValueChange={([value]) => updateSettings({ parallelSearch: value })}
                                            max={5}
                                            min={1}
                                            step={1}
                                            className="w-full"
                                        />
                                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                            <span>1</span>
                                            <span>当前: {settings.parallelSearch}</span>
                                            <span>5</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="searchMaxResult">最大结果数</Label>
                                    <div className="px-3">
                                        <Slider
                                            value={[settings.searchMaxResult]}
                                            onValueChange={([value]) => updateSettings({ searchMaxResult: value })}
                                            max={20}
                                            min={1}
                                            step={1}
                                            className="w-full"
                                        />
                                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                            <span>1</span>
                                            <span>当前: {settings.searchMaxResult}</span>
                                            <span>20</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* 搜索引擎配置 */}
            {settings.enableSearch && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Settings2 className="w-5 h-5 text-primary" />
                            搜索引擎配置
                        </CardTitle>
                        <CardDescription>
                            配置各个搜索引擎的API密钥和参数
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="tavily" className="w-full">
                            <TabsList className="grid w-full grid-cols-5">
                                <TabsTrigger value="tavily">Tavily</TabsTrigger>
                                <TabsTrigger value="exa">Exa</TabsTrigger>
                                <TabsTrigger value="firecrawl">Firecrawl</TabsTrigger>
                                <TabsTrigger value="bocha">Bocha</TabsTrigger>
                                <TabsTrigger value="searxng">SearXNG</TabsTrigger>
                            </TabsList>

                            <TabsContent value="tavily" className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="tavilyApiKey">API 密钥</Label>
                                    <Input
                                        type="password"
                                        value={settings.tavily.apiKey}
                                        onChange={(e) => updateSettings({
                                            tavily: { ...settings.tavily, apiKey: e.target.value }
                                        })}
                                        placeholder="输入 Tavily API 密钥"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="tavilyProxy">代理地址</Label>
                                    <Input
                                        value={settings.tavily.apiProxy}
                                        onChange={(e) => updateSettings({
                                            tavily: { ...settings.tavily, apiProxy: e.target.value }
                                        })}
                                        placeholder="https://api.tavily.com"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="tavilyScope">搜索范围</Label>
                                    <Select
                                        value={settings.tavily.scope}
                                        onValueChange={(value) => updateSettings({
                                            tavily: { ...settings.tavily, scope: value }
                                        })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="general">通用搜索</SelectItem>
                                            <SelectItem value="news">新闻搜索</SelectItem>
                                            <SelectItem value="academic">学术搜索</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </TabsContent>

                            <TabsContent value="exa" className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="exaApiKey">API 密钥</Label>
                                    <Input
                                        type="password"
                                        value={settings.exa.apiKey}
                                        onChange={(e) => updateSettings({
                                            exa: { ...settings.exa, apiKey: e.target.value }
                                        })}
                                        placeholder="输入 Exa API 密钥"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="exaProxy">代理地址</Label>
                                    <Input
                                        value={settings.exa.apiProxy}
                                        onChange={(e) => updateSettings({
                                            exa: { ...settings.exa, apiProxy: e.target.value }
                                        })}
                                        placeholder="https://api.exa.ai"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="exaScope">搜索范围</Label>
                                    <Select
                                        value={settings.exa.scope}
                                        onValueChange={(value) => updateSettings({
                                            exa: { ...settings.exa, scope: value }
                                        })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="research paper">研究论文</SelectItem>
                                            <SelectItem value="academic">学术内容</SelectItem>
                                            <SelectItem value="general">通用搜索</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </TabsContent>

                            <TabsContent value="firecrawl" className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="firecrawlApiKey">API 密钥</Label>
                                    <Input
                                        type="password"
                                        value={settings.firecrawl.apiKey}
                                        onChange={(e) => updateSettings({
                                            firecrawl: { ...settings.firecrawl, apiKey: e.target.value }
                                        })}
                                        placeholder="输入 Firecrawl API 密钥"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="firecrawlProxy">代理地址</Label>
                                    <Input
                                        value={settings.firecrawl.apiProxy}
                                        onChange={(e) => updateSettings({
                                            firecrawl: { ...settings.firecrawl, apiProxy: e.target.value }
                                        })}
                                        placeholder="https://api.firecrawl.dev"
                                    />
                                </div>
                            </TabsContent>

                            <TabsContent value="bocha" className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="bochaApiKey">API 密钥</Label>
                                    <Input
                                        type="password"
                                        value={settings.bocha.apiKey}
                                        onChange={(e) => updateSettings({
                                            bocha: { ...settings.bocha, apiKey: e.target.value }
                                        })}
                                        placeholder="输入 Bocha API 密钥"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="bochaProxy">代理地址</Label>
                                    <Input
                                        value={settings.bocha.apiProxy}
                                        onChange={(e) => updateSettings({
                                            bocha: { ...settings.bocha, apiProxy: e.target.value }
                                        })}
                                        placeholder="https://api.bocha.co"
                                    />
                                </div>
                            </TabsContent>

                            <TabsContent value="searxng" className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="searxngProxy">SearXNG 实例地址</Label>
                                    <Input
                                        value={settings.searxng.apiProxy}
                                        onChange={(e) => updateSettings({
                                            searxng: { ...settings.searxng, apiProxy: e.target.value }
                                        })}
                                        placeholder="https://searx.example.com"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="searxngScope">搜索范围</Label>
                                    <Select
                                        value={settings.searxng.scope}
                                        onValueChange={(value) => updateSettings({
                                            searxng: { ...settings.searxng, scope: value }
                                        })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">全部</SelectItem>
                                            <SelectItem value="general">通用</SelectItem>
                                            <SelectItem value="images">图片</SelectItem>
                                            <SelectItem value="videos">视频</SelectItem>
                                            <SelectItem value="news">新闻</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
