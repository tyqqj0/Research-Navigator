/**
 * 🌐 Backend API Service - 后端接口服务
 * 
 * 核心理念: 前端作为智能缓存层，后端处理所有复杂业务逻辑
 * 功能: 文献查重、内容抓取、引用关系获取
 * 设计: API-First + 缓存优化 + 错误处理
 */

import { LibraryItem, ExtendedLibraryItem, BackendTask, LiteratureStatus } from '../types';

/**
 * 📥 文献输入类型
 */
export interface LiteratureInput {
    url?: string;
    doi?: string;
    pdfFile?: File;
    title?: string;
    authors?: string[];
    metadata?: Record<string, any>;
}

/**
 * 📊 批量处理结果
 */
export interface BatchProcessResult {
    taskId: string;
    totalItems: number;
    processedItems: number;
    lids: string[];
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
}

/**
 * 🔗 引用关系结果
 */
export interface CitationNetworkResult {
    lids: string[];
    citations: Array<{
        sourceLid: string;
        targetLid: string;
        citationType: string;
        confidence: number;
    }>;
    metadata: {
        totalNodes: number;
        totalEdges: number;
        analysisTime: number;
    };
}

/**
 * 🌐 Backend API Service
 * 
 * 核心原则：
 * 1. 所有复杂逻辑由后端处理
 * 2. 前端负责缓存和用户体验
 * 3. 支持批量操作和进度跟踪
 * 4. 优雅的错误处理和重试机制
 */
export class BackendApiService {
    private readonly baseUrl: string;
    private readonly apiKey?: string;
    private cache = new Map<string, any>();

    constructor(config: {
        baseUrl: string;
        apiKey?: string;
        timeout?: number;
    }) {
        this.baseUrl = config.baseUrl.replace(/\/$/, ''); // 移除末尾斜杠
        this.apiKey = config.apiKey;
    }

    // ==================== 文献处理 API ====================

    /**
     * 📝 单个文献查重和获取LID
     */
    async resolveLiterature(input: LiteratureInput): Promise<{
        lid: string;
        isNew: boolean;
        literature: LibraryItem;
        taskId?: string;
    }> {
        try {
            console.log('[BackendAPI] Resolving single literature:', input);

            const response = await this.apiRequest('POST', '/api/literature/resolve', {
                url: input.url,
                doi: input.doi,
                title: input.title,
                authors: input.authors,
                metadata: input.metadata
            });

            return {
                lid: response.lid,
                isNew: response.isNew,
                literature: this.mapBackendToFrontend(response.literature),
                taskId: response.taskId
            };
        } catch (error) {
            console.error('[BackendAPI] Failed to resolve literature:', error);
            throw new Error('Failed to resolve literature');
        }
    }

    /**
     * 📦 批量文献处理
     */
    async batchProcessLiterature(
        inputs: LiteratureInput[],
        progressCallback?: (progress: BatchProcessResult) => void
    ): Promise<BatchProcessResult> {
        try {
            console.log(`[BackendAPI] Starting batch process for ${inputs.length} items`);

            // 启动批量任务
            const response = await this.apiRequest('POST', '/api/literature/batch', {
                items: inputs.map(input => ({
                    url: input.url,
                    doi: input.doi,
                    title: input.title,
                    authors: input.authors,
                    metadata: input.metadata
                }))
            });

            const taskId = response.taskId;
            let result: BatchProcessResult = {
                taskId,
                totalItems: inputs.length,
                processedItems: 0,
                lids: [],
                status: 'pending',
                progress: 0
            };

            // 轮询任务状态
            const pollInterval = setInterval(async () => {
                try {
                    const status = await this.getBatchTaskStatus(taskId);
                    result = {
                        ...result,
                        processedItems: status.processedItems,
                        lids: status.lids,
                        status: status.status,
                        progress: status.progress
                    };

                    if (progressCallback) {
                        progressCallback(result);
                    }

                    if (status.status === 'completed' || status.status === 'failed') {
                        clearInterval(pollInterval);
                    }
                } catch (error) {
                    console.error('[BackendAPI] Polling error:', error);
                    clearInterval(pollInterval);
                }
            }, 2000); // 每2秒轮询一次

            return result;
        } catch (error) {
            console.error('[BackendAPI] Batch process failed:', error);
            throw new Error('Failed to start batch process');
        }
    }

