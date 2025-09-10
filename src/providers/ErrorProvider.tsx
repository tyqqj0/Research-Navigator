/**
 * 🚨 Error Provider
 * 
 * 全局错误处理Provider，提供应用程序级别的错误管理
 */

'use client';

import React, { createContext, useContext, useCallback, useState, ReactNode } from 'react';
import { AppError, GlobalErrorHandler, handleError, type ErrorContext } from '../lib/errors';

interface ErrorContextValue {
    errors: AppError[];
    handleError: (error: unknown, context?: Partial<ErrorContext>) => AppError;
    clearErrors: () => void;
    clearError: (errorId: string) => void;
    getErrorStatistics: () => ReturnType<GlobalErrorHandler['getErrorStatistics']>;
}

const ErrorContext = createContext<ErrorContextValue | undefined>(undefined);

interface ErrorProviderProps {
    children: ReactNode;
    maxDisplayedErrors?: number;
    enableToastNotifications?: boolean;
}

/**
 * 🎯 错误处理Provider
 */
export function ErrorProvider({
    children,
    maxDisplayedErrors = 5,
    enableToastNotifications = true
}: ErrorProviderProps) {
    const [errors, setErrors] = useState<AppError[]>([]);
    const errorHandler = GlobalErrorHandler.getInstance();

    const handleAppError = useCallback((error: unknown, context?: Partial<ErrorContext>): AppError => {
        const appError = handleError(error, context);

        // 添加到显示错误列表
        setErrors(prev => {
            const newErrors = [appError, ...prev].slice(0, maxDisplayedErrors);
            return newErrors;
        });

        // 如果启用了Toast通知，可以在这里显示
        if (enableToastNotifications) {
            showErrorToast(appError);
        }

        return appError;
    }, [maxDisplayedErrors, enableToastNotifications]);

    const clearErrors = useCallback(() => {
        setErrors([]);
    }, []);

    const clearError = useCallback((errorId: string) => {
        setErrors(prev => prev.filter(error => error.errorId !== errorId));
    }, []);

    const getErrorStatistics = useCallback(() => {
        return errorHandler.getErrorStatistics();
    }, [errorHandler]);

    const value: ErrorContextValue = {
        errors,
        handleError: handleAppError,
        clearErrors,
        clearError,
        getErrorStatistics,
    };

    return (
        <ErrorContext.Provider value={value}>
            {children}
            {/* 错误显示组件 */}
            <ErrorDisplay errors={errors} onClearError={clearError} />
        </ErrorContext.Provider>
    );
}

/**
 * 🎯 使用错误处理的Hook
 */
export function useErrorHandler() {
    const context = useContext(ErrorContext);
    if (context === undefined) {
        throw new Error('useErrorHandler must be used within an ErrorProvider');
    }
    return context;
}

/**
 * 🎯 错误显示组件
 */
const ErrorDisplay: React.FC<{
    errors: AppError[];
    onClearError: (errorId: string) => void;
}> = ({ errors, onClearError }) => {
    if (errors.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 z-50 space-y-2">
            {errors.map((error) => (
                <ErrorToast
                    key={error.errorId}
                    error={error}
                    onClose={() => onClearError(error.errorId)}
                />
            ))}
        </div>
    );
};

/**
 * 🎯 错误Toast组件
 */
const ErrorToast: React.FC<{
    error: AppError;
    onClose: () => void;
}> = ({ error, onClose }) => {
    const [isVisible, setIsVisible] = useState(true);

    React.useEffect(() => {
        // 自动隐藏低级别错误
        if (error.severity === 'LOW' || error.severity === 'MEDIUM') {
            const timer = setTimeout(() => {
                setIsVisible(false);
                setTimeout(onClose, 300); // 动画时间
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [error.severity, onClose]);

    const getSeverityStyles = (severity: AppError['severity']) => {
        switch (severity) {
            case 'CRITICAL':
                return 'bg-red-600 text-white border-red-700';
            case 'HIGH':
                return 'bg-red-100 text-red-800 border-red-300';
            case 'MEDIUM':
                return 'bg-yellow-100 text-yellow-800 border-yellow-300';
            case 'LOW':
                return 'bg-blue-100 text-blue-800 border-blue-300';
        }
    };

    const getSeverityIcon = (severity: AppError['severity']) => {
        switch (severity) {
            case 'CRITICAL':
            case 'HIGH':
                return (
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                );
            case 'MEDIUM':
                return (
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                );
            case 'LOW':
                return (
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                );
        }
    };

    if (!isVisible) return null;

    return (
        <div className={`
            max-w-sm w-full shadow-lg rounded-lg pointer-events-auto border
            transform transition-all duration-300 ease-in-out
            ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
            ${getSeverityStyles(error.severity)}
        `}>
            <div className="p-4">
                <div className="flex items-start">
                    <div className="flex-shrink-0">
                        {getSeverityIcon(error.severity)}
                    </div>
                    <div className="ml-3 w-0 flex-1">
                        <p className="text-sm font-medium">
                            {error.type.replace('_', ' ')}
                        </p>
                        <p className="mt-1 text-sm opacity-90">
                            {error.message}
                        </p>
                        {error.context.feature && (
                            <p className="mt-1 text-xs opacity-75">
                                {error.context.feature}
                            </p>
                        )}
                    </div>
                    <div className="ml-4 flex-shrink-0 flex">
                        <button
                            className="inline-flex opacity-75 hover:opacity-100 focus:outline-none"
                            onClick={() => {
                                setIsVisible(false);
                                setTimeout(onClose, 300);
                            }}
                        >
                            <span className="sr-only">关闭</span>
                            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * 🎯 显示错误Toast通知
 */
function showErrorToast(error: AppError) {
    // 这里可以集成第三方Toast库，如react-hot-toast
    // 现在使用简单的控制台输出
    console.log('Error Toast:', error.message);
}

/**
 * 🎯 错误统计显示组件（可选）
 */
export const ErrorStatistics: React.FC = () => {
    const { getErrorStatistics } = useErrorHandler();
    const [stats, setStats] = useState(getErrorStatistics());

    React.useEffect(() => {
        const interval = setInterval(() => {
            setStats(getErrorStatistics());
        }, 10000); // 每10秒更新一次

        return () => clearInterval(interval);
    }, [getErrorStatistics]);

    return (
        <div className="bg-gray-100 p-4 rounded-lg">
            <h3 className="text-lg font-medium mb-2">错误统计</h3>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <p className="text-sm text-gray-600">总错误数</p>
                    <p className="text-xl font-bold">{stats.total}</p>
                </div>
                <div>
                    <p className="text-sm text-gray-600">最近1小时</p>
                    <p className="text-xl font-bold">{stats.recentErrors}</p>
                </div>
            </div>
        </div>
    );
};
