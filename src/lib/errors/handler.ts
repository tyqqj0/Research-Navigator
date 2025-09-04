/**
 * 🚨 Global Error Handler
 * 
 * 全局错误处理器，提供统一的错误处理逻辑
 */

import { AppError, ErrorSeverity, ErrorType, type ErrorContext, type ErrorStatistics } from './types';

/**
 * 🎯 错误处理器配置
 */
export interface ErrorHandlerConfig {
    maxLogSize: number;           // 最大日志大小
    enableConsoleLog: boolean;    // 是否启用控制台日志
    enableRemoteLogging: boolean; // 是否启用远程日志
    remoteLogEndpoint?: string;   // 远程日志端点
}

/**
 * 🎯 全局错误处理器
 */
export class GlobalErrorHandler {
    private static instance: GlobalErrorHandler;
    private errorLog: AppError[] = [];
    private config: ErrorHandlerConfig = {
        maxLogSize: 1000,
        enableConsoleLog: true,
        enableRemoteLogging: false,
    };

    private constructor() { }

    /**
     * 获取单例实例
     */
    static getInstance(): GlobalErrorHandler {
        if (!GlobalErrorHandler.instance) {
            GlobalErrorHandler.instance = new GlobalErrorHandler();
        }
        return GlobalErrorHandler.instance;
    }

    /**
     * 配置错误处理器
     */
    configure(config: Partial<ErrorHandlerConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * 处理错误
     */
    handle(error: unknown, context?: Partial<ErrorContext>): AppError {
        let appError: AppError;

        if (error instanceof AppError) {
            appError = error;
        } else if (error instanceof Error) {
            appError = this.fromNativeError(
                error,
                context?.operation || 'unknown',
                context?.layer || 'service',
                context
            );
        } else {
            appError = new AppError(
                String(error),
                ErrorType.SYSTEM_ERROR,
                ErrorSeverity.HIGH,
                context || { operation: 'unknown', layer: 'service' }
            );
        }

        // 记录错误
        this.logError(appError);

        // 根据严重级别决定处理策略
        this.processError(appError);

        return appError;
    }

    /**
     * 从原生错误创建 AppError
     */
    private fromNativeError(
        error: Error,
        operation: string,
        layer: ErrorContext['layer'],
        context?: Partial<ErrorContext>,
        type: ErrorType = ErrorType.SYSTEM_ERROR,
        severity: ErrorSeverity = ErrorSeverity.HIGH
    ): AppError {
        return new AppError(
            error.message,
            type,
            severity,
            {
                operation,
                layer,
                timestamp: new Date(),
                stackTrace: error.stack,
                additionalInfo: {
                    originalErrorName: error.name,
                    originalErrorConstructor: error.constructor.name,
                },
                ...context,
            }
        );
    }

    /**
     * 记录错误
     */
    private logError(error: AppError): void {
        // 添加到内存日志
        this.errorLog.push(error);

        // 保持日志大小限制
        if (this.errorLog.length > this.config.maxLogSize) {
            this.errorLog = this.errorLog.slice(-this.config.maxLogSize);
        }

        // 控制台日志
        if (this.config.enableConsoleLog) {
            this.logToConsole(error);
        }

        // 远程日志
        if (this.config.enableRemoteLogging && this.config.remoteLogEndpoint) {
            this.sendToRemoteLogger(error).catch(console.error);
        }
    }

    /**
     * 控制台日志
     */
    private logToConsole(error: AppError): void {
        const logLevel = this.getLogLevel(error.severity);
        const logMessage = `[${error.errorId}] ${error.type}: ${error.message}`;

        console[logLevel](logMessage, {
            context: error.context,
            recovery: error.recovery,
            timestamp: error.context.timestamp,
        });

        // 对于高级别错误，输出堆栈跟踪
        if (error.severity === ErrorSeverity.HIGH || error.severity === ErrorSeverity.CRITICAL) {
            console.error('Stack trace:', error.stack);
        }
    }

    /**
     * 发送到远程日志服务
     */
    private async sendToRemoteLogger(error: AppError): Promise<void> {
        if (!this.config.remoteLogEndpoint) return;

        try {
            await fetch(this.config.remoteLogEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(error.toJSON()),
            });
        } catch (logError) {
            console.error('Failed to send error to remote logger:', logError);
        }
    }

