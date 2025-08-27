/**
 * 全局提供者索引
 * 
 * 这个文件导出所有的全局上下文提供者，
 * 便于在 app/layout.tsx 中统一管理
 */

export { ThemeProvider, useTheme, useThemeColors, useSystemTheme, getCSSVariable, setCSSVariable } from './ThemeProvider';

// 未来可以添加更多提供者：
// export { QueryClientProvider } from './QueryProvider';
// export { SessionProvider } from './SessionProvider';
// export { NotificationProvider } from './NotificationProvider';
