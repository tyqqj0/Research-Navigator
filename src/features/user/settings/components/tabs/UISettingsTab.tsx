/**
 * UI Settings Tab - 界面设置选项卡
 */

'use client';

import { Palette, Globe, Eye, Bug, Image } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

import { useUISettings } from '../../data-access';

const LANGUAGES = [
    { value: '', label: '跟随系统', flag: '🌐' },
    { value: 'zh', label: '中文', flag: '🇨🇳' },
    { value: 'en', label: 'English', flag: '🇺🇸' },
    { value: 'ja', label: '日本語', flag: '🇯🇵' },
    { value: 'ko', label: '한국어', flag: '🇰🇷' },
    { value: 'fr', label: 'Français', flag: '🇫🇷' },
    { value: 'de', label: 'Deutsch', flag: '🇩🇪' },
    { value: 'es', label: 'Español', flag: '🇪🇸' }
];

const THEMES = [
    { value: 'system', label: '跟随系统', icon: '🌐', description: '根据系统设置自动切换' },
    { value: 'light', label: '浅色模式', icon: '☀️', description: '明亮清爽的界面' },
    { value: 'dark', label: '深色模式', icon: '🌙', description: '护眼的暗色界面' }
];

export function UISettingsTab() {
    const { settings, updateSettings } = useUISettings();

    return (
        <div className="space-y-6">
            {/* 外观设置 */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Palette className="w-5 h-5 text-blue-600" />
                        外观设置
                    </CardTitle>
                    <CardDescription>
                        自定义界面外观和主题
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="theme">主题模式</Label>
                        <Select
                            value={settings.theme}
                            onValueChange={(value) => updateSettings({ theme: value as any })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="选择主题" />
                            </SelectTrigger>
                            <SelectContent>
                                {THEMES.map(theme => (
                                    <SelectItem key={theme.value} value={theme.value}>
                                        <div className="flex items-center gap-3">
                                            <span className="text-lg">{theme.icon}</span>
                                            <div>
                                                <div className="font-medium">{theme.label}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {theme.description}
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
                        <Label htmlFor="language">界面语言</Label>
                        <Select
                            value={settings.language}
                            onValueChange={(value) => updateSettings({ language: value })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="选择语言" />
                            </SelectTrigger>
                            <SelectContent>
                                {LANGUAGES.map(lang => (
                                    <SelectItem key={lang.value} value={lang.value}>
                                        <div className="flex items-center gap-2">
                                            <span>{lang.flag}</span>
                                            <span>{lang.label}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* 功能设置 */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Eye className="w-5 h-5 text-blue-600" />
                        功能设置
                    </CardTitle>
                    <CardDescription>
                        控制界面功能的显示和行为
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <Label htmlFor="references">显示引用</Label>
                                <Badge variant="outline">推荐</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                在回答中显示来源引用和参考链接
                            </p>
                        </div>
                        <Switch
                            id="references"
                            checked={settings.references === 'enable'}
                            onCheckedChange={(checked) =>
                                updateSettings({ references: checked ? 'enable' : 'disable' })
                            }
                        />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <Label htmlFor="citationImage">引用图片</Label>
                                <Badge variant="outline">实验性</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                在引用中显示网站截图和预览图片
                            </p>
                        </div>
                        <Switch
                            id="citationImage"
                            checked={settings.citationImage === 'enable'}
                            onCheckedChange={(checked) =>
                                updateSettings({ citationImage: checked ? 'enable' : 'disable' })
                            }
                        />
                    </div>
                </CardContent>
            </Card>

            {/* 开发者设置 */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Bug className="w-5 h-5 text-orange-600" />
                        开发者设置
                    </CardTitle>
                    <CardDescription>
                        调试和开发相关的高级设置
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <Label htmlFor="debug">调试模式</Label>
                                <Badge variant="destructive">开发者</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                显示详细的调试信息和错误日志
                            </p>
                        </div>
                        <Switch
                            id="debug"
                            checked={settings.debug === 'enable'}
                            onCheckedChange={(checked) =>
                                updateSettings({ debug: checked ? 'enable' : 'disable' })
                            }
                        />
                    </div>
                </CardContent>
            </Card>

            {/* 预览卡片 */}
            <Card>
                <CardHeader>
                    <CardTitle>界面预览</CardTitle>
                    <CardDescription>
                        预览当前设置的界面效果
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="p-4 border rounded-lg bg-muted/20">
                            <h4 className="font-medium mb-2">当前配置</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground">主题:</span>{' '}
                                    {THEMES.find(t => t.value === settings.theme)?.label}
                                </div>
                                <div>
                                    <span className="text-muted-foreground">语言:</span>{' '}
                                    {LANGUAGES.find(l => l.value === settings.language)?.label}
                                </div>
                                <div>
                                    <span className="text-muted-foreground">引用:</span>{' '}
                                    {settings.references === 'enable' ? '显示' : '隐藏'}
                                </div>
                                <div>
                                    <span className="text-muted-foreground">调试:</span>{' '}
                                    {settings.debug === 'enable' ? '开启' : '关闭'}
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
