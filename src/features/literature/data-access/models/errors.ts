/**
 * 🚨 Literature Domain - 错误处理系统
 * 
 * 设计原则:
 * 1. 分层错误处理 - 不同层级的错误类型
 * 2. 结构化错误信息 - 便于调试和监控
 * 3. 国际化支持 - 支持多语言错误消息
 * 4. 错误恢复策略 - 提供错误恢复建议
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
 * 🎯 错误上下文接口
 */
export interface ErrorContext {
    // 操作信息
    operation: string;
    layer: 'model' | 'repository' | 'service' | 'store' | 'api';

    // 用户信息
    userId?: string;
    sessionId?: string;

    // 数据信息
    entityType?: string;
    entityId?: string;
    inputData?: any;

    // 系统信息
    timestamp: Date;
    userAgent?: string;
    url?: string;

    // 调试信息
    stackTrace?: string;
    additionalInfo?: Record<string, any>;
}

/**
 * 🎯 错误恢复策略接口
 */
export interface ErrorRecoveryStrategy {
    canRecover: boolean;
    recoveryActions: string[];
    fallbackData?: any;
    retryable: boolean;
    maxRetries?: number;
}

/**
 * 🎯 基础领域错误类
 */
export class LiteratureDomainError extends Error {
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
        this.name = 'LiteratureDomainError';
        this.type = type;
        this.severity = severity;
        this.errorId = crypto.randomUUID();

        // 完善上下文信息
        this.context = {
            operation: context.operation || 'unknown',
            layer: context.layer || 'model',
            timestamp: context.timestamp || new Date(),
            stackTrace: this.stack,
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
        Object.setPrototypeOf(this, LiteratureDomainError.prototype);
    }

    /**
     * 🎯 转换为可序列化的对象
     */
    toJSON() {
        return {
            errorId: this.errorId,
            name: this.name,
            message: this.message,
            type: this.type,
            severity: this.severity,
            context: this.context,
            recovery: this.recovery,
        };
    }

    /**
     * 🎯 获取用户友好的错误消息
     */
    getUserMessage(): string {
        const messageMap: Record<ErrorType, string> = {
            [ErrorType.VALIDATION_ERROR]: '输入数据格式不正确，请检查后重试',
            [ErrorType.SCHEMA_ERROR]: '数据结构不匹配，请联系技术支持',
            [ErrorType.DATABASE_ERROR]: '数据存储出现问题，请稍后重试',
            [ErrorType.CONNECTION_ERROR]: '网络连接异常，请检查网络后重试',
            [ErrorType.TRANSACTION_ERROR]: '操作执行失败，请重试',
            [ErrorType.BUSINESS_LOGIC_ERROR]: '操作不符合业务规则，请检查输入',
            [ErrorType.DUPLICATE_ERROR]: '数据已存在，请检查后重试',
            [ErrorType.NOT_FOUND_ERROR]: '未找到相关数据',
            [ErrorType.PERMISSION_ERROR]: '权限不足，无法执行此操作',
            [ErrorType.EXTERNAL_API_ERROR]: '外部服务暂时不可用，请稍后重试',
            [ErrorType.NETWORK_ERROR]: '网络请求失败，请检查网络连接',
            [ErrorType.TIMEOUT_ERROR]: '操作超时，请重试',
            [ErrorType.SYSTEM_ERROR]: '系统错误，请联系技术支持',
            [ErrorType.CONFIGURATION_ERROR]: '系统配置错误，请联系管理员',
            [ErrorType.RESOURCE_ERROR]: '系统资源不足，请稍后重试',
        };

        return messageMap[this.type] || '未知错误，请联系技术支持';
    }
}

/**
 * 🎯 特定错误类型 - 数据验证错误
 */
export class ValidationError extends LiteratureDomainError {
    public readonly validationErrors: Array<{
        field: string;
        message: string;
        value?: any;
    }>;

    constructor(
        message: string,
        validationErrors: Array<{ field: string; message: string; value?: any }>,
        context: Partial<ErrorContext>
    ) {
        super(
            message,
            ErrorType.VALIDATION_ERROR,
            ErrorSeverity.MEDIUM,
            context,
            {
                canRecover: true,
                recoveryActions: ['修正输入数据', '检查必填字段', '验证数据格式'],
                retryable: true,
                maxRetries: 3,
            }
        );

        this.validationErrors = validationErrors;
        this.name = 'ValidationError';
    }
}

/**
 * 🎯 特定错误类型 - 数据库错误
 */
export class DatabaseError extends LiteratureDomainError {
    public readonly dbOperation: string;
    public readonly dbErrorCode?: string;

    constructor(
        message: string,
        dbOperation: string,
        context: Partial<ErrorContext>,
        dbErrorCode?: string
    ) {
        super(
            message,
            ErrorType.DATABASE_ERROR,
            ErrorSeverity.HIGH,
            context,
            {
                canRecover: true,
                recoveryActions: ['重试操作', '检查数据库连接', '清理缓存'],
                retryable: true,
                maxRetries: 3,
            }
        );

        this.dbOperation = dbOperation;
        this.dbErrorCode = dbErrorCode;
        this.name = 'DatabaseError';
    }
}

