/**
 * UI Settings Tab - 界面设置选项卡
 */

'use client';

import { Palette, Eye, Bug } from 'lucide-react';
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
import { ThemeSelector } from './ThemeSelector';

const LANGUAGES = [
    { value: 'system', label: '跟随系统', flag: '🌐' },
    { value: 'zh', label: '中文', flag: '🇨🇳' },
    { value: 'en', label: 'English', flag: '🇺🇸' },
    { value: 'ja', label: '日本語', flag: '🇯🇵' },
    { value: 'ko', label: '한국어', flag: '🇰🇷' },
    { value: 'fr', label: 'Français', flag: '🇫🇷' },
    { value: 'de', label: 'Deutsch', flag: '🇩🇪' },
    { value: 'es', label: 'Español', flag: '🇪🇸' }
];

export function UISettingsTab() {
    const { settings, updateSettings } = useUISettings();

    return (
        <div className="space-y-6">
            {/* 主题设置 */}
            <ThemeSelector />

            {/* 界面设置 */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Palette className="w-5 h-5 text-primary" />
                        界面设置
                    </CardTitle>
                    <CardDescription>
                        语言和其他界面选项
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
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
                        <Eye className="w-5 h-5 text-primary" />
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


        </div>
    );
}
