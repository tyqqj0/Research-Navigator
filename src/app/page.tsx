"use client";

import { MainLayout } from '@/components/layout';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  StatCard,
  FeatureCard,
  ActivityItem
} from '@/components/ui';
import { Search, Book, BarChart3, MessageCircle, Plus, Check } from 'lucide-react';

export default function Home() {
  const headerActions = (
    <div className="flex items-center space-x-2">
      <Button variant="outline">
        导入文献
      </Button>
      <Button variant="outline">
        <Plus className="mr-2 h-4 w-4" />
        新建项目
      </Button>
    </div>
  );

  return (
    <MainLayout
      headerTitle="Research Navigator"
      headerActions={headerActions}
      showSidebar={true}
    >
      <div className="p-6 ">
        <div className="max-w-7xl mx-auto">
          {/* 欢迎区域 */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2 theme-text">
              欢迎使用 Research Navigator
            </h1>
            <p className="text-lg theme-text">
              您的智能研究助手，帮助您发现、管理和分析学术文献
            </p>
          </div>

          {/* 快速操作卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <FeatureCard
              title="文献搜索"
              description="搜索最新研究"
              icon={<Search />}
              variant="blue"
              onClick={() => console.log('Navigate to search')}
            />

            <FeatureCard
              title="我的文库"
              description="管理收藏文献"
              icon={<Book />}
              variant="green"
              onClick={() => console.log('Navigate to library')}
            />

            <FeatureCard
              title="数据分析"
              description="趋势与洞察"
              icon={<BarChart3 />}
              variant="purple"
              onClick={() => console.log('Navigate to analytics')}
            />

            <FeatureCard
              title="AI 助手"
              description="智能分析助手"
              icon={<MessageCircle />}
              variant="orange"
              onClick={() => console.log('Navigate to chat')}
            />
          </div>

          {/* 最近活动 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>最近活动</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <ActivityItem
                    title="添加了新文献：Machine Learning in Healthcare"
                    timestamp="2小时前"
                    icon={<Plus className="h-4 w-4" />}
                    variant="success"
                  />
                  <ActivityItem
                    title="完成了项目分析：AI Research Trends"
                    timestamp="昨天"
                    icon={<Check className="h-4 w-4" />}
                    variant="primary"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>统计概览</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <StatCard value="156" label="收藏文献" variant="blue" />
                  <StatCard value="8" label="活跃项目" variant="green" />
                  <StatCard value="24" label="分析报告" variant="purple" />
                  <StatCard value="1.2k" label="引用数量" variant="orange" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}