/**
 * 🎯 特定错误类型 - 业务逻辑错误
 */
export class BusinessLogicError extends LiteratureDomainError {
    public readonly businessRule: string;

    constructor(
        message: string,
        businessRule: string,
        context: Partial<ErrorContext>
    ) {
        super(
            message,
            ErrorType.BUSINESS_LOGIC_ERROR,
            ErrorSeverity.MEDIUM,
            context,
            {
                canRecover: true,
                recoveryActions: ['检查业务规则', '修正操作参数', '联系管理员'],
                retryable: false,
            }
        );

        this.businessRule = businessRule;
        this.name = 'BusinessLogicError';
    }
}

/**
 * 🎯 特定错误类型 - 资源未找到错误
 */
export class NotFoundError extends LiteratureDomainError {
    public readonly resourceType: string;
    public readonly resourceId: string;

    constructor(
        resourceType: string,
        resourceId: string,
        context: Partial<ErrorContext>
    ) {
        const message = `${resourceType} with ID ${resourceId} not found`;

        super(
            message,
            ErrorType.NOT_FOUND_ERROR,
            ErrorSeverity.MEDIUM,
            context,
            {
                canRecover: false,
                recoveryActions: ['检查资源ID', '确认资源存在', '刷新数据'],
                retryable: false,
            }
        );

        this.resourceType = resourceType;
        this.resourceId = resourceId;
        this.name = 'NotFoundError';
    }
}

/**
 * 🎯 错误工厂类 - 标准化错误创建
 */
export class ErrorFactory {
    /**
     * 创建验证错误
     */
    static createValidationError(
        validationResult: { field: string; message: string; value?: any }[],
        operation: string,
        layer: ErrorContext['layer'] = 'model'
    ): ValidationError {
        const message = `Validation failed: ${validationResult.map(r => r.message).join(', ')}`;

        return new ValidationError(message, validationResult, {
            operation,
            layer,
        });
    }

    /**
     * 创建数据库错误
     */
    static createDatabaseError(
        message: string,
        operation: string,
        dbOperation: string,
        layer: ErrorContext['layer'] = 'repository',
        dbErrorCode?: string
    ): DatabaseError {
        return new DatabaseError(message, dbOperation, {
            operation,
            layer,
        }, dbErrorCode);
    }

    /**
     * 创建业务逻辑错误
     */
    static createBusinessLogicError(
        message: string,
        businessRule: string,
        operation: string,
        layer: ErrorContext['layer'] = 'service'
    ): BusinessLogicError {
        return new BusinessLogicError(message, businessRule, {
            operation,
            layer,
        });
    }

    /**
     * 创建资源未找到错误
     */
    static createNotFoundError(
        resourceType: string,
        resourceId: string,
        operation: string,
        layer: ErrorContext['layer'] = 'repository'
    ): NotFoundError {
        return new NotFoundError(resourceType, resourceId, {
            operation,
            layer,
        });
    }

    /**
     * 从原生错误转换
     */
    static fromNativeError(
        error: Error,
        operation: string,
        layer: ErrorContext['layer'],
        type: ErrorType = ErrorType.SYSTEM_ERROR,
        severity: ErrorSeverity = ErrorSeverity.HIGH
    ): LiteratureDomainError {
        return new LiteratureDomainError(
            error.message,
            type,
            severity,
            {
                operation,
                layer,
                stackTrace: error.stack,
                additionalInfo: {
                    originalError: error.name,
                },
            },
            {
                canRecover: false,
                recoveryActions: ['重试操作', '检查系统状态', '联系技术支持'],
                retryable: true,
                maxRetries: 1,
            }
        );
    }
}

/**
 * 🎯 错误处理器类 - 统一错误处理逻辑
 */
export class ErrorHandler {
    private static errorLog: LiteratureDomainError[] = [];
    private static maxLogSize = 1000;

    /**
     * 处理错误
     */
    static handle(error: unknown, context?: Partial<ErrorContext>): LiteratureDomainError {
        let domainError: LiteratureDomainError;

        if (error instanceof LiteratureDomainError) {
            domainError = error;
        } else if (error instanceof Error) {
            domainError = ErrorFactory.fromNativeError(
                error,
                context?.operation || 'unknown',
                context?.layer || 'model'
            );
        } else {
            domainError = new LiteratureDomainError(
                String(error),
                ErrorType.SYSTEM_ERROR,
                ErrorSeverity.HIGH,
                context || { operation: 'unknown', layer: 'model' }
            );
        }

        // 记录错误
        this.logError(domainError);

        // 根据严重级别决定处理策略
        this.processError(domainError);

        return domainError;
    }

    /**
     * 记录错误
     */
    private static logError(error: LiteratureDomainError): void {
        // 添加到内存日志
        this.errorLog.push(error);

        // 保持日志大小限制
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog.shift();
        }

        // 控制台输出
        const logLevel = this.getLogLevel(error.severity);
        console[logLevel](`[${error.type}] ${error.message}`, {
            errorId: error.errorId,
            context: error.context,
            recovery: error.recovery,
        });

