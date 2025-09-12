/**
 * 📚 Literature Store - 纯粹的数据存储层
 * 
 * 🎯 核心职责：
 * 1. 存储规范化的文献数据（唯一数据源）
 * 2. 提供原子化的数据操作（同步CRUD）
 * 3. 提供简单的数据查询（基础选择器）
 * 
 * ❌ 不负责的事情：
 * - UI状态管理（loading、selection等）
 * - 业务逻辑编排（搜索、分页等）
 * - API调用和错误处理
 * - 复杂的数据组合和计算
 * 
 * 架构定位：
 * - 这是"中央仓库"，只管货物的进出和存放
 * - Hook层负责"产品经理"角色，组合数据为UI服务
 * - Service层负责"采购和物流"，与外界打交道
 */

import { create } from 'zustand';
import { subscribeWithSelector, devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import '@/lib/immer-config';
import type { EnhancedLibraryItem } from '../models';

// ==================== Store State Interface ====================

export interface LiteratureStoreState {
    // 📚 核心数据 - 规范化存储（Map提供O(1)查找）
    literatures: Map<string, EnhancedLibraryItem>;

    // 📊 简单统计（可选的派生数据）
    stats: {
        total: number;
        lastUpdated: Date | null;
    };
}

// ==================== Store Actions Interface ====================

export interface LiteratureStoreActions {
    // 📚 数据操作 - 原子化的同步操作
    addLiterature: (literature: EnhancedLibraryItem) => void;
    addLiteratures: (literatures: EnhancedLibraryItem[]) => void;
    updateLiterature: (paperId: string, literature: EnhancedLibraryItem) => void;
    removeLiterature: (paperId: string) => void;
    removeLiteratures: (paperIds: string[]) => void;
    clearLiteratures: () => void;
    replaceLiteratures: (literatures: EnhancedLibraryItem[]) => void;

    // 📊 数据查询 - 简单的选择器
    getLiterature: (paperId: string) => EnhancedLibraryItem | undefined;
    getAllLiteratures: () => EnhancedLibraryItem[];
    getLiteratures: (paperIds: string[]) => EnhancedLibraryItem[];
    hasLiterature: (paperId: string) => boolean;

    // 📈 统计更新
    updateStats: () => void;
}

// ==================== Initial State ====================

const initialState: LiteratureStoreState = {
    literatures: new Map(),
    stats: {
        total: 0,
        lastUpdated: null,
    },
};

// ==================== Store Implementation ====================

export const useLiteratureStore = create<LiteratureStoreState & LiteratureStoreActions>()(
    devtools(
        subscribeWithSelector(
            immer((set, get) => ({
                ...initialState,

                // 📚 数据操作 - 原子化操作
                addLiterature: (literature) => {
                    set((state) => {
                        state.literatures.set(literature.literature.paperId, literature);
                    });
                    get().updateStats();
                },

                addLiteratures: (literatures) => {
                    set((state) => {
                        literatures.forEach(literature => {
                            state.literatures.set(literature.literature.paperId, literature);
                        });
                    });
                    get().updateStats();
                },

                updateLiterature: (paperId, literature) => {
                    set((state) => {
                        if (state.literatures.has(paperId)) {
                            state.literatures.set(paperId, literature);
                        }
                    });
                    get().updateStats();
                },

                removeLiterature: (paperId) => {
                    set((state) => {
                        state.literatures.delete(paperId);
                    });
                    get().updateStats();
                },

                removeLiteratures: (paperIds) => {
                    set((state) => {
                        paperIds.forEach(paperId => state.literatures.delete(paperId));
                    });
                    get().updateStats();
                },

                clearLiteratures: () => {
                    set((state) => {
                        state.literatures.clear();
                    });
                    get().updateStats();
                },

                replaceLiteratures: (literatures) => {
                    set((state) => {
                        state.literatures.clear();
                        literatures.forEach(literature => {
                            state.literatures.set(literature.literature.paperId, literature);
                        });
                    });
                    get().updateStats();
                },

                // 📊 数据查询 - 简单选择器
                getLiterature: (paperId) => {
                    return get().literatures.get(paperId);
                },

                getAllLiteratures: () => {
                    return Array.from(get().literatures.values());
                },

                getLiteratures: (paperIds) => {
                    const { literatures } = get();
                    return paperIds
                        .map(paperId => literatures.get(paperId))
                        .filter(Boolean) as EnhancedLibraryItem[];
                },

                hasLiterature: (paperId) => {
                    return get().literatures.has(paperId);
                },

                // 📈 统计更新
                updateStats: () => {
                    set((state) => {
                        state.stats.total = state.literatures.size;
                        state.stats.lastUpdated = new Date();
                    });
                },
            }))
        ),
        {
            name: 'literature-store',
            // 数据不持久化，每次重新加载
            partialize: () => ({}),
        }
    )
);

// ==================== Selectors ====================

// 📚 基础数据选择器
export const selectAllLiteratures = (state: LiteratureStoreState & LiteratureStoreActions) =>
    state.getAllLiteratures();

export const selectLiteratureById = (paperId: string) =>
    (state: LiteratureStoreState & LiteratureStoreActions) =>
        state.getLiterature(paperId);

export const selectLiteratureCount = (state: LiteratureStoreState & LiteratureStoreActions) =>
    state.stats.total;

// 用户相关选择器已移除，在Hook层处理

// 📊 统计选择器
export const selectStats = (state: LiteratureStoreState & LiteratureStoreActions) =>
    state.stats;

// ==================== 默认导出 ====================

export default useLiteratureStore;