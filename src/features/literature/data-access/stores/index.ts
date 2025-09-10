/**
 * 🏪 Literature Stores - 纯粹的状态管理层统一导出
 * 
 * 架构说明: Literature领域的状态管理层统一入口
 * 设计原则: 纯粹的数据存储，原子化操作，类型安全
 * 
 * 三层Store架构 - 每个Store都是纯粹的数据仓库:
 * 1. 📚 Literature Store - 文献数据的唯一数据源
 * 2. 📂 Collection Store - 集合数据的独立管理
 * 3. 🔗 Citation Store - 引用网络数据的只读存储
 * 
 * 注意: 
 * - Store只负责数据存储，不包含UI状态和业务逻辑
 * - 复杂的数据组合和UI状态管理由Hook层负责
 * - 业务逻辑编排由Service层负责
 */

// ==================== 📚 Literature Store ====================
// 文献数据的唯一数据源 - 纯粹的数据存储
export {
    useLiteratureStore,
    type LiteratureStoreState,
    type LiteratureStoreActions,
    // 基础数据选择器
    selectAllLiteratures,
    selectLiteratureById,
    selectLiteratureCount,
    // selectCurrentUser,
    selectStats,
} from './literature-store';

// ==================== 📂 Collection Store ====================
// 集合数据的独立管理 - 纯粹的数据存储
export {
    useCollectionStore,
    type CollectionStoreState,
    type CollectionStoreActions,
    // 基础数据选择器
    selectAllCollections,
    selectCollectionById,
    selectCollectionCount,
    selectCollectionsByType,
    // selectCurrentUser as selectCollectionCurrentUser,
    selectStats as selectCollectionStats,
} from './collection-store';

// ==================== 🔗 Citation Store ====================
// 引用网络数据的只读存储 - 纯粹的数据存储
export {
    useCitationStore,
    type CitationStoreState,
    // type CitationStoreActions,
    // // 网络选择器
    // selectAllNetworks,
    // selectNetworkById,
    // // 节点选择器
    // selectAllNodes,
    // selectNodeById,
    // selectNodesInNetwork,
    // // 边选择器
    // selectAllEdges,
    // selectEdgesInNetwork,
    // // 统计选择器
    // selectNodeStats,
    // selectGlobalStats,
} from './citation-store';

// ==================== 🎯 默认导出 ====================
// 主要的Literature Store作为默认导出
export { useLiteratureStore as default } from './literature-store';

// ==================== 📝 使用说明 ====================
/**
 * 🏗️ 如何使用这些Store：
 * 
 * 1. 组件中不要直接使用Store的复杂操作
 * 2. 使用对应的Hook来获取数据和执行操作
 * 3. Hook层负责组合多个Store的数据
 * 4. Hook层负责管理UI状态（loading、selection等）
 * 
 * 示例：
 * ```typescript
 * // ❌ 错误用法：直接在组件中使用Store
 * const Component = () => {
 *   const store = useLiteratureStore();
 *   const handleCreate = () => store.createLiterature(...); // 这个方法不存在了
 * };
 * 
 * // ✅ 正确用法：使用Hook
 * const Component = () => {
 *   const { 
 *     literatures, 
 *     isLoading, 
 *     createLiterature 
 *   } = useLiteratureOperations(); // Hook负责业务逻辑
 * };
 * ```
 */