    /**
     * 处理不同严重级别的错误
     */
    private processError(error: AppError): void {
        switch (error.severity) {
            case ErrorSeverity.CRITICAL:
                this.handleCriticalError(error);
                break;
            case ErrorSeverity.HIGH:
                this.handleHighSeverityError(error);
                break;
            case ErrorSeverity.MEDIUM:
                this.handleMediumSeverityError(error);
                break;
            case ErrorSeverity.LOW:
                this.handleLowSeverityError(error);
                break;
        }
    }

    /**
     * 处理关键错误
     */
    private handleCriticalError(error: AppError): void {
        // 关键错误可能需要特殊处理，比如通知管理员
        // 这里可以集成监控服务，如 Sentry
        console.error('CRITICAL ERROR:', error);

        // 可以触发错误边界或全局错误处理
        if (typeof window !== 'undefined') {
            // 在浏览器环境中可以触发全局错误事件
            window.dispatchEvent(new CustomEvent('criticalError', {
                detail: error
            }));
        }
    }

    /**
     * 处理高级错误
     */
    private handleHighSeverityError(error: AppError): void {
        // 高级错误需要记录并可能需要通知
        console.error('HIGH SEVERITY ERROR:', error);
    }

    /**
     * 处理中级错误
     */
    private handleMediumSeverityError(error: AppError): void {
        // 中级错误主要是记录
        console.warn('MEDIUM SEVERITY ERROR:', error);
    }

    /**
     * 处理低级错误
     */
    private handleLowSeverityError(error: AppError): void {
        // 低级错误仅记录
        console.info('LOW SEVERITY ERROR:', error);
    }

    /**
     * 获取日志级别
     */
    private getLogLevel(severity: ErrorSeverity): 'error' | 'warn' | 'info' {
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
     * 获取错误统计信息
     */
    getErrorStatistics(): ErrorStatistics {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

        const byType = Object.values(ErrorType).reduce((acc, type) => {
            acc[type] = this.errorLog.filter(error => error.type === type).length;
            return acc;
        }, {} as Record<ErrorType, number>);

        const bySeverity = Object.values(ErrorSeverity).reduce((acc, severity) => {
            acc[severity] = this.errorLog.filter(error => error.severity === severity).length;
            return acc;
        }, {} as Record<ErrorSeverity, number>);

        const byFeature = this.errorLog.reduce((acc, error) => {
            const feature = error.context.feature || 'unknown';
            acc[feature] = (acc[feature] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const recentErrors = this.errorLog.filter(
            error => error.context.timestamp > oneHourAgo
        ).length;

        return {
            total: this.errorLog.length,
            byType,
            bySeverity,
            byFeature,
            recentErrors,
        };
    }

    /**
     * 清空错误日志
     */
    clearErrorLog(): void {
        this.errorLog = [];
    }

    /**
     * 获取最近的错误
     */
    getRecentErrors(count: number = 10): AppError[] {
        return this.errorLog.slice(-count);
    }
}

/**
 * 🎯 便捷的全局错误处理函数
 */
export const handleError = (error: unknown, context?: Partial<ErrorContext>): AppError => {
    return GlobalErrorHandler.getInstance().handle(error, context);
};

/**
 * 🎯 错误边界装饰器
 */
export function withErrorBoundary(
    operation: string,
    layer: ErrorContext['layer'],
    feature?: string
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
                const appError = handleError(error, {
                    operation: `${target.constructor.name}.${propertyName}`,
                    layer,
                    feature,
                    additionalInfo: {
                        className: target.constructor.name,
                        methodName: propertyName,
                        arguments: args,
                    },
                });

                throw appError;
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
        throw handleError(error, context);
    }
}

