/**
 * 🚀 Result Pattern Implementation
 * 
 * 类似 neverthrow 的 Result 类型，提供类型安全的错误处理
 * 避免了传统 try-catch 的一些问题
 */

import { AppError, ErrorType, ErrorSeverity, type ErrorContext, type Result } from './types';

/**
 * 🎯 Result 工具类
 */
export class ResultUtils {
    /**
     * 创建成功结果
     */
    static ok<T>(data: T): Result<T, never> {
        return { success: true, data };
    }

    /**
     * 创建错误结果
     */
    static err<E extends AppError>(error: E): Result<never, E> {
        return { success: false, error };
    }

    /**
     * 创建带有AppError的错误结果
     */
    static error<T>(
        message: string,
        type: ErrorType,
        severity: ErrorSeverity,
        context: Partial<ErrorContext>
    ): Result<T, AppError> {
        const error = new AppError(message, type, severity, context);
        return { success: false, error };
    }

    /**
     * 判断是否为成功结果
     */
    static isOk<T, E>(result: Result<T, E>): result is { success: true; data: T } {
        return result.success === true;
    }

    /**
     * 判断是否为错误结果
     */
    static isErr<T, E>(result: Result<T, E>): result is { success: false; error: E } {
        return result.success === false;
    }

    /**
     * 链式处理：map - 转换成功值
     */
    static map<T, U, E>(
        result: Result<T, E>,
        mapper: (data: T) => U
    ): Result<U, E> {
        if (result.success) {
            return { success: true, data: mapper(result.data) };
        }
        return result;
    }

    /**
     * 链式处理：flatMap - 扁平化转换
     */
    static flatMap<T, U, E>(
        result: Result<T, E>,
        mapper: (data: T) => Result<U, E>
    ): Result<U, E> {
        if (result.success) {
            return mapper(result.data);
        }
        return result;
    }

    /**
     * 链式处理：mapErr - 转换错误
     */
    static mapErr<T, E, F>(
        result: Result<T, E>,
        mapper: (error: E) => F
    ): Result<T, F> {
        if (!result.success) {
            return { success: false, error: mapper(result.error) };
        }
        return result;
    }

    /**
     * 获取值或默认值
     */
    static unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
        return result.success ? result.data : defaultValue;
    }

    /**
     * 获取值或通过函数计算默认值
     */
    static unwrapOrElse<T, E>(
        result: Result<T, E>,
        defaultFn: (error: E) => T
    ): T {
        return result.success ? result.data : defaultFn(result.error);
    }

    /**
     * 匹配处理：类似模式匹配
     */
    static match<T, E, U>(
        result: Result<T, E>,
        handlers: {
            ok: (data: T) => U;
            err: (error: E) => U;
        }
    ): U {
        return result.success
            ? handlers.ok(result.data)
            : handlers.err(result.error);
    }

    /**
     * 组合多个 Result：全部成功才返回成功
     */
    static combine<T extends readonly unknown[], E>(
        results: { [K in keyof T]: Result<T[K], E> }
    ): Result<T, E> {
        const data: any[] = [];

        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            if (!result.success) {
                return result;
            }
            data[i] = result.data;
        }

        return { success: true, data: data as unknown as T };
    }

    /**
     * 从 Promise 创建 Result
     */
    static async fromPromise<T>(
        promise: Promise<T>,
        context?: Partial<ErrorContext>
    ): Promise<Result<T, AppError>> {
        try {
            const data = await promise;
            return { success: true, data };
        } catch (error) {
            const appError = error instanceof AppError
                ? error
                : new AppError(
                    (error as any)?.message || String(error),
                    ErrorType.SYSTEM_ERROR,
                    ErrorSeverity.HIGH,
                    context || { operation: 'fromPromise', layer: 'service' }
                );

            return { success: false, error: appError };
        }
    }

    /**
     * 从可能抛出异常的函数创建 Result
     */
    static fromThrowable<T, Args extends readonly unknown[]>(
        fn: (...args: Args) => T,
        context?: Partial<ErrorContext>
    ) {
        return (...args: Args): Result<T, AppError> => {
            try {
                const data = fn(...args);
                return { success: true, data };
            } catch (error) {
                const appError = error instanceof AppError
                    ? error
                    : new AppError(
                        (error as any)?.message || String(error),
                        ErrorType.SYSTEM_ERROR,
                        ErrorSeverity.HIGH,
                        context || { operation: 'fromThrowable', layer: 'service' }
                    );

                return { success: false, error: appError };
            }
        };
    }
}

/**
 * 🎯 便捷的导出别名
 */
export const Ok = ResultUtils.ok;
export const Err = ResultUtils.err;
export const Error = ResultUtils.error;