    /**
     * 📊 获取批量任务状态
     */
    async getBatchTaskStatus(taskId: string): Promise<{
        taskId: string;
        status: 'pending' | 'processing' | 'completed' | 'failed';
        progress: number;
        processedItems: number;
        totalItems: number;
        lids: string[];
        errors?: string[];
    }> {
        try {
            const cacheKey = `task_status_${taskId}`;

            // 检查缓存（避免频繁请求）
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < 1000) { // 1秒缓存
                return cached.data;
            }

            const response = await this.apiRequest('GET', `/api/literature/batch/${taskId}/status`);

            // 更新缓存
            this.cache.set(cacheKey, {
                data: response,
                timestamp: Date.now()
            });

            return response;
        } catch (error) {
            console.error('[BackendAPI] Failed to get task status:', error);
            throw new Error('Failed to get batch task status');
        }
    }

    /**
     * 📚 获取文献详细信息
     */
    async getLiterature(lid: string): Promise<LibraryItem> {
        try {
            const cacheKey = `literature_${lid}`;

            // 检查缓存
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < 300000) { // 5分钟缓存
                return cached.data;
            }

            console.log('[BackendAPI] Fetching literature:', lid);
            const response = await this.apiRequest('GET', `/api/literature/${lid}`);
            const literature = this.mapBackendToFrontend(response);

            // 更新缓存
            this.cache.set(cacheKey, {
                data: literature,
                timestamp: Date.now()
            });

            return literature;
        } catch (error) {
            console.error('[BackendAPI] Failed to get literature:', error);
            throw new Error('Failed to get literature');
        }
    }

    /**
     * 📦 批量获取文献信息
     */
    async getBatchLiterature(lids: string[]): Promise<LibraryItem[]> {
        try {
            console.log(`[BackendAPI] Fetching ${lids.length} literature items`);

            // 检查缓存中已有的文献
            const cached: LibraryItem[] = [];
            const needFetch: string[] = [];

            lids.forEach(lid => {
                const cacheKey = `literature_${lid}`;
                const cachedItem = this.cache.get(cacheKey);
                if (cachedItem && Date.now() - cachedItem.timestamp < 300000) {
                    cached.push(cachedItem.data);
                } else {
                    needFetch.push(lid);
                }
            });

            // 批量获取未缓存的文献
            let fetched: LibraryItem[] = [];
            if (needFetch.length > 0) {
                const response = await this.apiRequest('POST', '/api/literature/batch/get', {
                    lids: needFetch
                });

                fetched = response.literature.map((item: any) => this.mapBackendToFrontend(item));

                // 更新缓存
                fetched.forEach(item => {
                    const cacheKey = `literature_${item.lid}`;
                    this.cache.set(cacheKey, {
                        data: item,
                        timestamp: Date.now()
                    });
                });
            }

            // 合并缓存和新获取的数据，按原顺序返回
            const result = lids.map(lid => {
                return cached.find(item => item.lid === lid) ||
                    fetched.find(item => item.lid === lid);
            }).filter(Boolean) as LibraryItem[];

            return result;
        } catch (error) {
            console.error('[BackendAPI] Failed to get batch literature:', error);
            throw new Error('Failed to get batch literature');
        }
    }

    // ==================== 引用关系 API ====================

    /**
     * 🔗 获取文献引用网络
     */
    async getCitationNetwork(lids: string[]): Promise<CitationNetworkResult> {
        try {
            console.log(`[BackendAPI] Getting citation network for ${lids.length} items`);

            const cacheKey = `citations_${lids.sort().join(',')}`; // 排序确保一致性

            // 检查缓存
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < 600000) { // 10分钟缓存
                return cached.data;
            }

            const response = await this.apiRequest('POST', '/api/literature/citations', {
                lids
            });

            const result: CitationNetworkResult = {
                lids: response.lids,
                citations: response.citations.map((citation: any) => ({
                    sourceLid: citation.source_lid,
                    targetLid: citation.target_lid,
                    citationType: citation.type,
                    confidence: citation.confidence
                })),
                metadata: {
                    totalNodes: response.metadata.total_nodes,
                    totalEdges: response.metadata.total_edges,
                    analysisTime: response.metadata.analysis_time_ms
                }
            };

            // 更新缓存
            this.cache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });

            return result;
        } catch (error) {
            console.error('[BackendAPI] Failed to get citation network:', error);
            throw new Error('Failed to get citation network');
        }
    }

    /**
     * 🔗 获取单个文献的引用关系
     */
    async getLiteratureCitations(lid: string): Promise<{
        incoming: Array<{ sourceLid: string; citationType: string; confidence: number }>;
        outgoing: Array<{ targetLid: string; citationType: string; confidence: number }>;
        total: number;
    }> {
        try {
            const cacheKey = `single_citations_${lid}`;

            // 检查缓存
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < 300000) { // 5分钟缓存
                return cached.data;
            }

            console.log('[BackendAPI] Getting citations for literature:', lid);
            const response = await this.apiRequest('GET', `/api/literature/${lid}/citations`);

            const result = {
                incoming: response.incoming.map((citation: any) => ({
                    sourceLid: citation.source_lid,
                    citationType: citation.type,
                    confidence: citation.confidence
                })),
                outgoing: response.outgoing.map((citation: any) => ({
                    targetLid: citation.target_lid,
                    citationType: citation.type,
                    confidence: citation.confidence
                })),
                total: response.total
            };

            // 更新缓存
            this.cache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });

            return result;
        } catch (error) {
            console.error('[BackendAPI] Failed to get literature citations:', error);
            throw new Error('Failed to get literature citations');
        }
    }

    // ==================== 搜索和推荐 API ====================

    /**
     * 🔍 搜索文献
     */
    async searchLiterature(query: {
        text?: string;
        authors?: string[];
        yearRange?: { start: number; end: number };
        topics?: string[];
        limit?: number;
        offset?: number;
    }): Promise<{
        results: LibraryItem[];
        total: number;
        query: any;
        searchTime: number;
    }> {
        try {
            console.log('[BackendAPI] Searching literature:', query);

            const response = await this.apiRequest('POST', '/api/literature/search', query);

            return {
                results: response.results.map((item: any) => this.mapBackendToFrontend(item)),
                total: response.total,
                query: response.query,
                searchTime: response.search_time_ms
            };
        } catch (error) {
            console.error('[BackendAPI] Literature search failed:', error);
            throw new Error('Failed to search literature');
        }
    }

    /**
     * 🎯 获取推荐文献
     */
    async getRecommendations(
        userId: string,
        baseLids?: string[],
        limit: number = 10
    ): Promise<{
        recommendations: Array<{
            lid: string;
            score: number;
            reason: string;
            literature: LibraryItem;
        }>;
        generatedAt: Date;
    }> {
        try {
            console.log('[BackendAPI] Getting recommendations for user:', userId);

            const response = await this.apiRequest('POST', '/api/literature/recommendations', {
                user_id: userId,
                base_lids: baseLids,
                limit
            });

            return {
                recommendations: response.recommendations.map((rec: any) => ({
                    lid: rec.lid,
                    score: rec.score,
                    reason: rec.reason,
                    literature: this.mapBackendToFrontend(rec.literature)
                })),
                generatedAt: new Date(response.generated_at)
            };
        } catch (error) {
            console.error('[BackendAPI] Failed to get recommendations:', error);
            throw new Error('Failed to get recommendations');
        }
    }

    // ==================== 工具方法 ====================

    /**
     * 🌐 通用API请求方法
     */
    private async apiRequest(
        method: 'GET' | 'POST' | 'PUT' | 'DELETE',
        endpoint: string,
        data?: any
    ): Promise<any> {
        const url = `${this.baseUrl}${endpoint}`;

        const config: RequestInit = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
            }
        };

        if (data && (method === 'POST' || method === 'PUT')) {
            config.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, config);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`API Error ${response.status}: ${errorData.message || response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            if (error instanceof TypeError && error.message.includes('fetch')) {
                throw new Error('Network error: Unable to connect to backend service');
            }
            throw error;
        }
    }

    /**
     * 🔄 后端数据到前端数据的映射
     */
    private mapBackendToFrontend(backendData: any): ExtendedLibraryItem {
        return {
            lid: backendData.lid, // 使用后端的LID
            title: backendData.title,
            authors: backendData.authors || [],
            year: backendData.year,
            source: backendData.source || 'manual',
            publication: backendData.publication,
            abstract: backendData.abstract,
            summary: backendData.summary,
            doi: backendData.doi,
            url: backendData.url,
            pdfPath: backendData.pdf_path,
            parsedContent: backendData.parsed_content,
            backendTask: backendData.backend_task,
            createdAt: new Date(backendData.created_at),
            updatedAt: new Date(backendData.updated_at || backendData.created_at)
        };
    }

    /**
     * 🧹 清理缓存
     */
    clearCache(): void {
        this.cache.clear();
        console.log('[BackendAPI] Cache cleared');
    }

    /**
     * 📊 获取缓存统计
     */
    getCacheStats(): {
        totalEntries: number;
        memoryUsage: string;
        hitRate: number;
    } {
        return {
            totalEntries: this.cache.size,
            memoryUsage: `${Math.round(JSON.stringify([...this.cache.values()]).length / 1024)}KB`,
            hitRate: 0 // 可以实现实际的命中率统计
        };
    }
}

// 🏪 单例服务实例
export const backendApiService = new BackendApiService({
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000',
    apiKey: process.env.NEXT_PUBLIC_API_KEY
});

