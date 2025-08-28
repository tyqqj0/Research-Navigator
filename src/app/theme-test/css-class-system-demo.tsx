'use client';

import React, { useState } from 'react';
import {
    Card, CardContent, CardHeader, CardTitle,
    Badge, Button, Input, Checkbox, Switch,
    Alert, AlertDescription, AlertTitle,
    Progress, Skeleton, Separator,
    StatCard, FeatureCard, ActivityItem,
    // ThemeShowcase
} from '@/components/ui';
import { ThemeProvider, useTheme } from '@/providers';
import {
    Search, Bell, Settings, Users, BookOpen, TrendingUp,
    Plus, Check, X, AlertCircle, Info, CheckCircle
} from 'lucide-react';
import { ColorPreset } from '@/lib/theme/theme-config';

function ThemeControls() {
    const {
        theme,
        themeMode,
        setThemeMode,
        setColorPreset,
        availablePresets
    } = useTheme();

    return (
        <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
            <h5 className="font-medium">🎛️ 主题控制</h5>

            {/* 主题模式选择 */}
            <div className="space-y-2">
                <label className="text-sm font-medium">主题模式：</label>
                <div className="flex flex-wrap gap-2">
                    {(['light', 'dark', 'system'] as const).map((mode) => (
                        <button
                            key={mode}
                            onClick={() => setThemeMode(mode)}
                            className={`px-3 py-1 rounded text-sm border transition-colors ${themeMode === mode
                                ? 'bg-blue-500 text-white border-blue-500'
                                : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300'
                                }`}
                        >
                            {mode === 'light' ? '浅色' : mode === 'dark' ? '深色' : '跟随系统'}
                        </button>
                    ))}
                </div>
            </div>

            {/* 颜色预设选择 */}
            <div className="space-y-2">
                <label className="text-sm font-medium">颜色预设：</label>
                <div className="grid grid-cols-2 gap-2">
                    {availablePresets.map((preset: ColorPreset) => (
                        <button
                            key={preset.name}
                            onClick={() => setColorPreset(preset.name)}
                            className={`px-3 py-2 rounded text-sm border transition-colors flex items-center gap-2 ${theme.colors.primary === preset.colors.primary
                                ? 'bg-blue-500 text-white border-blue-500'
                                : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300'
                                }`}
                        >
                            <div
                                className="w-4 h-4 rounded-full border border-white/20"
                                style={{ backgroundColor: preset.colors.primary }}
                            />
                            {preset.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="text-xs text-gray-600">
                当前主题: {theme.name} ({theme.isDark ? '深色' : '浅色'})
            </div>
        </div>
    );
}

function CSSClassSystemDemoContent() {
    const [progress, setProgress] = useState(45);
    const [checkedItems, setCheckedItems] = useState({
        check1: false,
        check2: true,
        check3: false
    });
    const [switchStates, setSwitchStates] = useState({
        switch1: false,
        switch2: true,
        switch3: false
    });

    return (
        <div className="space-y-6">
            {/* 主题控制面板 */}
            <ThemeControls />

            <Card>
                <CardHeader>
                    <CardTitle>🎨 新CSS类系统演示</CardTitle>
                    <p className="text-sm text-muted-foreground">
                        展示语义化CSS类的使用，这些类会自动响应主题变化
                    </p>
                </CardHeader>
                <CardContent className="space-y-8">
                    {/* 颜色类演示 */}
                    <div className="space-y-4">
                        <h4 className="text-lg font-semibold">🌈 颜色类演示</h4>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {/* 主色调 */}
                            <div className="space-y-2">
                                <h5 className="font-medium text-sm">主色调</h5>
                                <div className="theme-primary p-3 rounded text-center text-sm font-medium">
                                    theme-primary
                                </div>
                                <div className="theme-primary-soft p-3 rounded text-center text-sm font-medium">
                                    theme-primary-soft
                                </div>
                                <div className="theme-primary-outline p-3 rounded text-center text-sm font-medium">
                                    theme-primary-outline
                                </div>
                                <div className="theme-primary-ghost p-3 rounded text-center text-sm font-medium hover:opacity-20 transition-all">
                                    theme-primary-ghost
                                </div>
                            </div>

                            {/* 状态色 */}
                            <div className="space-y-2">
                                <h5 className="font-medium text-sm">状态色</h5>
                                <div className="theme-success p-2 rounded text-center text-xs font-medium">
                                    theme-success
                                </div>
                                <div className="theme-warning p-2 rounded text-center text-xs font-medium">
                                    theme-warning
                                </div>
                                <div className="theme-error p-2 rounded text-center text-xs font-medium">
                                    theme-error
                                </div>
                                <div className="theme-info p-2 rounded text-center text-xs font-medium">
                                    theme-info
                                </div>
                            </div>

                            {/* 表面色 */}
                            <div className="space-y-2">
                                <h5 className="font-medium text-sm">表面色</h5>
                                <div className="theme-surface p-3 rounded text-center text-sm border">
                                    theme-surface
                                </div>
                                <div className="theme-surface-secondary p-3 rounded text-center text-sm">
                                    theme-surface-secondary
                                </div>
                                <div className="theme-surface-muted p-3 rounded text-center text-sm">
                                    theme-surface-muted
                                </div>
                                <div className="theme-surface-elevated p-3 rounded text-center text-sm">
                                    theme-surface-elevated
                                </div>
                            </div>

                            {/* 文本色 */}
                            <div className="space-y-2">
                                <h5 className="font-medium text-sm">文本色</h5>
                                <div className="theme-surface p-2 rounded">
                                    <div className="theme-text text-sm">theme-text</div>
                                    <div className="theme-text-secondary text-sm">theme-text-secondary</div>
                                    <div className="theme-text-muted text-sm">theme-text-muted</div>
                                    <div className="theme-text-primary text-sm">theme-text-primary</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 组合类演示 */}
                    <div className="space-y-4">
                        <h4 className="text-lg font-semibold">🏗️ 组合类演示</h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* 卡片示例 */}
                            <div className="theme-card p-4 space-y-2">
                                <h6 className="font-medium">主题卡片</h6>
                                <p className="theme-text-secondary text-sm">
                                    使用 <code className="bg-gray-100 px-1 rounded">theme-card</code> 类创建的卡片
                                </p>
                                <div className="flex gap-2">
                                    <button className="theme-button text-sm">主按钮</button>
                                    <button className="theme-button-secondary text-sm">次按钮</button>
                                </div>
                            </div>

                            {/* 表单示例 */}
                            <div className="theme-card p-4 space-y-3">
                                <h6 className="font-medium">表单元素</h6>
                                <input
                                    type="text"
                                    placeholder="输入内容..."
                                    className="theme-input w-full"
                                />
                                <textarea
                                    placeholder="多行输入..."
                                    className="theme-input w-full h-20 resize-none"
                                />
                                <div className="flex gap-2">
                                    <button className="theme-success p-2 rounded text-sm flex-1">保存</button>
                                    <button className="theme-error p-2 rounded text-sm flex-1">删除</button>
                                </div>
                            </div>

                            {/* 交互示例 */}
                            <div className="theme-card p-4 space-y-3">
                                <h6 className="font-medium">交互效果</h6>
                                <div className="theme-interactive theme-surface-secondary p-3 rounded">
                                    <div className="font-medium">可交互卡片</div>
                                    <div className="theme-text-muted text-sm">鼠标悬停查看效果</div>
                                </div>
                                <div className="space-y-2">
                                    <div className="theme-shadow-sm p-2 rounded theme-surface text-center text-sm">shadow-sm</div>
                                    <div className="theme-shadow-md p-2 rounded theme-surface text-center text-sm">shadow-md</div>
                                    <div className="theme-shadow-lg p-2 rounded theme-surface text-center text-sm">shadow-lg</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 代码对比 */}
                    <div className="space-y-4">
                        <h4 className="text-lg font-semibold">📝 使用方式对比</h4>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* 旧方式 */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Badge variant="destructive">旧方式</Badge>
                                    <span className="text-sm text-muted-foreground">复杂且不一致</span>
                                </div>
                                <div className="bg-red-50 border border-red-200 rounded p-3">
                                    <pre className="text-xs text-red-800 overflow-x-auto">{`// 不会动态更新
<div className="bg-primary text-primary-foreground">

// 繁琐的内联样式
<div style={{ 
  backgroundColor: 'hsl(var(--primary))',
  color: 'hsl(var(--primary-foreground))'
}}>

// 混合使用，混乱
<div className="p-4 bg-[var(--color-accent)]">`}</pre>
                                </div>
                            </div>

                            {/* 新方式 */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Badge variant="default" className="bg-green-600">新方式</Badge>
                                    <span className="text-sm text-muted-foreground">简洁且一致</span>
                                </div>
                                <div className="bg-green-50 border border-green-200 rounded p-3">
                                    <pre className="text-xs text-green-800 overflow-x-auto">{`// 主题颜色：语义CSS类
<div className="theme-primary p-4 rounded-lg">

// 布局：继续使用Tailwind
<div className="flex items-center gap-4">

// 组合使用：清晰的关注点分离
<div className="theme-surface p-6 rounded-xl 
             flex items-center justify-between
             theme-shadow-lg">

// 状态变化：简单直观
<div className="theme-success p-2 rounded">`}</pre>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 优势总结 */}
                    <div className="theme-surface-secondary p-6 rounded-lg">
                        <h4 className="font-semibold text-green-700 mb-4">✨ 新CSS类系统优势</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-green-600">✅</span>
                                    <span><strong>自动响应主题变化</strong> - CSS变量让颜色动态更新</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-green-600">✅</span>
                                    <span><strong>语义化命名</strong> - 一目了然的类名，易于理解</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-green-600">✅</span>
                                    <span><strong>关注点分离</strong> - 颜色和布局分离，职责清晰</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-green-600">✅</span>
                                    <span><strong>易于维护</strong> - 修改CSS变量即可全局更新</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-green-600">✅</span>
                                    <span><strong>开发效率高</strong> - 减少重复代码，提升开发速度</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-green-600">✅</span>
                                    <span><strong>团队一致性</strong> - 统一的使用规范，减少分歧</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* UI组件测试区域 */}
                    <div className="space-y-6">
                        <h4 className="text-lg font-semibold">🧪 UI组件测试区域</h4>

                        {/* 基础组件测试 */}
                        <div className="space-y-6">
                            <div className="space-y-4">
                                <h5 className="font-medium text-base">按钮组件测试</h5>

                                <div className="space-y-3">
                                    <h6 className="text-sm font-medium text-muted-foreground">按钮变体</h6>
                                    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                                        <Button variant="default">Default</Button>
                                        <Button variant="soft">Soft</Button>
                                        <Button variant="outline">Outline</Button>
                                        <Button variant="ghost">Ghost</Button>
                                        <Button variant="destructive">Destructive</Button>
                                        <Button variant="secondary">Secondary</Button>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h6 className="text-sm font-medium text-muted-foreground">按钮尺寸</h6>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                        <Button size="xs">Extra Small</Button>
                                        <Button size="sm">Small</Button>
                                        <Button size="default">Default</Button>
                                        <Button size="lg">Large</Button>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h6 className="text-sm font-medium text-muted-foreground">按钮状态</h6>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                        <Button>正常状态</Button>
                                        <Button disabled>禁用状态</Button>
                                        <Button className="loading">
                                            <svg className="animate-spin -ml-1 mr-3 h-4 w-4" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            加载中...
                                        </Button>
                                        <Button
                                            onClick={() => alert('按钮被点击了！')}
                                            className="hover:shadow-lg transition-shadow"
                                        >
                                            点击测试
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            <div className="space-y-4">
                                <h5 className="font-medium text-base">徽章组件测试</h5>
                                <div className="flex flex-wrap gap-2">
                                    <Badge variant="default">Default</Badge>
                                    <Badge variant="secondary">Secondary</Badge>
                                    <Badge variant="success">Success</Badge>
                                    <Badge variant="warning">Warning</Badge>
                                    <Badge variant="destructive">Error</Badge>
                                    <Badge variant="info">Info</Badge>
                                    <Badge variant="soft">Soft</Badge>
                                    <Badge variant="outline">Outline</Badge>
                                </div>
                            </div>

                            <Separator />

                            <div className="space-y-4">
                                <h5 className="font-medium text-base">表单组件测试</h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                        <Input placeholder="普通输入框" />
                                        <Input placeholder="禁用状态" disabled />
                                        <Input placeholder="错误状态" className="border-red-500" />

                                        <div className="space-y-2">
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="check1"
                                                    checked={checkedItems.check1}
                                                    onCheckedChange={(checked) =>
                                                        setCheckedItems(prev => ({ ...prev, check1: checked === true }))
                                                    }
                                                />
                                                <label htmlFor="check1" className="text-sm">
                                                    复选框选项 {checkedItems.check1 ? '✓' : '○'}
                                                </label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="check2"
                                                    checked={checkedItems.check2}
                                                    onCheckedChange={(checked) =>
                                                        setCheckedItems(prev => ({ ...prev, check2: checked === true }))
                                                    }
                                                />
                                                <label htmlFor="check2" className="text-sm">
                                                    默认选中 {checkedItems.check2 ? '✓' : '○'}
                                                </label>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center space-x-2">
                                                <Switch
                                                    id="switch1"
                                                    checked={switchStates.switch1}
                                                    onCheckedChange={(checked) =>
                                                        setSwitchStates(prev => ({ ...prev, switch1: checked }))
                                                    }
                                                />
                                                <label htmlFor="switch1" className="text-sm">
                                                    开关组件 {switchStates.switch1 ? 'ON' : 'OFF'}
                                                </label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Switch
                                                    id="switch2"
                                                    checked={switchStates.switch2}
                                                    onCheckedChange={(checked) =>
                                                        setSwitchStates(prev => ({ ...prev, switch2: checked }))
                                                    }
                                                />
                                                <label htmlFor="switch2" className="text-sm">
                                                    默认开启 {switchStates.switch2 ? 'ON' : 'OFF'}
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <label className="text-sm font-medium">交互式进度条</label>
                                                <span className="text-sm text-muted-foreground">{progress}%</span>
                                            </div>
                                            <Progress value={progress} />
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    onClick={() => setProgress(prev => Math.max(0, prev - 10))}
                                                    disabled={progress === 0}
                                                >
                                                    -10%
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    onClick={() => setProgress(prev => Math.min(100, prev + 10))}
                                                    disabled={progress === 100}
                                                >
                                                    +10%
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setProgress(0)}
                                                >
                                                    重置
                                                </Button>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">静态进度条</label>
                                                <Progress value={25} />
                                                <Progress value={50} />
                                                <Progress value={75} />
                                                <Progress value={100} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            <div className="space-y-4">
                                <h5 className="font-medium text-base">提示组件测试</h5>
                                <div className="space-y-3">
                                    <Alert>
                                        <Info className="h-4 w-4" />
                                        <AlertTitle>信息提示</AlertTitle>
                                        <AlertDescription>
                                            这是一个默认的信息提示框，用于显示一般信息。
                                        </AlertDescription>
                                    </Alert>

                                    <Alert variant="destructive">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertTitle>错误提示</AlertTitle>
                                        <AlertDescription>
                                            这是一个错误提示框，用于显示错误信息和警告。
                                        </AlertDescription>
                                    </Alert>
                                </div>
                            </div>

                            <Separator />

                            <div className="space-y-4">
                                <h5 className="font-medium text-base">加载状态测试</h5>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Skeleton className="h-4 w-full" />
                                        <Skeleton className="h-4 w-3/4" />
                                        <Skeleton className="h-4 w-1/2" />
                                    </div>
                                    <div className="space-y-2">
                                        <Skeleton className="h-12 w-12 rounded-full" />
                                        <Skeleton className="h-4 w-full" />
                                        <Skeleton className="h-4 w-2/3" />
                                    </div>
                                    <div className="space-y-2">
                                        <Skeleton className="h-20 w-full rounded" />
                                        <Skeleton className="h-4 w-full" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Separator className="my-8" />

                        {/* 定制组件测试 */}
                        <div className="space-y-6">
                            <h5 className="font-medium text-base">🎯 Research Navigator 定制组件测试</h5>

                            <div className="space-y-4">
                                <h6 className="text-sm font-medium text-muted-foreground">统计卡片 (StatCard)</h6>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                    <StatCard value="156" label="收藏文献" variant="blue" />
                                    <StatCard value="89" label="已读论文" variant="green" />
                                    <StatCard value="23" label="待读清单" variant="yellow" />
                                    <StatCard value="7" label="研究项目" variant="red" />
                                    <StatCard value="42" label="引用次数" variant="cyan" />
                                    <StatCard value="3" label="合作者" variant="gray" />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h6 className="text-sm font-medium text-muted-foreground">功能卡片 (FeatureCard)</h6>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <FeatureCard
                                        title="文献搜索"
                                        description="搜索最新的学术文献和研究论文"
                                        icon={<Search className="h-5 w-5" />}
                                        variant="blue"
                                    />
                                    <FeatureCard
                                        title="研究管理"
                                        description="管理你的研究项目和进度"
                                        icon={<BookOpen className="h-5 w-5" />}
                                        variant="green"
                                    />
                                    <FeatureCard
                                        title="数据分析"
                                        description="分析研究数据和趋势"
                                        icon={<TrendingUp className="h-5 w-5" />}
                                        variant="cyan"
                                    />
                                    <FeatureCard
                                        title="团队协作"
                                        description="与研究团队协作交流"
                                        icon={<Users className="h-5 w-5" />}
                                        variant="yellow"
                                    />
                                    <FeatureCard
                                        title="系统设置"
                                        description="配置个人偏好和系统设置"
                                        icon={<Settings className="h-5 w-5" />}
                                        variant="gray"
                                    />
                                    <FeatureCard
                                        title="通知中心"
                                        description="查看最新的通知和提醒"
                                        icon={<Bell className="h-5 w-5" />}
                                        variant="red"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h6 className="text-sm font-medium text-muted-foreground">活动时间线 (ActivityItem)</h6>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <ActivityItem
                                            title="添加了新文献"
                                            timestamp="2小时前"
                                            icon={<Plus className="h-4 w-4" />}
                                            variant="success"
                                        />
                                        <ActivityItem
                                            title="完成了文献阅读"
                                            timestamp="5小时前"
                                            icon={<CheckCircle className="h-4 w-4" />}
                                            variant="primary"
                                        />
                                        <ActivityItem
                                            title="更新了研究笔记"
                                            timestamp="1天前"
                                            icon={<Settings className="h-4 w-4" />}
                                            variant="info"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <ActivityItem
                                            title="收到新的协作邀请"
                                            timestamp="2天前"
                                            icon={<Bell className="h-4 w-4" />}
                                            variant="warning"
                                        />
                                        <ActivityItem
                                            title="删除了过期文档"
                                            timestamp="3天前"
                                            icon={<X className="h-4 w-4" />}
                                            variant="error"
                                        />
                                        <ActivityItem
                                            title="创建了研究项目"
                                            timestamp="1周前"
                                            icon={<BookOpen className="h-4 w-4" />}
                                            variant="secondary"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Separator className="my-8" />

                        {/* 主题展示组件 */}
                        {/* <div className="space-y-4">
                            <h5 className="font-medium text-base">🎨 完整主题展示</h5>
                            <p className="text-sm text-muted-foreground">
                                下面的组件展示了所有UI组件在当前主题下的完整效果：
                            </p>
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                                <ThemeShowcase />
                            </div>
                        </div> */}

                        <Separator className="my-8" />

                        {/* 实时主题效果演示 */}
                        <div className="space-y-4">
                            <h5 className="font-medium text-base">🌈 实时主题切换演示</h5>
                            <p className="text-sm text-muted-foreground">
                                在上方主题控制面板中切换主题，观察下面的组件如何实时响应变化：
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {/* 卡片演示 */}
                                <Card className="transition-all duration-300">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-theme-primary"></div>
                                            主题响应卡片
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <div className="flex gap-2">
                                            <Badge variant="default">主色调</Badge>
                                            <Badge variant="success">成功</Badge>
                                            <Badge variant="warning">警告</Badge>
                                        </div>
                                        <Button className="w-full" variant="default">
                                            主题按钮
                                        </Button>
                                        <div className="p-3 rounded bg-theme-surface-secondary">
                                            <p className="text-sm text-theme-text-secondary">
                                                这段文字会根据主题自动调整颜色
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* 表单演示 */}
                                <Card className="transition-all duration-300">
                                    <CardHeader>
                                        <CardTitle>表单主题化</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <Input placeholder="主题化输入框" />
                                        <div className="flex items-center space-x-2">
                                            <Switch id="theme-switch" />
                                            <label htmlFor="theme-switch" className="text-sm">
                                                主题开关
                                            </label>
                                        </div>
                                        <Progress value={75} />
                                        <Alert>
                                            <Info className="h-4 w-4" />
                                            <AlertDescription>
                                                提示框也会跟随主题变化
                                            </AlertDescription>
                                        </Alert>
                                    </CardContent>
                                </Card>

                                {/* 状态演示 */}
                                <Card className="transition-all duration-300">
                                    <CardHeader>
                                        <CardTitle>状态展示</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <div className="grid grid-cols-2 gap-2">
                                            <StatCard value="24" label="主色调" variant="blue" />
                                            <StatCard value="18" label="成功" variant="green" />
                                            <StatCard value="12" label="警告" variant="yellow" />
                                            <StatCard value="6" label="错误" variant="red" />
                                        </div>
                                        <div className="space-y-2">
                                            <ActivityItem
                                                title="主题已更新"
                                                timestamp="刚刚"
                                                icon={<CheckCircle className="h-4 w-4" />}
                                                variant="success"
                                            />
                                            <ActivityItem
                                                title="颜色方案已切换"
                                                timestamp="1分钟前"
                                                icon={<Settings className="h-4 w-4" />}
                                                variant="info"
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <Alert className="border-blue-200 bg-blue-50">
                                <Info className="h-4 w-4" />
                                <AlertTitle>💡 测试提示</AlertTitle>
                                <AlertDescription>
                                    尝试在上方的主题控制面板中切换不同的颜色预设和主题模式，
                                    观察所有组件如何平滑地响应主题变化。这展示了我们新的CSS类系统的强大之处！
                                </AlertDescription>
                            </Alert>
                        </div>
                    </div>

                    {/* 迁移指南 */}
                    <div className="theme-surface-muted p-6 rounded-lg">
                        <h4 className="font-semibold mb-4">📋 迁移指南</h4>
                        <div className="space-y-3 text-sm">
                            <div className="flex items-start gap-3">
                                <Badge variant="outline">Step 1</Badge>
                                <div>
                                    <div className="font-medium">识别现有的颜色使用</div>
                                    <div className="text-muted-foreground">
                                        查找项目中使用 <code>bg-primary</code>、<code>text-blue-600</code> 等Tailwind颜色类的地方
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <Badge variant="outline">Step 2</Badge>
                                <div>
                                    <div className="font-medium">替换为主题类</div>
                                    <div className="text-muted-foreground">
                                        使用对应的主题类：<code>bg-primary</code> → <code>theme-primary</code>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <Badge variant="outline">Step 3</Badge>
                                <div>
                                    <div className="font-medium">测试主题切换</div>
                                    <div className="text-muted-foreground">
                                        确保在浅色/深色主题下都能正常显示
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export function CSSClassSystemDemo() {
    return (
        <ThemeProvider>
            <CSSClassSystemDemoContent />
        </ThemeProvider>
    );
}
