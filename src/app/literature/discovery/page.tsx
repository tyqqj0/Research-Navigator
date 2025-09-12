import { MainLayout } from '@/components/layout';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/components/ui';

export default function LiteratureDiscoveryPage() {
    const headerActions = (
        <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">高级筛选</Button>
            <Button size="sm">保存查询</Button>
        </div>
    );

    return (
        <MainLayout
            headerTitle="文献发现"
            headerActions={headerActions}
            showSidebar={true}
        >
            <div className="p-6">
                <div className="max-w-7xl mx-auto space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>发现与探索</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex space-x-4">
                                <Input placeholder="输入关键词、作者或DOI..." className="flex-1" />
                                <Button>搜索</Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button variant="outline" size="sm">计算机科学</Button>
                                <Button variant="outline" size="sm">机器学习</Button>
                                <Button variant="outline" size="sm">人工智能</Button>
                                <Button variant="outline" size="sm">数据科学</Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">推荐与趋势</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm text-muted-foreground">
                                在这里展示基于您的文库与兴趣的推荐、趋势与新发现。
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </MainLayout>
    );
}


