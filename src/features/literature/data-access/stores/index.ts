/**
 * 🏪 Literature Stores - 状态管理统一导出
 * 
 * 架构说明: Literature领域的状态管理层统一入口
 * 设计原则: 响应式状态管理，性能优化，类型安全
 */

// 🚀 增强版文献Store
export {
    useEnhancedLiteratureStore,
    literatureStoreSelectors,
    useLiteratureData,
    useLiteratureActions,
    useLiteratureUser,
    type LiteratureStoreState,
} from './enhanced-literature-store';

// 🎯 默认导出 - 使用增强版Store
export { useEnhancedLiteratureStore as default } from './enhanced-literature-store';
