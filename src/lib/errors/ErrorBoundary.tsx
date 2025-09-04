/**
 * 🚨 React Error Boundary
 * 
 * React错误边界组件，用于捕获和处理UI层的错误
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AppError, ErrorType, ErrorSeverity, handleError } from './index';

interface ErrorBoundaryState {
    hasError: boolean;
    error: AppError | null;
}

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: (error: AppError) => ReactNode;
    feature?: string;
    onError?: (error: AppError) => void;
}

/**
 * 🎯 React错误边界组件
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        // 更新状态以显示错误UI
        const appError = handleError(error, {
            operation: 'React.render',
            layer: 'ui',
            feature: 'error-boundary',
        });

        return { hasError: true, error: appError };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // 处理错误
        const appError = handleError(error, {
            operation: 'React.componentDidCatch',
            layer: 'ui',
            feature: this.props.feature || 'unknown',
            additionalInfo: {
                componentStack: errorInfo.componentStack,
                errorBoundary: this.constructor.name,
            },
        });

        // 更新状态
        this.setState({ error: appError });

        // 调用外部错误处理器
        if (this.props.onError) {
            this.props.onError(appError);
        }
    }

    render() {
        if (this.state.hasError && this.state.error) {
            // 使用自定义fallback或默认错误UI
            if (this.props.fallback) {
                return this.props.fallback(this.state.error);
            }

            return <DefaultErrorFallback error={this.state.error} />;
        }

        return this.props.children;
    }
}

/**
 * 🎯 默认错误回退组件
 */
const DefaultErrorFallback: React.FC<{ error: AppError }> = ({ error }) => {
    const handleRetry = () => {
        window.location.reload();
    };

    return (
        <div className="min-h-[200px] flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-red-50 border border-red-200 rounded-lg p-6">
                <div className="flex items-center mb-4">
                    <div className="flex-shrink-0">
                        <svg
                            className="h-5 w-5 text-red-400"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                        >
                            <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                clipRule="evenodd"
                            />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-800">
                            出现了一个错误
                        </h3>
                    </div>
                </div>

                <div className="mb-4">
                    <p className="text-sm text-red-700">
                        {error.message}
                    </p>
                    {error.context.feature && (
                        <p className="text-xs text-red-600 mt-1">
                            功能模块: {error.context.feature}
                        </p>
                    )}
                    <p className="text-xs text-red-600 mt-1">
                        错误ID: {error.errorId}
                    </p>
                </div>

                {error.recovery.canRecover && (
                    <div className="mb-4">
                        <h4 className="text-xs font-medium text-red-800 mb-2">
                            建议的解决方案:
                        </h4>
                        <ul className="text-xs text-red-700 list-disc list-inside space-y-1">
                            {error.recovery.recoveryActions.map((action, index) => (
                                <li key={index}>{action}</li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="flex space-x-3">
                    <button
                        type="button"
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        onClick={handleRetry}
                    >
                        重新加载
                    </button>
                    <button
                        type="button"
                        className="inline-flex items-center px-3 py-2 border border-red-300 text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        onClick={() => {
                            console.error('Error details:', error);
                            alert(`错误详情已输出到控制台。错误ID: ${error.errorId}`);
                        }}
                    >
                        查看详情
                    </button>
                </div>
            </div>
        </div>
    );
};

/**
 * 🎯 高阶组件：为组件添加错误边界
 */
export function withErrorBoundaryHOC<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    feature?: string
) {
    const WithErrorBoundaryComponent = (props: P) => (
        <ErrorBoundary feature={feature}>
            <WrappedComponent {...props} />
        </ErrorBoundary>
    );

    WithErrorBoundaryComponent.displayName = `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`;

    return WithErrorBoundaryComponent;
}

/**
 * 🎯 Hook：在函数组件中处理错误
 */
export function useErrorHandler(feature?: string) {
    const handleErrorCallback = React.useCallback((error: unknown, operation?: string): AppError => {
        const appError = handleError(error, {
            operation: operation || 'useErrorHandler',
            layer: 'ui',
            feature: feature || 'unknown',
        });

        // 可以在这里触发全局错误处理
        // 比如显示 toast 通知等
        console.error('Error handled by useErrorHandler:', appError);

        return appError;
    }, [feature]);

    return { handleError: handleErrorCallback };
}
