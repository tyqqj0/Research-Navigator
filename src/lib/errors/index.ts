/**
 * 🚨 Global Error Handling System
 * 
 * 统一的错误处理系统，提供：
 * 1. 类型安全的错误处理
 * 2. Result 模式支持
 * 3. 全局错误处理器
 * 4. 错误边界和装饰器
 * 
 * 使用示例:
 * 
 * ```typescript
 * // 1. 使用 Result 模式
 * const result = await fetchUserData(userId);
 * if (result.success) {
 *   console.log(result.data);
 * } else {
 *   handleError(result.error);
 * }
 * 
 * // 2. 使用错误边界装饰器
 * class UserService {
 *   @withErrorBoundary('getUser', 'service', 'user')
 *   async getUser(id: string) {
 *     // 方法实现
 *   }
 * }
 * 
 * // 3. 手动处理错误
 * try {
 *   await someOperation();
 * } catch (error) {
 *   const appError = handleError(error, {
 *     operation: 'someOperation',
 *     layer: 'service',
 *     feature: 'user'
 *   });
 * }
 * ```
 */

// 核心类型
export {
    AppError,
    ErrorType,
    ErrorSeverity,
    type ErrorContext,
    type ErrorRecoveryStrategy,
    type Result,
    type ErrorStatistics,
    type AppErrorData,
} from './types';

// Result 模式工具
export {
    ResultUtils,
    Ok,
    Err,
    Error,
} from './result';

// 全局错误处理器
export {
    GlobalErrorHandler,
    handleError,
    withErrorBoundary,
    withAsyncErrorHandling,
    type ErrorHandlerConfig,
} from './handler';

// 便捷的错误创建函数
import { AppError, ErrorType, ErrorSeverity, type ErrorContext } from './types';

export const createError = {
    validation: (message: string, context: Partial<ErrorContext>) =>
        new AppError(message, ErrorType.VALIDATION_ERROR, ErrorSeverity.MEDIUM, context),

    notFound: (message: string, context: Partial<ErrorContext>) =>
        new AppError(message, ErrorType.NOT_FOUND_ERROR, ErrorSeverity.MEDIUM, context),

    permission: (message: string, context: Partial<ErrorContext>) =>
        new AppError(message, ErrorType.PERMISSION_ERROR, ErrorSeverity.HIGH, context),

    database: (message: string, context: Partial<ErrorContext>) =>
        new AppError(message, ErrorType.DATABASE_ERROR, ErrorSeverity.HIGH, context),

    network: (message: string, context: Partial<ErrorContext>) =>
        new AppError(message, ErrorType.NETWORK_ERROR, ErrorSeverity.MEDIUM, context),

    system: (message: string, context: Partial<ErrorContext>) =>
        new AppError(message, ErrorType.SYSTEM_ERROR, ErrorSeverity.HIGH, context),

    business: (message: string, context: Partial<ErrorContext>) =>
        new AppError(message, ErrorType.BUSINESS_LOGIC_ERROR, ErrorSeverity.MEDIUM, context),
};

// 默认导出全局错误处理器实例
import { GlobalErrorHandler } from './handler';
export default GlobalErrorHandler.getInstance();
