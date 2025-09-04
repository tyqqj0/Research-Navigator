/**
 * 🎯 Providers - 全局状态管理和配置提供者
 * 
 * 架构说明: 应用程序级别的Context提供者统一管理
 * 设计原则: 分层提供者，按需加载，性能优化
 */

import React from 'react';
import { ThemeProvider } from './ThemeProvider';
import { ErrorProvider } from './ErrorProvider';

// 🎨 主题提供者
export {
    ThemeProvider,
    useTheme,
    // useSimpleThemeColors as useThemeColors,
    useThemeCompat,
    getSimpleCSSVariable as getCSSVariable,
    setSimpleCSSVariable as setCSSVariable
} from './ThemeProvider';

// 🚨 错误处理提供者
export { ErrorProvider, useErrorHandler, ErrorStatistics } from './ErrorProvider';

// 🎯 根提供者组合 - 包装所有提供者
export const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <ErrorProvider>
            <ThemeProvider>
                {children}
            </ThemeProvider>
        </ErrorProvider>
    );
};

// 未来可以添加更多提供者：
// export { QueryClientProvider } from './QueryProvider';
// export { SessionProvider } from './SessionProvider';
// export { NotificationProvider } from './NotificationProvider';

