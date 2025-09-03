/**
 * 🔄 Literature Sync Service - 文献同步服务
 * 
 * 迁移自: old/src/libs/db/sync/ 相关功能
 * 功能: SSE实时更新、后端同步、离线支持
 * 设计: Event-driven + Offline-first
 */

import { literatureDomainRepositories } from '../repositories';
import {
    LibraryItem,
    BackendTask,
    LiteratureStatus,
    SyncEvent,
    SyncConfiguration,
    OfflineQueue,
    ConflictResolution,
    SyncStatistics
} from '../types';

/**
 * 🔄 同步事件类型
 */
export type SyncEventType =
    | 'literature_created'
    | 'literature_updated'
    | 'literature_deleted'
    | 'citation_linked'
    | 'user_meta_updated'
    | 'sync_status_changed'
    | 'offline_queue_changed';

/**
 * 📡 SSE连接状态
 */
export type SSEConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'retrying';

/**
 * 🔄 Literature Sync Service
 * 
 * 核心功能：
 * 1. SSE实时数据同步
 * 2. 离线队列管理
 * 3. 冲突解决机制
 * 4. 批量同步优化
 */
export class LiteratureSyncService {
    private eventSource: EventSource | null = null;
    private connectionStatus: SSEConnectionStatus = 'disconnected';
    private offlineQueue: OfflineQueue[] = [];
    private eventListeners = new Map<SyncEventType, Function[]>();
    private syncConfig: SyncConfiguration;
    private retryCount = 0;
    private maxRetries = 5;
    private retryDelay = 1000; // 1秒基础延迟

    constructor(config?: Partial<SyncConfiguration>) {
        this.syncConfig = {
            sseEndpoint: '/api/literature/events',
            batchSize: 20,
            retryInterval: 5000,
            offlineTimeout: 30000,
            conflictResolution: 'merge', // 'merge' | 'latest' | 'manual'
            enableRealtime: true,
            enableOfflineSupport: true,
            ...config
        };

        // 监听网络状态
        this.setupNetworkListeners();

        // 初始化离线队列恢复
        this.restoreOfflineQueue();
    }

    // ==================== SSE 实时同步 ====================

    /**
     * 🔗 建立SSE连接
     */
    async connectSSE(): Promise<void> {
        if (!this.syncConfig.enableRealtime) {
            console.log('[SyncService] Real-time sync disabled');
            return;
        }

        try {
            this.setConnectionStatus('connecting');
            console.log('[SyncService] Connecting to SSE...');

            // 关闭现有连接
            this.disconnectSSE();

            // 建立新连接
            this.eventSource = new EventSource(this.syncConfig.sseEndpoint);

            // 设置事件监听
            this.setupSSEListeners();

        } catch (error) {
            console.error('[SyncService] Failed to connect SSE:', error);
            this.setConnectionStatus('error');
            this.scheduleReconnect();
        }
    }

    /**
     * 📡 设置SSE事件监听
     */
    private setupSSEListeners(): void {
        if (!this.eventSource) return;

        // 连接成功
        this.eventSource.onopen = () => {
            console.log('[SyncService] SSE connection established');
            this.setConnectionStatus('connected');
            this.retryCount = 0;
        };

        // 连接错误
        this.eventSource.onerror = (error) => {
            console.error('[SyncService] SSE connection error:', error);
            this.setConnectionStatus('error');
            this.scheduleReconnect();
        };

        // 文献创建事件
        this.eventSource.addEventListener('literature_created', (event) => {
            const data = JSON.parse(event.data);
            this.handleLiteratureCreated(data);
        });

        // 文献更新事件
        this.eventSource.addEventListener('literature_updated', (event) => {
            const data = JSON.parse(event.data);
            this.handleLiteratureUpdated(data);
        });

        // 文献删除事件
        this.eventSource.addEventListener('literature_deleted', (event) => {
            const data = JSON.parse(event.data);
            this.handleLiteratureDeleted(data);
        });

        // 后端任务状态更新
        this.eventSource.addEventListener('backend_task_updated', (event) => {
            const data = JSON.parse(event.data);
            this.handleBackendTaskUpdated(data);
        });

        // 引文链接事件
        this.eventSource.addEventListener('citation_linked', (event) => {
            const data = JSON.parse(event.data);
            this.handleCitationLinked(data);
        });

        // 心跳事件
        this.eventSource.addEventListener('heartbeat', (event) => {
            console.log('[SyncService] Heartbeat received');
        });
    }