        // 可以扩展到外部日志服务
        // await this.sendToExternalLogger(error);
    }

    /**
     * 处理错误
     */
    private static processError(error: LiteratureDomainError): void {
        // 根据错误严重级别执行不同的处理策略
        switch (error.severity) {
            case ErrorSeverity.CRITICAL:
                // 关键错误 - 可能需要系统级处理
                this.handleCriticalError(error);
                break;

            case ErrorSeverity.HIGH:
                // 高级错误 - 记录并通知
                this.handleHighSeverityError(error);
                break;

            case ErrorSeverity.MEDIUM:
                // 中级错误 - 记录
                this.handleMediumSeverityError(error);
                break;

            case ErrorSeverity.LOW:
                // 低级错误 - 仅记录
                this.handleLowSeverityError(error);
                break;
        }
    }

    /**
     * 获取日志级别
     */
    private static getLogLevel(severity: ErrorSeverity): 'error' | 'warn' | 'info' {
        switch (severity) {
            case ErrorSeverity.CRITICAL:
            case ErrorSeverity.HIGH:
                return 'error';
            case ErrorSeverity.MEDIUM:
                return 'warn';
            case ErrorSeverity.LOW:
                return 'info';
        }
    }

    /**
     * 处理关键错误
     */
    private static handleCriticalError(error: LiteratureDomainError): void {
        // 关键错误处理逻辑
        console.error('🚨 CRITICAL ERROR DETECTED:', error.toJSON());

        // 可以添加:
        // - 发送紧急通知
        // - 触发系统保护机制
        // - 自动备份重要数据
    }

    /**
     * 处理高严重级别错误
     */
    private static handleHighSeverityError(error: LiteratureDomainError): void {
        console.error('⚠️ HIGH SEVERITY ERROR:', error.toJSON());

        // 可以添加:
        // - 发送错误报告
        // - 记录到错误跟踪系统
        // - 通知开发团队
    }

    /**
     * 处理中等严重级别错误
     */
    private static handleMediumSeverityError(error: LiteratureDomainError): void {
        console.warn('⚠️ MEDIUM SEVERITY ERROR:', error.toJSON());
    }

    /**
     * 处理低严重级别错误
     */
    private static handleLowSeverityError(error: LiteratureDomainError): void {
        console.info('ℹ️ LOW SEVERITY ERROR:', error.toJSON());
    }

    /**
     * 获取错误日志
     */
    static getErrorLog(): LiteratureDomainError[] {
        return [...this.errorLog];
    }

    /**
     * 清理错误日志
     */
    static clearErrorLog(): void {
        this.errorLog = [];
    }

    /**
     * 获取错误统计
     */
    static getErrorStatistics(): {
        total: number;
        byType: Record<ErrorType, number>;
        bySeverity: Record<ErrorSeverity, number>;
        recentErrors: number; // 最近1小时的错误数量
    } {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

        const byType: Record<ErrorType, number> = {} as any;
        const bySeverity: Record<ErrorSeverity, number> = {} as any;
        let recentErrors = 0;

        for (const error of this.errorLog) {
            // 按类型统计
            byType[error.type] = (byType[error.type] || 0) + 1;

            // 按严重级别统计
            bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;

            // 最近错误统计
            if (error.context.timestamp > oneHourAgo) {
                recentErrors++;
            }
        }

        return {
            total: this.errorLog.length,
            byType,
            bySeverity,
            recentErrors,
        };
    }
}

/**
 * 🎯 错误边界装饰器 - 用于方法级错误处理
 */
export function withErrorBoundary(
    operation: string,
    layer: ErrorContext['layer']
) {
    return function (
        target: any,
        propertyName: string,
        descriptor: PropertyDescriptor
    ) {
        const method = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            try {
                return await method.apply(this, args);
            } catch (error) {
                const domainError = ErrorHandler.handle(error, {
                    operation: `${target.constructor.name}.${propertyName}`,
                    layer,
                    additionalInfo: {
                        className: target.constructor.name,
                        methodName: propertyName,
                        arguments: args,
                    },
                });

                throw domainError;
            }
        };
    };
}

/**
 * 🎯 异步错误处理包装器
 */
export async function withAsyncErrorHandling<T>(
    operation: () => Promise<T>,
    context: Partial<ErrorContext>
): Promise<T> {
    try {
        return await operation();
    } catch (error) {
        throw ErrorHandler.handle(error, context);
    }
}

/**
 * 🎯 同步错误处理包装器
 */
export function withSyncErrorHandling<T>(
    operation: () => T,
    context: Partial<ErrorContext>
): T {
    try {
        return operation();
    } catch (error) {
        throw ErrorHandler.handle(error, context);
    }
}

export default {
    // 错误类型
    ErrorType,
    ErrorSeverity,

    // 错误类
    LiteratureDomainError,
    ValidationError,
    DatabaseError,
    BusinessLogicError,
    NotFoundError,

    // 工具类
    ErrorFactory,
    ErrorHandler,

    // 装饰器和包装器
    withErrorBoundary,
    withAsyncErrorHandling,
    withSyncErrorHandling,
};
