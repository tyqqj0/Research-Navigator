import { MainLayout } from '@/components/layout';
import { Button, Card, CardContent, CardHeader, CardTitle, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';

export default function LibraryPage() {
    const user = {
        name: 'Research User',
        avatar: undefined
    };

    const headerActions = (
        <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
                导入文献
            </Button>
            <Button variant="outline" size="sm">
                导出
            </Button>
            <Button size="sm">
                新建收藏夹
            </Button>
        </div>
    );

    return (
        <MainLayout
            headerTitle="我的文库"
            headerActions={headerActions}
            user={user}
            showSidebar={true}
        >
            <div className="p-6">
                <div className="max-w-7xl mx-auto space-y-6">
                    <Tabs defaultValue="all" className="w-full">
                        <TabsList>
                            <TabsTrigger value="all">全部文献</TabsTrigger>
                            <TabsTrigger value="recent">最近添加</TabsTrigger>
                            <TabsTrigger value="favorites">收藏夹</TabsTrigger>
                            <TabsTrigger value="tags">标签</TabsTrigger>
                        </TabsList>

                        <TabsContent value="all" className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h2 className="text-xl font-semibold">全部文献 (156)</h2>
                                <div className="flex space-x-2">
                                    <Button variant="outline" size="sm">排序</Button>
                                    <Button variant="outline" size="sm">筛选</Button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {[1, 2, 3, 4, 5, 6].map((item) => (
                                    <Card key={item} className="hover:shadow-md transition-shadow">
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-sm line-clamp-2">
                                                Deep Learning for Computer Vision: A Brief Review
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            <p className="text-xs text-gray-600 dark:text-gray-400">
                                                Zhang, L., Wang, M., Chen, X.
                                            </p>
                                            <div className="flex flex-wrap gap-1">
                                                <span className="text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 px-2 py-1 rounded">
                                                    Computer Vision
                                                </span>
                                                <span className="text-xs bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 px-2 py-1 rounded">
                                                    Deep Learning
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center pt-2">
                                                <span className="text-xs text-gray-500">2023</span>
                                                <div className="flex space-x-1">
                                                    <Button variant="ghost" size="sm">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                                        </svg>
                                                    </Button>
                                                    <Button variant="ghost" size="sm">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                                        </svg>
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </TabsContent>

                        <TabsContent value="recent">
                            <p className="text-gray-600 dark:text-gray-400">最近添加的文献...</p>
                        </TabsContent>

                        <TabsContent value="favorites">
                            <p className="text-gray-600 dark:text-gray-400">收藏的文献...</p>
                        </TabsContent>

                        <TabsContent value="tags">
                            <p className="text-gray-600 dark:text-gray-400">按标签分类的文献...</p>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </MainLayout>
    );
}