    /**
     * ❌ 断开SSE连接
     */
    disconnectSSE(): void {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
            this.setConnectionStatus('disconnected');
            console.log('[SyncService] SSE connection closed');
        }
    }

    /**
     * 🔄 计划重连
     */
    private scheduleReconnect(): void {
        if (this.retryCount >= this.maxRetries) {
            console.error('[SyncService] Max retry attempts reached');
            this.setConnectionStatus('error');
            return;
        }

        this.retryCount++;
        const delay = this.retryDelay * Math.pow(2, this.retryCount - 1); // 指数退避

        console.log(`[SyncService] Scheduling reconnect in ${delay}ms (attempt ${this.retryCount})`);
        this.setConnectionStatus('retrying');

        setTimeout(() => {
            this.connectSSE();
        }, delay);
    }

    // ==================== 事件处理 ====================

    /**
     * 📚 处理文献创建事件
     */
    private async handleLiteratureCreated(data: { literature: LibraryItem; userId?: string }): Promise<void> {
        try {
            console.log('[SyncService] Handling literature created:', data.literature.id);

            // 检查是否已存在（避免重复）
            const existing = await literatureDomainRepositories.literature.findById(data.literature.id);
            if (existing) {
                console.log('[SyncService] Literature already exists, skipping');
                return;
            }

            // 添加到本地数据库
            await literatureDomainRepositories.literature.create(data.literature);

            // 触发本地事件
            this.emitEvent('literature_created', data);
        } catch (error) {
            console.error('[SyncService] Failed to handle literature created:', error);
        }
    }

    /**
     * 📝 处理文献更新事件
     */
    private async handleLiteratureUpdated(data: {
        literatureId: string;
        updates: Partial<LibraryItem>;
        version: number;
        userId?: string;
    }): Promise<void> {
        try {
            console.log('[SyncService] Handling literature updated:', data.literatureId);

            const existing = await literatureDomainRepositories.literature.findById(data.literatureId);
            if (!existing) {
                console.warn('[SyncService] Literature not found for update:', data.literatureId);
                return;
            }

            // 冲突检测和解决
            const resolvedUpdates = await this.resolveConflicts(existing, data.updates, data.version);

            // 更新本地数据库
            await literatureDomainRepositories.literature.update(data.literatureId, resolvedUpdates);

            // 触发本地事件
            this.emitEvent('literature_updated', data);
        } catch (error) {
            console.error('[SyncService] Failed to handle literature updated:', error);
        }
    }

    /**
     * 🗑️ 处理文献删除事件
     */
    private async handleLiteratureDeleted(data: { literatureId: string; userId?: string }): Promise<void> {
        try {
            console.log('[SyncService] Handling literature deleted:', data.literatureId);

            // 删除相关数据
            await Promise.all([
                literatureDomainRepositories.literature.delete(data.literatureId),
                literatureDomainRepositories.userMeta.cleanupOrphanedMetas([]), // 会在内部过滤
                literatureDomainRepositories.citation.cleanupOrphanedCitations([])
            ]);

            // 触发本地事件
            this.emitEvent('literature_deleted', data);
        } catch (error) {
            console.error('[SyncService] Failed to handle literature deleted:', error);
        }
    }

    /**
     * ⚙️ 处理后端任务更新
     */
    private async handleBackendTaskUpdated(data: {
        taskId: string;
        status: LiteratureStatus;
        literatureId?: string;
    }): Promise<void> {
        try {
            console.log('[SyncService] Handling backend task updated:', data.taskId);

            if (data.literatureId) {
                // 更新文献的后端任务状态
                await literatureDomainRepositories.literature.update(data.literatureId, {
                    backendTask: {
                        task_id: data.taskId,
                        execution_status: data.status.overall_status,
                        literature_status: data.status,
                        // ... 其他字段
                    } as any
                });
            }

            // 触发本地事件（可用于UI更新）
            this.emitEvent('sync_status_changed', data);
        } catch (error) {
            console.error('[SyncService] Failed to handle backend task updated:', error);
        }
    }

    /**
     * 🔗 处理引文链接事件
     */
    private async handleCitationLinked(data: {
        sourceItemId: string;
        targetItemId: string;
        citationType: string;
        confidence: number;
    }): Promise<void> {
        try {
            console.log('[SyncService] Handling citation linked:', data);

            // 创建引文关系
            await literatureDomainRepositories.citation.createCitation({
                sourceItemId: data.sourceItemId,
                targetItemId: data.targetItemId,
                citationType: data.citationType as any,
                discoveryMethod: 'automatic',
                confidence: data.confidence,
                isVerified: data.confidence >= 0.9
            });

            // 触发本地事件
            this.emitEvent('citation_linked', data);
        } catch (error) {
            console.error('[SyncService] Failed to handle citation linked:', error);
        }
    }

    // ==================== 离线支持 ====================

    /**
     * 📦 添加到离线队列
     */
    addToOfflineQueue(operation: OfflineQueue): void {
        if (!this.syncConfig.enableOfflineSupport) return;

        this.offlineQueue.push({
            ...operation,
            timestamp: new Date(),
            retryCount: 0
        });

        this.saveOfflineQueue();
        this.emitEvent('offline_queue_changed', { queueSize: this.offlineQueue.length });

        console.log(`[SyncService] Added operation to offline queue:`, operation);
    }

    /**
     * 🔄 处理离线队列
     */
    async processOfflineQueue(): Promise<void> {
        if (this.offlineQueue.length === 0) return;
        if (this.connectionStatus !== 'connected') return;

        console.log(`[SyncService] Processing offline queue (${this.offlineQueue.length} items)`);

        const batch = this.offlineQueue.splice(0, this.syncConfig.batchSize);

        for (const operation of batch) {
            try {
                await this.executeOfflineOperation(operation);
                console.log('[SyncService] Offline operation executed:', operation.id);
            } catch (error) {
                console.error('[SyncService] Failed to execute offline operation:', error);

                // 重试逻辑
                operation.retryCount++;
                if (operation.retryCount < 3) {
                    this.offlineQueue.unshift(operation); // 重新加入队列开头
                } else {
                    console.error('[SyncService] Max retries reached for operation:', operation.id);
                }
            }
        }

        this.saveOfflineQueue();
        this.emitEvent('offline_queue_changed', { queueSize: this.offlineQueue.length });

        // 如果还有队列项，继续处理
        if (this.offlineQueue.length > 0) {
            setTimeout(() => this.processOfflineQueue(), 1000);
        }
    }

    /**
     * ⚡ 执行离线操作
     */
    private async executeOfflineOperation(operation: OfflineQueue): Promise<void> {
        switch (operation.type) {
            case 'create_literature':
                // 发送到后端API
                await this.sendToBackend('POST', '/api/literature', operation.data);
                break;

            case 'update_literature':
                await this.sendToBackend('PUT', `/api/literature/${operation.targetId}`, operation.data);
                break;

            case 'delete_literature':
                await this.sendToBackend('DELETE', `/api/literature/${operation.targetId}`);
                break;

            case 'create_citation':
                await this.sendToBackend('POST', '/api/citations', operation.data);
                break;

            case 'update_user_meta':
                await this.sendToBackend('PUT', `/api/user-meta/${operation.targetId}`, operation.data);
                break;

            default:
                throw new Error(`Unknown operation type: ${operation.type}`);
        }
    }

    // ==================== 冲突解决 ====================

    /**
     * 🔀 解决数据冲突
     */
    private async resolveConflicts(
        local: LibraryItem,
        remote: Partial<LibraryItem>,
        remoteVersion: number
    ): Promise<Partial<LibraryItem>> {
        const localVersion = (local as any).version || 1;

        if (remoteVersion <= localVersion) {
            console.log('[SyncService] Remote version is not newer, keeping local changes');
            return {}; // 不更新
        }

        switch (this.syncConfig.conflictResolution) {
            case 'latest':
                console.log('[SyncService] Using latest version (remote)');
                return remote;

            case 'merge':
                console.log('[SyncService] Merging changes');
                return this.mergeChanges(local, remote);

            case 'manual':
                console.log('[SyncService] Manual conflict resolution required');
                // 触发冲突事件，让UI处理
                this.emitEvent('sync_status_changed', {
                    type: 'conflict',
                    local,
                    remote,
                    conflictId: `${local.id}_${Date.now()}`
                });
                return {}; // 暂不更新，等待用户决策

            default:
                return remote;
        }
    }

    /**
     * 🔀 智能合并更改
     */
    private mergeChanges(local: LibraryItem, remote: Partial<LibraryItem>): Partial<LibraryItem> {
        const merged: Partial<LibraryItem> = {};

        // 策略：选择更完整的数据
        for (const [key, remoteValue] of Object.entries(remote)) {
            const localValue = (local as any)[key];

            if (remoteValue !== undefined && remoteValue !== null) {
                if (typeof remoteValue === 'string' && remoteValue.length > 0) {
                    // 字符串：选择更长的
                    if (!localValue || remoteValue.length > localValue.length) {
                        (merged as any)[key] = remoteValue;
                    }
                } else if (Array.isArray(remoteValue)) {
                    // 数组：合并去重
                    const localArray = Array.isArray(localValue) ? localValue : [];
                    (merged as any)[key] = [...new Set([...localArray, ...remoteValue])];
                } else {
                    // 其他类型：使用远程值
                    (merged as any)[key] = remoteValue;
                }
            }
        }

        return merged;
    }

    // ==================== 工具方法 ====================

    /**
     * 📡 发送到后端
     */
    private async sendToBackend(method: string, url: string, data?: any): Promise<any> {
        // 这里应该实现实际的HTTP请求
        // 为了演示，使用mock实现
        console.log(`[SyncService] Mock API call: ${method} ${url}`, data);

        // 模拟网络延迟
        await new Promise(resolve => setTimeout(resolve, 100));

        return { success: true };
    }

    /**
     * 📊 设置连接状态
     */
    private setConnectionStatus(status: SSEConnectionStatus): void {
        this.connectionStatus = status;
        this.emitEvent('sync_status_changed', { connectionStatus: status });
    }

    /**
     * 📺 网络状态监听
     */
    private setupNetworkListeners(): void {
        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => {
                console.log('[SyncService] Network back online');
                this.connectSSE();
                this.processOfflineQueue();
            });

            window.addEventListener('offline', () => {
                console.log('[SyncService] Network offline');
                this.disconnectSSE();
            });
        }
    }

    /**
     * 💾 保存离线队列
     */
    private saveOfflineQueue(): void {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('literatureOfflineQueue', JSON.stringify(this.offlineQueue));
        }
    }

    /**
     * 📂 恢复离线队列
     */
    private restoreOfflineQueue(): void {
        if (typeof localStorage !== 'undefined') {
            const saved = localStorage.getItem('literatureOfflineQueue');
            if (saved) {
                try {
                    this.offlineQueue = JSON.parse(saved);
                    console.log(`[SyncService] Restored ${this.offlineQueue.length} offline operations`);
                } catch (error) {
                    console.error('[SyncService] Failed to restore offline queue:', error);
                    this.offlineQueue = [];
                }
            }
        }
    }

    // ==================== 事件系统 ====================

    /**
     * 👂 监听事件
     */
    on(eventType: SyncEventType, listener: Function): void {
        if (!this.eventListeners.has(eventType)) {
            this.eventListeners.set(eventType, []);
        }
        this.eventListeners.get(eventType)!.push(listener);
    }

    /**
     * 🗑️ 移除事件监听
     */
    off(eventType: SyncEventType, listener: Function): void {
        const listeners = this.eventListeners.get(eventType);
        if (listeners) {
            const index = listeners.indexOf(listener);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * 📢 触发事件
     */
    private emitEvent(eventType: SyncEventType, data: any): void {
        const listeners = this.eventListeners.get(eventType);
        if (listeners) {
            listeners.forEach(listener => {
                try {
                    listener(data);
                } catch (error) {
                    console.error(`[SyncService] Event listener error for ${eventType}:`, error);
                }
            });
        }
    }

    // ==================== 公共API ====================

    /**
     * 📊 获取同步统计
     */
    getSyncStatistics(): SyncStatistics {
        return {
            connectionStatus: this.connectionStatus,
            offlineQueueSize: this.offlineQueue.length,
            retryCount: this.retryCount,
            isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
            lastSyncTime: new Date(), // 可以记录实际的最后同步时间
            totalSyncEvents: 0, // 可以累计统计
            failedOperations: this.offlineQueue.filter(op => op.retryCount > 0).length
        };
    }

    /**
     * 🔄 手动触发同步
     */
    async forcSync(): Promise<void> {
        console.log('[SyncService] Manual sync triggered');

        if (this.connectionStatus !== 'connected') {
            await this.connectSSE();
        }

        await this.processOfflineQueue();
    }

    /**
     * 🧹 清理资源
     */
    destroy(): void {
        this.disconnectSSE();
        this.eventListeners.clear();
        this.offlineQueue = [];
        console.log('[SyncService] Service destroyed');
    }
}

// 🏪 单例服务实例
export const literatureSyncService = new LiteratureSyncService();
