'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    BookOpen,
    Search,
    Plus,
    Link2,
    FileText,
    Activity,
    CheckCircle,
    XCircle,
    Clock
} from 'lucide-react';

// 导入我们的新API
import {
    literatureDataAccess,
    literatureEntry,
    useLiteratureStore,
    type LibraryItem,
    type LiteratureSource
} from '@/features/literature/data-access';

export default function LiteratureAPIDemo() {
    const [activeTab, setActiveTab] = useState('entry');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    // 表单状态
    const [identifier, setIdentifier] = useState('10.1038/nature12373');
    const [searchQuery, setSearchQuery] = useState('machine learning');
    const [metadata, setMetadata] = useState({
        title: 'Example Research Paper',
        authors: ['John Doe', 'Jane Smith'],
        year: 2023,
        journal: 'Nature',
        abstract: 'This is an example abstract for demonstration purposes.',
        keywords: ['AI', 'machine learning', 'research']
    });

    // 使用文献存储
    const literatureStore = useLiteratureStore();

    const handleAsyncOperation = async (operation: () => Promise<any>) => {
        setLoading(true);
        setError(null);
        try {
            const result = await operation();
            setResult(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    };

    const addByIdentifier = () => handleAsyncOperation(async () => {
        return await literatureEntry.addByIdentifier(identifier, {
            autoExtractCitations: true,
            tags: ['demo', 'api-test']
        });
    });

    const performSearch = () => handleAsyncOperation(async () => {
        return await literatureDataAccess.searchLiterature(searchQuery, {
            limit: 10
        });
    });

    const performHealthCheck = () => handleAsyncOperation(async () => {
        return await literatureDataAccess.performHealthCheck();
    });

    const generateStats = () => handleAsyncOperation(async () => {
        return await literatureDataAccess.generateStatisticsReport();
    });

    const batchImport = () => handleAsyncOperation(async () => {
        return await literatureEntry.batchImport([
            { type: 'identifier', data: '10.1038/nature12373', options: { tags: ['batch-1'] } }
        ]);
    });

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold">📚 Literature Data Access API Demo</h1>
                <p className="text-muted-foreground">
                    演示新的文献数据访问层API - 统一入口、类型安全、功能完整
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="entry">📝 文献入口</TabsTrigger>
                    <TabsTrigger value="search">🔍 搜索查询</TabsTrigger>
                    <TabsTrigger value="system">⚙️ 系统管理</TabsTrigger>
                    <TabsTrigger value="store">🏪 状态管理</TabsTrigger>
                </TabsList>

                {/* 文献入口点演示 */}
                <TabsContent value="entry" className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        {/* 统一标识添加 */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Link2 className="h-5 w-5" />
                                    通过标识添加 (支持 S2/DOI/URL/...)
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <Input
                                    placeholder="输入 S2/DOI/URL 或其他标识"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                />
                                <Button onClick={addByIdentifier} disabled={loading} className="w-full">
                                    {loading ? <Clock className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                                    添加文献
                                </Button>
                            </CardContent>
                        </Card>

                        {/* 元数据添加 */}
                        <Card className="md:col-span-2">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <BookOpen className="h-5 w-5" />
                                    手动添加元数据
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="grid md:grid-cols-2 gap-3">
                                    <Input
                                        placeholder="标题"
                                        value={metadata.title}
                                        onChange={(e) => setMetadata({ ...metadata, title: e.target.value })}
                                    />
                                    <Input
                                        placeholder="期刊"
                                        value={metadata.journal}
                                        onChange={(e) => setMetadata({ ...metadata, journal: e.target.value })}
                                    />
                                </div>
                                <Textarea
                                    placeholder="摘要"
                                    value={metadata.abstract}
                                    onChange={(e) => setMetadata({ ...metadata, abstract: e.target.value })}
                                />
                                <div className="flex gap-2">
                                    <Button onClick={batchImport} disabled={loading}>
                                        {loading ? <Clock className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                                        通过元数据添加（批量示例）
                                    </Button>
                                    <Button onClick={batchImport} disabled={loading} variant="outline">批量导入演示</Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* 搜索查询演示 */}
                <TabsContent value="search" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Search className="h-5 w-5" />
                                智能搜索
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="搜索关键词"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="flex-1"
                                />
                                <Button onClick={performSearch} disabled={loading}>
                                    {loading ? <Clock className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                                    搜索
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* 系统管理演示 */}
                <TabsContent value="system" className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Activity className="h-5 w-5" />
                                    健康检查
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Button onClick={performHealthCheck} disabled={loading} className="w-full">
                                    {loading ? <Clock className="h-4 w-4 mr-2 animate-spin" /> : <Activity className="h-4 w-4 mr-2" />}
                                    执行健康检查
                                </Button>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <FileText className="h-5 w-5" />
                                    统计报告
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Button onClick={generateStats} disabled={loading} className="w-full">
                                    {loading ? <Clock className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                                    生成统计报告
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* 状态管理演示 */}
                <TabsContent value="store" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>🏪 Store 状态</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span>文献总数:</span>
                                    <Badge>{literatureStore.getAllLiteratures().length}</Badge>
                                </div>
                                <div className="flex justify-between">
                                    <span>最后更新:</span>
                                    <Badge variant="outline">
                                        {literatureStore.stats.lastUpdated?.toLocaleString() || "从未"}
                                    </Badge>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* 结果显示区域 */}
            {(result || error) && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            {error ? <XCircle className="h-5 w-5 text-red-500" /> : <CheckCircle className="h-5 w-5 text-green-500" />}
                            {error ? "操作失败" : "操作成功"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {error ? (
                            <Alert>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        ) : (
                            <pre className="bg-muted p-4 rounded-md overflow-auto max-h-96 text-sm">
                                {JSON.stringify(result, null, 2)}
                            </pre>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* API 使用说明 */}
            <Card>
                <CardHeader>
                    <CardTitle>📖 API 使用说明</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <h4 className="font-semibold mb-2">🚪 文献入口 (literatureEntry)</h4>
                            <ul className="text-sm space-y-1 text-muted-foreground">
                                <li>• addByIdentifier() - 统一标识添加 (S2/DOI/URL/...)</li>
                                <li>• batchImport() - 'identifier' 或 'metadata'</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2">🎯 数据访问 (literatureDataAccess)</h4>
                            <ul className="text-sm space-y-1 text-muted-foreground">
                                <li>• searchLiterature() - 智能搜索</li>
                                <li>• performHealthCheck() - 健康检查</li>
                                <li>• generateStatisticsReport() - 统计报告</li>
                                <li>• findSimilarLiterature() - 相似文献</li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

