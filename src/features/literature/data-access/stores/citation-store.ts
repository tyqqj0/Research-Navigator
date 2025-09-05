/**
 * 🔗 Citation Store - 纯粹的引用数据存储层（只读）
 * 
 * 🎯 核心职责：
 * 1. 存储规范化的引用网络数据（只读）
 * 2. 提供原子化的数据操作（同步更新）
 * 3. 提供简单的数据查询（基础选择器）
 * 
 * ❌ 不负责的事情：
 * - UI状态管理（loading、selection、viewMode等）
 * - 业务逻辑编排（网络构建、分析等）
 * - API调用和错误处理
 * - 复杂的图形算法和计算
 * 
 * 架构定位：
 * - 专门管理引用关系数据的"只读仓库"
 * - 数据来源于后端，本地不支持修改
 * - Hook层负责数据获取和复杂分析
 */

import { create } from 'zustand';
import { subscribeWithSelector, devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
    Citation,
    CitationOverview,
} from '../models';

// ==================== Store State Interface ====================

export interface CitationStoreState {
    // 🔗 引用关系数据 - 核心数据存储
    citations: Record<string, Citation>; // key: citationId

    // 📊 引用概览数据 - 按文献ID索引
    overviews: Record<string, CitationOverview>; // key: lid

    // 📊 简单统计
    stats: {
        totalCitations: number;
        totalOverviews: number;
        lastUpdated: Date | null;
    };
}

// ==================== Store Actions Interface ====================

export interface CitationStoreActions {
    // 🔗 引用数据操作 - 原子化操作
    addCitation: (citation: Citation) => void;
    addCitations: (citations: Citation[]) => void;
    updateCitation: (citationId: string, citation: Citation) => void;
    removeCitation: (citationId: string) => void;
    removeCitations: (citationIds: string[]) => void;
    clearCitations: () => void;
    replaceCitations: (citations: Citation[]) => void;

    // 📊 概览数据操作
    addOverview: (lid: string, overview: CitationOverview) => void;
    updateOverview: (lid: string, overview: CitationOverview) => void;
    removeOverview: (lid: string) => void;
    clearOverviews: () => void;

    // 📊 数据查询 - 简单的选择器
    getCitation: (citationId: string) => Citation | undefined;
    getAllCitations: () => Citation[];
    getCitations: (citationIds: string[]) => Citation[];
    getCitationsByLid: (lid: string) => Citation[];
    getIncomingCitations: (lid: string) => Citation[];
    getOutgoingCitations: (lid: string) => Citation[];
    getOverview: (lid: string) => CitationOverview | undefined;
    getAllOverviews: () => CitationOverview[];
    hasCitation: (citationId: string) => boolean;

    // 📈 统计更新
    updateStats: () => void;
}

// ==================== Initial State ====================

const initialState: CitationStoreState = {
    citations: {},
    overviews: {},
    stats: {
        totalCitations: 0,
        totalOverviews: 0,
        lastUpdated: null,
    },
};

// ==================== Store Implementation ====================

