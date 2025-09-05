/**
 * 🪝 Literature Hooks - 业务编排和UI状态管理层统一导出
 * 
 * 架构说明: Literature领域的Hook层统一入口
 * 设计原则: 业务编排，UI状态管理，数据组合
 * 
 * 新架构的核心Hook - 每个Hook负责特定领域的业务编排:
 * 1. 📚 useLiteratureOperations - 文献相关的所有操作和UI状态
 * 2. 📂 useCollectionOperations - 集合相关的所有操作和UI状态  
 * 3. 🔗 useCitationOperations - 引用网络相关的所有操作和UI状态
 * 
 * 职责划分:
 * - Hook层: 业务编排 + UI状态管理 + 数据组合
 * - Store层: 纯粹的数据存储 + 原子操作
 * - Service层: 业务逻辑 + API通信
 */

// ==================== 📚 Literature Operations ====================
// 文献相关的完整业务编排和UI状态管理
export {
    useLiteratureOperations,
    type UseLiteratureOperationsReturn,
} from './use-literature-operations';

// ==================== 📂 Collection Operations ====================
// 集合相关的完整业务编排和UI状态管理
export {
    useCollectionOperations,
    type UseCollectionOperationsReturn,
} from './use-collection-operations';

// ==================== 🔗 Citation Operations ====================
// 引用网络相关的完整业务编排和UI状态管理
export {
    useCitationOperations,
    type UseCitationOperationsReturn,
} from './use-citation-operations';

// ==================== 🔄 Legacy Hooks (待迁移) ====================
// 这些是旧的Hook，需要逐步迁移到新的Operations Hook
export {
    useLiteratures,
    type UseLiteraturesReturn,
} from './use-literatures';

export {
    useCollections,
    type UseCollectionsReturn,
} from './use-collections';

// ==================== 🎯 默认导出 ====================
// 主要的Literature Operations Hook作为默认导出
export { useLiteratureOperations as default } from './use-literature-operations';

// ==================== 📝 使用说明 ====================
/**
 * 🏗️ 新架构的Hook使用指南：
 * 
 * 1. 组件应该使用Operations Hook，而不是直接使用Store
 * 2. 每个Operations Hook提供完整的领域功能
 * 3. Hook负责UI状态管理和业务编排
 * 4. Store只负责纯粹的数据存储
 * 
 * 迁移示例：
 * ```typescript
 * // ❌ 旧方式：直接使用Store + 旧Hook
 * const Component = () => {
 *   const store = useLiteratureStore();
 *   const { search } = useLiteratures();
 *   
 *   const handleCreate = async () => {
 *     // 复杂的业务逻辑分散在组件中
 *   };
 * };
 * 
 * // ✅ 新方式：使用Operations Hook
 * const Component = () => {
 *   const {
 *     literatures,
 *     selectedLiteratures,
 *     uiState,
 *     createLiterature,
 *     search,
 *     selectLiterature,
 *   } = useLiteratureOperations();
 *   
 *   // 所有业务逻辑都在Hook中处理
 *   // 组件只需要调用方法即可
 * };
 * ```
 * 
 * 🎯 Hook的职责分工：
 * - useLiteratureOperations: 文献CRUD、搜索、选择、UI状态
 * - useCollectionOperations: 集合CRUD、内容管理、过滤、UI状态
 * - useCitationOperations: 网络构建、分析、可视化、UI状态
 */


