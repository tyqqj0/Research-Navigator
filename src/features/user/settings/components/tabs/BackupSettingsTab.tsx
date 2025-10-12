/**
 * Backup Settings Tab - 备份管理选项卡
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Download,
    Upload,
    Trash2,
    Save,
    RotateCcw,
    FileText,
    Calendar,
    AlertTriangle
} from 'lucide-react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

import { useSettingsStore } from '../../data-access';
import { downloadArchiveJson, uploadAndImportArchiveJson } from '@/lib/archive/backup';
import { settingsRepository } from '../../data-access/settings-repository';

interface BackupInfo {
    key: string;
    label: string;
    createdAt: string;
    version: string;
}

export function BackupSettingsTab() {
    const settings = useSettingsStore();
    const [backups, setBackups] = useState<BackupInfo[]>([]);
    const [backupLabel, setBackupLabel] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [stats, setStats] = useState<{
        totalProviders: number;
        configuredProviders: number;
        enabledFeatures: string[];
        lastUpdated: string;
    } | null>(null);

    const loadBackups = useCallback(async () => {
        try {
            const backupList = await settingsRepository.getBackups();
            setBackups(backupList);
        } catch (error) {
            console.error('Failed to load backups:', error);
        }
    }, []);

    const loadStats = useCallback(async () => {
        try {
            const settingsStats = await settingsRepository.getSettingsStats(settings);
            setStats(settingsStats);
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    }, [settings]);

    // 加载备份列表
    useEffect(() => {
        loadBackups();
        loadStats();
    }, [loadBackups, loadStats]);

    const handleCreateBackup = async () => {
        if (!backupLabel.trim()) return;

        setIsLoading(true);
        try {
            await settingsRepository.createBackup(settings, backupLabel);
            setBackupLabel('');
            await loadBackups();
        } catch (error) {
            console.error('Failed to create backup:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRestoreBackup = async (backupKey: string) => {
        setIsLoading(true);
        try {
            const restoredSettings = await settingsRepository.restoreBackup(backupKey);
            if (restoredSettings) {
                settings.updateSettings(restoredSettings);
            }
        } catch (error) {
            console.error('Failed to restore backup:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteBackup = async (backupKey: string) => {
        setIsLoading(true);
        try {
            await settingsRepository.deleteBackup(backupKey);
            await loadBackups();
        } catch (error) {
            console.error('Failed to delete backup:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleExportSettings = async () => {
        try {
            await settingsRepository.exportToFile(settings);
        } catch (error) {
            console.error('Failed to export settings:', error);
        }
    };

    // New: full archive export/import (sessions/messages/events/artifacts/graphs/collections/settings)
    const handleExportArchive = async () => {
        setIsLoading(true);
        try {
            await downloadArchiveJson();
        } catch (error) {
            console.error('Failed to export archive:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleImportArchive = async () => {
        setIsLoading(true);
        try {
            const res = await uploadAndImportArchiveJson();
            if (res?.warnings?.length) {
                console.warn('[BackupSettings] import warnings:', res.warnings);
            }
        } catch (error) {
            console.error('Failed to import archive:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleImportSettings = async () => {
        try {
            const importedSettings = await settingsRepository.importFromFile();
            if (importedSettings) {
                settings.updateSettings(importedSettings);
                await loadStats();
            }
        } catch (error) {
            console.error('Failed to import settings:', error);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('zh-CN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="space-y-6">
            {/* 设置统计 */}
            {stats && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-primary" />
                            设置概览
                        </CardTitle>
                        <CardDescription>
                            当前设置的统计信息
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="text-center p-3 bg-muted/20 rounded-lg">
                                <div className="text-2xl font-bold text-primary">{stats.configuredProviders}</div>
                                <div className="text-sm text-muted-foreground">已配置提供商</div>
                                <div className="text-xs text-muted-foreground">/ {stats.totalProviders} 总计</div>
                            </div>
                            <div className="text-center p-3 bg-muted/20 rounded-lg">
                                <div className="text-2xl font-bold text-green-600">{stats.enabledFeatures.length}</div>
                                <div className="text-sm text-muted-foreground">启用功能</div>
                                <div className="text-xs text-muted-foreground">
                                    {stats.enabledFeatures.join(', ') || '无'}
                                </div>
                            </div>
                            <div className="text-center p-3 bg-muted/20 rounded-lg">
                                <div className="text-2xl font-bold text-purple-600">{backups.length}</div>
                                <div className="text-sm text-muted-foreground">本地备份</div>
                                <div className="text-xs text-muted-foreground">个备份文件</div>
                            </div>
                            <div className="text-center p-3 bg-muted/20 rounded-lg">
                                <div className="text-2xl font-bold text-orange-600">
                                    {Math.floor((new Date().getTime() - new Date(stats.lastUpdated).getTime()) / (1000 * 60 * 60 * 24))}
                                </div>
                                <div className="text-sm text-muted-foreground">天前更新</div>
                                <div className="text-xs text-muted-foreground">最后修改</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* 备份管理 */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Save className="w-5 h-5 text-primary" />
                        创建备份
                    </CardTitle>
                    <CardDescription>
                        为当前设置创建备份，以便日后恢复
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <Label htmlFor="backupLabel">备份标签</Label>
                            <Input
                                id="backupLabel"
                                value={backupLabel}
                                onChange={(e) => setBackupLabel(e.target.value)}
                                placeholder="例如：完整配置-2024"
                            />
                        </div>
                        <div className="flex items-end">
                            <Button
                                onClick={handleCreateBackup}
                                disabled={!backupLabel.trim() || isLoading}
                            >
                                <Save className="w-4 h-4 mr-2" />
                                创建备份
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 备份列表 */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <RotateCcw className="w-5 h-5 text-primary" />
                        本地备份
                    </CardTitle>
                    <CardDescription>
                        管理已创建的设置备份
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {backups.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Save className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p>暂无备份</p>
                            <p className="text-sm">创建第一个备份来保护您的设置</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {backups.map((backup) => (
                                <div key={backup.key} className="flex items-center justify-between p-3 border rounded-lg">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-medium">{backup.label}</h4>
                                            <Badge variant="outline">v{backup.version}</Badge>
                                        </div>
                                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                            <Calendar className="w-3 h-3" />
                                            <span>{formatDate(backup.createdAt)}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="outline" size="sm">
                                                    <RotateCcw className="w-3 h-3 mr-1" />
                                                    恢复
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>恢复备份</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        确定要恢复备份 &ldquo;{backup.label}&rdquo; 吗？当前设置将被覆盖。
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>取消</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleRestoreBackup(backup.key)}>
                                                        恢复
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>

                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="outline" size="sm">
                                                    <Trash2 className="w-3 h-3 mr-1" />
                                                    删除
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>删除备份</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        确定要删除备份 &ldquo;{backup.label}&rdquo; 吗？此操作无法撤销。
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>取消</AlertDialogCancel>
                                                    <AlertDialogAction
                                                        onClick={() => handleDeleteBackup(backup.key)}
                                                        className="bg-destructive hover:bg-destructive/90"
                                                    >
                                                        删除
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* 导入导出 */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-primary" />
                        导入导出
                    </CardTitle>
                    <CardDescription>
                        将设置导出为文件或从文件导入设置
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col gap-3">
                        <div className="flex gap-2">
                            <Button onClick={handleExportSettings} className="flex-1">
                                <Download className="w-4 h-4 mr-2" />
                                导出设置
                            </Button>
                            <Button onClick={handleImportSettings} variant="outline" className="flex-1">
                                <Upload className="w-4 h-4 mr-2" />
                                导入设置
                            </Button>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={handleExportArchive} disabled={isLoading} className="flex-1">
                                <Download className="w-4 h-4 mr-2" />
                                导出应用数据（JSON）
                            </Button>
                            <Button onClick={handleImportArchive} disabled={isLoading} variant="outline" className="flex-1">
                                <Upload className="w-4 h-4 mr-2" />
                                导入应用数据（JSON）
                            </Button>
                        </div>
                    </div>

                    <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                            导入设置将覆盖当前所有配置。建议在导入前先创建备份。
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>

            {/* 重置设置 */}
            <Card className="border-destructive/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="w-5 h-5" />
                        危险操作
                    </CardTitle>
                    <CardDescription>
                        重置所有设置到默认状态
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive">
                                <RotateCcw className="w-4 h-4 mr-2" />
                                重置所有设置
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>重置设置</AlertDialogTitle>
                                <AlertDialogDescription>
                                    确定要重置所有设置到默认状态吗？所有自定义配置将丢失，此操作无法撤销。
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={settings.resetSettings}
                                    className="bg-destructive hover:bg-destructive/90"
                                >
                                    重置
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardContent>
            </Card>
        </div>
    );
}
