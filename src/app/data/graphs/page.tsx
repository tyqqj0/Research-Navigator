import { MainLayout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';

export default function DataGraphsPage() {
    return (
        <MainLayout headerTitle="数据管理" showSidebar={true}>
            <div className="p-6">
                <div className="max-w-7xl mx-auto space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>文献图谱管理</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-64 md:h-72 w-full rounded-md border bg-gray-50 dark:bg-gray-900/20 flex items-center justify-center text-sm text-muted-foreground">
                                图谱管理功能将在这里展示
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </MainLayout>
    );
}


