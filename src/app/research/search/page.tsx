import { MainLayout } from '@/components/layout';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/components/ui';

export default function SearchPage() {

    const pageHeader = (
        <div className="px-6 py-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">文献搜索</h2>
            <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm">高级搜索</Button>
                <Button size="sm">保存搜索</Button>
            </div>
        </div>
    );

    return (
        <MainLayout showSidebar={true} showHeader={false} pageHeader={pageHeader}>
            <div className="p-6">
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* 搜索区域 */}
                    <Card>
                        <CardHeader>
                            <CardTitle>搜索学术文献</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex space-x-4">
                                <Input
                                    placeholder="输入关键词、作者或DOI..."
                                    className="flex-1"
                                />
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

                    {/* 搜索结果 */}
                    <div className="grid grid-cols-1 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">搜索结果</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                                        <h3 className="font-semibold text-lg mb-2">
                                            Attention Is All You Need
                                        </h3>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                            Vaswani, A., Shazeer, N., Parmar, N., et al.
                                        </p>
                                        <p className="text-sm mb-3">
                                            We propose a new simple network architecture, the Transformer, based solely on attention mechanisms...
                                        </p>
                                        <div className="flex items-center justify-between">
                                            <div className="flex space-x-2">
                                                <span className="text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 px-2 py-1 rounded">
                                                    NIPS 2017
                                                </span>
                                                <span className="text-xs bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 px-2 py-1 rounded">
                                                    引用: 45,678
                                                </span>
                                            </div>
                                            <div className="flex space-x-2">
                                                <Button variant="outline" size="sm">保存</Button>
                                                <Button variant="outline" size="sm">引用</Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
