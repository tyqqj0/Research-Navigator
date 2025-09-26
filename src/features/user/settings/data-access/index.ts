/**
 * Settings Data Access Layer - 设置数据访问层
 */

// Types
export * from './settings-types';

// Store
export * from './settings-store';

// Repository
export * from './settings-repository';

// Convenience hooks for dataset settings
import { useSettingsStore } from './settings-store';
export const useDatasetSettings = () => {
    const settings = useSettingsStore((state) => state.dataset);
    const updateSettings = useSettingsStore((state) => state.updateDatasetSettings);
    return { settings, updateSettings };
};