export const useCitationStore = create<CitationStoreState & CitationStoreActions>()(
    devtools(
        subscribeWithSelector(
            immer((set, get) => ({
                ...initialState,

                // 🔗 引用数据操作
                addCitation: (citation) => {
                    set((state) => {
                        // 使用sourceItemId-targetItemId作为唯一键
                        const citationId = `${citation.sourceItemId}-${citation.targetItemId}`;
                        state.citations[citationId] = citation;
                    });
                    get().updateStats();
                },

                addCitations: (citations) => {
                    set((state) => {
                        citations.forEach(citation => {
                            const citationId = `${citation.sourceItemId}-${citation.targetItemId}`;
                            state.citations[citationId] = citation;
                        });
                    });
                    get().updateStats();
                },

                updateCitation: (citationId, citation) => {
                    set((state) => {
                        if (state.citations[citationId]) {
                            state.citations[citationId] = citation;
                        }
                    });
                    get().updateStats();
                },

                removeCitation: (citationId) => {
                    set((state) => {
                        delete state.citations[citationId];
                    });
                    get().updateStats();
                },

                removeCitations: (citationIds) => {
                    set((state) => {
                        citationIds.forEach(id => delete state.citations[id]);
                    });
                    get().updateStats();
                },

                clearCitations: () => {
                    set((state) => {
                        state.citations = {};
                    });
                    get().updateStats();
                },

                replaceCitations: (citations) => {
                    set((state) => {
                        state.citations = {};
                        citations.forEach(citation => {
                            const citationId = `${citation.sourceItemId}-${citation.targetItemId}`;
                            state.citations[citationId] = citation;
                        });
                    });
                    get().updateStats();
                },

                // 📊 概览数据操作
                addOverview: (lid, overview) => {
                    set((state) => {
                        state.overviews[lid] = overview;
                    });
                    get().updateStats();
                },

                updateOverview: (lid, overview) => {
                    set((state) => {
                        if (state.overviews[lid]) {
                            state.overviews[lid] = overview;
                        }
                    });
                },

                removeOverview: (lid) => {
                    set((state) => {
                        delete state.overviews[lid];
                    });
                    get().updateStats();
                },

                clearOverviews: () => {
                    set((state) => {
                        state.overviews = {};
                    });
                    get().updateStats();
                },

                // 📊 数据查询
                getCitation: (citationId) => {
                    return get().citations[citationId];
                },

                getAllCitations: () => {
                    return Object.values(get().citations);
                },

                getCitations: (citationIds) => {
                    const { citations } = get();
                    return citationIds
                        .map(id => citations[id])
                        .filter(Boolean) as Citation[];
                },

                getCitationsByLid: (lid) => {
                    const { citations } = get();
                    return Object.values(citations).filter(
                        citation => citation.sourceItemId === lid || citation.targetItemId === lid
                    );
                },

                getIncomingCitations: (lid) => {
                    const { citations } = get();
                    return Object.values(citations).filter(
                        citation => citation.targetItemId === lid
                    );
                },

                getOutgoingCitations: (lid) => {
                    const { citations } = get();
                    return Object.values(citations).filter(
                        citation => citation.sourceItemId === lid
                    );
                },

                getOverview: (lid) => {
                    return get().overviews[lid];
                },

                getAllOverviews: () => {
                    return Object.values(get().overviews);
                },

                hasCitation: (citationId) => {
                    return !!get().citations[citationId];
                },

                // 📈 统计更新
                updateStats: () => {
                    set((state) => {
                        state.stats.totalCitations = Object.keys(state.citations).length;
                        state.stats.totalOverviews = Object.keys(state.overviews).length;
                        state.stats.lastUpdated = new Date();
                    });
                },
            }))
        ),
        {
            name: 'citation-store',
            // 引用数据不需要持久化，每次重新加载
            partialize: () => ({}),
        }
    )
);

// ==================== Selectors ====================

// 🔗 引用选择器
export const selectAllCitations = (state: CitationStoreState & CitationStoreActions) =>
    state.getAllCitations();

export const selectCitationById = (citationId: string) =>
    (state: CitationStoreState & CitationStoreActions) =>
        state.getCitation(citationId);

export const selectCitationsByLid = (lid: string) =>
    (state: CitationStoreState & CitationStoreActions) =>
        state.getCitationsByLid(lid);

export const selectIncomingCitations = (lid: string) =>
    (state: CitationStoreState & CitationStoreActions) =>
        state.getIncomingCitations(lid);

export const selectOutgoingCitations = (lid: string) =>
    (state: CitationStoreState & CitationStoreActions) =>
        state.getOutgoingCitations(lid);

// 📊 概览选择器
export const selectAllOverviews = (state: CitationStoreState & CitationStoreActions) =>
    state.getAllOverviews();

export const selectOverviewByLid = (lid: string) =>
    (state: CitationStoreState & CitationStoreActions) =>
        state.getOverview(lid);

// 📈 统计选择器
export const selectCitationCount = (state: CitationStoreState & CitationStoreActions) =>
    state.stats.totalCitations;

export const selectOverviewCount = (state: CitationStoreState & CitationStoreActions) =>
    state.stats.totalOverviews;

export const selectStats = (state: CitationStoreState & CitationStoreActions) =>
    state.stats;

// ==================== 默认导出 ====================

export default useCitationStore;