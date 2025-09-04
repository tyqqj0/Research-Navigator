/**
 * 🏪 Literature Stores - 状态管理统一导出
 * 
 * 架构说明: Literature领域的状态管理层统一入口
 * 设计原则: 响应式状态管理，性能优化，类型安全
 */

// 🚀 统一文献Store
export {
    useUnifiedLiteratureStore,
    type UnifiedLiteratureStoreState,
    type EnhancedLiteratureItem,
} from './literature-store';

// 🎯 默认导出 - 使用统一Store
export { useUnifiedLiteratureStore as default } from './literature-store';
