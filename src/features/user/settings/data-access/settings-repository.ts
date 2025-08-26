/**
 * Settings Repository - 设置数据仓库
 * 
 * 虽然设置主要通过Zustand的persist中间件持久化，
 * 但这里提供了额外的数据操作功能，如备份、导入导出等
 */

import type { UserSettings } from './settings-types';

export class SettingsRepository {
    private readonly BACKUP_PREFIX = 'settings-backup-';
    private readonly MAX_BACKUPS = 10;

    /**
     * 创建设置备份
     */
    async createBackup(settings: UserSettings, label?: string): Promise<string> {
        const timestamp = new Date().toISOString();
        const backupKey = `${this.BACKUP_PREFIX}${timestamp}${label ? `-${label}` : ''}`;

        const backup = {
            ...settings,
            backupInfo: {
                createdAt: timestamp,
                label: label || 'Auto Backup',
                version: settings.version
            }
        };

        localStorage.setItem(backupKey, JSON.stringify(backup));

        // 清理旧备份
        await this.cleanupOldBackups();

        return backupKey;
    }

    /**
     * 获取所有备份
     */
    async getBackups(): Promise<Array<{
        key: string;
        label: string;
        createdAt: string;
        version: string;
    }>> {
        const backups: Array<{
            key: string;
            label: string;
            createdAt: string;
            version: string;
        }> = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith(this.BACKUP_PREFIX)) {
                try {
                    const backup = JSON.parse(localStorage.getItem(key) || '{}');
                    if (backup.backupInfo) {
                        backups.push({
                            key,
                            label: backup.backupInfo.label,
                            createdAt: backup.backupInfo.createdAt,
                            version: backup.backupInfo.version
                        });
                    }
                } catch (error) {
                    console.warn(`Failed to parse backup ${key}:`, error);
                }
            }
        }

        return backups.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }

    /**
     * 恢复备份
     */
    async restoreBackup(backupKey: string): Promise<UserSettings | null> {
        try {
            const backupData = localStorage.getItem(backupKey);
            if (!backupData) {
                throw new Error('Backup not found');
            }

            const backup = JSON.parse(backupData);
            // 移除备份信息，返回纯设置数据
            const { backupInfo, ...settings } = backup;
            void backupInfo; // Explicitly mark as intentionally unused

            return settings as UserSettings;
        } catch (error) {
            console.error('Failed to restore backup:', error);
            return null;
        }
    }

    /**
     * 删除备份
     */
    async deleteBackup(backupKey: string): Promise<boolean> {
        try {
            localStorage.removeItem(backupKey);
            return true;
        } catch (error) {
            console.error('Failed to delete backup:', error);
            return false;
        }
    }

    /**
     * 导出设置到文件
     */
    async exportToFile(settings: UserSettings, filename?: string): Promise<void> {
        const exportData = {
            ...settings,
            exportInfo: {
                exportedAt: new Date().toISOString(),
                version: settings.version,
                source: 'Research Navigator'
            }
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename || `research-navigator-settings-${new Date().toISOString().split('T')[0]}.json`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);
    }

    /**
     * 从文件导入设置
     */
    async importFromFile(): Promise<UserSettings | null> {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';

            input.onchange = async (event) => {
                const file = (event.target as HTMLInputElement).files?.[0];
                if (!file) {
                    resolve(null);
                    return;
                }

                try {
                    const text = await file.text();
                    const importedData = JSON.parse(text);

                    // 验证导入的数据
                    if (this.validateImportedSettings(importedData)) {
                        // 移除导入信息，返回纯设置数据
                        const { exportInfo, backupInfo, ...settings } = importedData;
                        void exportInfo; void backupInfo; // Explicitly mark as intentionally unused
                        resolve(settings as UserSettings);
                    } else {
                        console.error('Invalid settings format');
                        resolve(null);
                    }
                } catch (error) {
                    console.error('Failed to import settings:', error);
                    resolve(null);
                }
            };

            input.click();
        });
    }

    /**
     * 验证导入的设置格式
     */
    private validateImportedSettings(data: unknown): boolean {
        // 基础结构验证
        if (!data || typeof data !== 'object') {
            return false;
        }

        // 检查必要的字段
        const requiredFields = ['ai', 'search', 'ui', 'research'];
        return requiredFields.every(field => field in data);
    }

    /**
     * 清理旧备份
     */
    private async cleanupOldBackups(): Promise<void> {
        const backups = await this.getBackups();

        if (backups.length > this.MAX_BACKUPS) {
            const backupsToDelete = backups.slice(this.MAX_BACKUPS);

            for (const backup of backupsToDelete) {
                await this.deleteBackup(backup.key);
            }
        }
    }

    /**
     * 获取设置统计信息
     */
    async getSettingsStats(settings: UserSettings): Promise<{
        totalProviders: number;
        configuredProviders: number;
        enabledFeatures: string[];
        lastUpdated: string;
    }> {
        const aiProviders = Object.keys(settings.ai).filter(key =>
            typeof settings.ai[key as keyof typeof settings.ai] === 'object'
        );

        const configuredProviders = aiProviders.filter(provider => {
            const config = settings.ai[provider as keyof typeof settings.ai] as Record<string, unknown>;
            return config && (config.apiKey || config.apiProxy);
        });

        const enabledFeatures = [];
        if (settings.search.enableSearch) enabledFeatures.push('Search');
        if (settings.ui.debug === 'enable') enabledFeatures.push('Debug Mode');
        if (settings.ui.references === 'enable') enabledFeatures.push('References');
        if (settings.research.enableTaskWaitingTime) enabledFeatures.push('Task Waiting');

        return {
            totalProviders: aiProviders.length,
            configuredProviders: configuredProviders.length,
            enabledFeatures,
            lastUpdated: settings.updatedAt.toISOString()
        };
    }
}

// 单例实例
export const settingsRepository = new SettingsRepository();
