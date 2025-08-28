/**
 * Research Settings Tab - 研究设置选项卡
 */

'use client';

import { BookOpen, Clock, Save, TreePine, Zap } from 'lucide-react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card';
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
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { useResearchSettings } from '../../data-access';

const EXPANSION_STRATEGIES = [
    {
        value: 'mcts',
        label: 'MCTS (蒙特卡洛树搜索)',
        description: '智能探索，平衡广度和深度',
        badge: '推荐'
    },
    {
        value: 'breadth_first',
        label: '广度优先',
        description: '优先扩展同级节点',
        badge: '稳定'
    },
    {
        value: 'depth_first',
        label: '深度优先',
        description: '优先深入探索单个方向',
        badge: '快速'
    },
    {
        value: 'adaptive',
        label: '自适应策略',
        description: '根据内容动态调整策略',
        badge: '实验性'
    }
];

export function ResearchSettingsTab() {
    const { settings, updateSettings } = useResearchSettings();

    return (
        <div className="space-y-6">
            {/* 研究行为设置 */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-primary" />
                        研究行为
                    </CardTitle>
                    <CardDescription>
                        控制研究过程的行为和策略
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="expansionStrategy">默认扩展策略</Label>
                        <Select
                            value={settings.defaultExpansionStrategy}
                            onValueChange={(value: string) => updateSettings({ defaultExpansionStrategy: value })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="选择扩展策略" />
                            </SelectTrigger>
                            <SelectContent>
                                {EXPANSION_STRATEGIES.map(strategy => (
                                    <SelectItem key={strategy.value} value={strategy.value}>
                                        <div className="flex items-center justify-between w-full">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">{strategy.label}</span>
                                                    <Badge variant="outline">{strategy.badge}</Badge>
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {strategy.description}
                                                </div>
                                            </div>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                        <Label htmlFor="maxTreeDepth">最大树深度</Label>
                        <div className="px-3">
                            <Slider
                                value={[settings.maxTreeDepth || 10]}
                                onValueChange={([value]) => updateSettings({ maxTreeDepth: value })}
                                max={20}
                                min={3}
                                step={1}
                                className="w-full"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                <span>3</span>
                                <span>当前: {settings.maxTreeDepth} 层</span>
                                <span>20</span>
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            控制研究树的最大深度，更深的树可以获得更详细的信息，但需要更多时间
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* 时间管理设置 */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-primary" />
                        时间管理
                    </CardTitle>
                    <CardDescription>
                        控制研究过程中的时间相关设置
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <Label htmlFor="enableTaskWaitingTime">启用任务等待时间</Label>
                            <p className="text-sm text-muted-foreground">
                                在任务之间添加等待时间，避免API限制
                            </p>
                        </div>
                        <Switch
                            id="enableTaskWaitingTime"
                            checked={settings.enableTaskWaitingTime}
                            onCheckedChange={(checked) =>
                                updateSettings({ enableTaskWaitingTime: checked })
                            }
                        />
                    </div>

                    {settings.enableTaskWaitingTime && (
                        <>
                            <Separator />
                            <div className="space-y-2">
                                <Label htmlFor="taskWaitingTime">等待时间 (秒)</Label>
                                <div className="px-3">
                                    <Slider
                                        value={[settings.taskWaitingTime]}
                                        onValueChange={([value]) => updateSettings({ taskWaitingTime: value })}
                                        max={60}
                                        min={1}
                                        step={1}
                                        className="w-full"
                                    />
                                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                        <span>1秒</span>
                                        <span>当前: {settings.taskWaitingTime}秒</span>
                                        <span>60秒</span>
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    推荐设置为10-30秒，以避免触发API速率限制
                                </p>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* 数据管理设置 */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Save className="w-5 h-5 text-primary" />
                        数据管理
                    </CardTitle>
                    <CardDescription>
                        控制数据保存和管理的相关设置
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="autoSaveInterval">自动保存间隔 (秒)</Label>
                        <div className="px-3">
                            <Slider
                                value={[settings.autoSaveInterval || 60]}
                                onValueChange={([value]) => updateSettings({ autoSaveInterval: value })}
                                max={300}
                                min={10}
                                step={10}
                                className="w-full"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                <span>10秒</span>
                                <span>当前: {settings.autoSaveInterval}秒</span>
                                <span>5分钟</span>
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            研究数据自动保存的时间间隔，防止数据丢失
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* 性能优化提示 */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-orange-600" />
                        性能建议
                    </CardTitle>
                    <CardDescription>
                        基于当前设置的性能优化建议
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {(settings.maxTreeDepth || 10) > 15 && (
                        <Alert>
                            <TreePine className="h-4 w-4" />
                            <AlertDescription>
                                当前树深度设置较高 ({settings.maxTreeDepth} 层)，可能会导致研究时间较长。
                                建议在初次使用时设置为 8-12 层。
                            </AlertDescription>
                        </Alert>
                    )}

                    {!settings.enableTaskWaitingTime && (
                        <Alert>
                            <Clock className="h-4 w-4" />
                            <AlertDescription>
                                建议启用任务等待时间，以避免触发API速率限制，确保研究过程的稳定性。
                            </AlertDescription>
                        </Alert>
                    )}

                    {(settings.autoSaveInterval || 60) > 120 && (
                        <Alert>
                            <Save className="h-4 w-4" />
                            <AlertDescription>
                                自动保存间隔较长，建议设置为 30-60 秒以更好地保护您的研究数据。
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="p-3 bg-muted/20 rounded-lg">
                        <h4 className="font-medium text-sm mb-2">当前配置概览</h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>扩展策略: {EXPANSION_STRATEGIES.find(s => s.value === settings.defaultExpansionStrategy)?.label}</div>
                            <div>最大深度: {settings.maxTreeDepth} 层</div>
                            <div>等待时间: {settings.enableTaskWaitingTime ? `${settings.taskWaitingTime}秒` : '禁用'}</div>
                            <div>自动保存: {settings.autoSaveInterval}秒</div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
