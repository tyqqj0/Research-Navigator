/**
 * 🚨 Global Error Handling System - Types
 * 
 * 设计原则:
 * 1. 类型安全 - 强类型错误处理
 * 2. 分层设计 - 不同层级的错误类型
 * 3. 可扩展性 - 支持各种业务场景
 * 4. 函数式友好 - 支持 Result 模式
 */

/**
 * 🎯 基础错误类型枚举
 */
export enum ErrorType {
    // 数据验证错误
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    SCHEMA_ERROR = 'SCHEMA_ERROR',

    // 数据库错误
    DATABASE_ERROR = 'DATABASE_ERROR',
    CONNECTION_ERROR = 'CONNECTION_ERROR',
    TRANSACTION_ERROR = 'TRANSACTION_ERROR',

    // 业务逻辑错误
    BUSINESS_LOGIC_ERROR = 'BUSINESS_LOGIC_ERROR',
    DUPLICATE_ERROR = 'DUPLICATE_ERROR',
    NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
    PERMISSION_ERROR = 'PERMISSION_ERROR',

    // 外部服务错误
    EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
    NETWORK_ERROR = 'NETWORK_ERROR',
    TIMEOUT_ERROR = 'TIMEOUT_ERROR',

    // 系统错误
    SYSTEM_ERROR = 'SYSTEM_ERROR',
    CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
    RESOURCE_ERROR = 'RESOURCE_ERROR',

    // UI/UX 错误
    USER_INPUT_ERROR = 'USER_INPUT_ERROR',
    NAVIGATION_ERROR = 'NAVIGATION_ERROR',
    RENDER_ERROR = 'RENDER_ERROR',
}

/**
 * 🎯 错误严重级别
 */
export enum ErrorSeverity {
    LOW = 'LOW',           // 不影响功能，仅记录
    MEDIUM = 'MEDIUM',     // 部分功能受影响，可恢复
    HIGH = 'HIGH',         // 核心功能受影响，需要处理
    CRITICAL = 'CRITICAL', // 系统级错误，需要立即处理
}

/**
 * 🎯 错误上下文信息
 */
export interface ErrorContext {
    operation: string;                    // 操作名称
    layer: 'ui' | 'service' | 'repository' | 'database' | 'external'; // 错误层级
    feature?: string;                     // 功能模块
    userId?: string;                      // 用户ID
    timestamp: Date;                      // 错误时间
    requestId?: string;                   // 请求ID
    stackTrace?: string;                  // 堆栈跟踪
    additionalInfo?: Record<string, any>; // 额外信息
}

/**
 * 🎯 错误恢复策略
 */
export interface ErrorRecoveryStrategy {
    canRecover: boolean;                  // 是否可恢复
    recoveryActions: string[];            // 恢复建议
    retryable: boolean;                   // 是否可重试
    maxRetries?: number;                  // 最大重试次数
}

/**
 * 🎯 应用程序错误基类
 */
export interface AppErrorData {
    type: ErrorType;
    severity: ErrorSeverity;
    context: ErrorContext;
    recovery: ErrorRecoveryStrategy;
    errorId: string;
}

/**
 * 🎯 Result 类型定义 (类似 neverthrow)
 */
export type Result<T, E = AppError> =
    | { success: true; data: T }
    | { success: false; error: E };

/**
 * 🎯 应用程序错误类
 */
export class AppError extends Error implements AppErrorData {
    public readonly type: ErrorType;
    public readonly severity: ErrorSeverity;
    public readonly context: ErrorContext;
    public readonly recovery: ErrorRecoveryStrategy;
    public readonly errorId: string;

    constructor(
        message: string,
        type: ErrorType,
        severity: ErrorSeverity,
        context: Partial<ErrorContext>,
        recovery?: Partial<ErrorRecoveryStrategy>
    ) {
        super(message);
        this.name = 'AppError';
        this.type = type;
        this.severity = severity;
        this.errorId = crypto.randomUUID();

        // 完善上下文信息
        this.context = {
            operation: context.operation || 'unknown',
            layer: context.layer || 'service',
            feature: context.feature,
            userId: context.userId,
            timestamp: context.timestamp || new Date(),
            requestId: context.requestId,
            stackTrace: this.stack,
            additionalInfo: context.additionalInfo,
            ...context,
        };

        // 设置恢复策略
        this.recovery = {
            canRecover: recovery?.canRecover || false,
            recoveryActions: recovery?.recoveryActions || [],
            retryable: recovery?.retryable || false,
            maxRetries: recovery?.maxRetries || 0,
            ...recovery,
        };

        // 确保错误对象可序列化
        Object.setPrototypeOf(this, AppError.prototype);
    }

    /**
     * 🎯 转换为可序列化的对象
     */
    toJSON(): AppErrorData & { message: string } {
        return {
            message: this.message,
            type: this.type,
            severity: this.severity,
            context: this.context,
            recovery: this.recovery,
            errorId: this.errorId,
        };
    }

    /**
     * 🎯 判断是否为特定类型的错误
     */
    isType(type: ErrorType): boolean {
        return this.type === type;
    }

    /**
     * 🎯 判断是否为特定严重级别的错误
     */
    isSeverity(severity: ErrorSeverity): boolean {
        return this.severity === severity;
    }
}

/**
 * 🎯 错误统计信息
 */
export interface ErrorStatistics {
    total: number;
    byType: Record<ErrorType, number>;
    bySeverity: Record<ErrorSeverity, number>;
    byFeature: Record<string, number>;
    recentErrors: number; // 最近1小时的错误数量
}

