## Research Graph（最小模型，paperId-only）

一个图谱是独立的最小单位，包含节点集合与边集合。节点只保存系统内“全局统一的 paperId”，不重复冗余论文详情；边直接连接 paperId→paperId。

### 模型（极简且可扩展）
```ts
// 全局唯一 ID：建议使用 UUID v4 或 nanoid
export type GraphId = string;
export type EdgeId = string;
export type PaperId = string;    // 系统全局统一的 Paper ID（前后端一致）

export type PaperNode = {
  id: PaperId;                   // 即 paperId，本图节点 ID = 论文全局 ID
  kind: 'paper';
  // 仅保存最小信息，标题/年份/作者等均到其他域读取
  meta?: Record<string, unknown>; // 可选扩展占位，不鼓励写详情
};

export type GraphNode = PaperNode; // 目前仅 paper，后续可扩展其他 kind

export type GraphEdge = {
  id: EdgeId;
  from: PaperId;                 // 直接使用 paperId
  to: PaperId;                   // 直接使用 paperId
  relation: string;              // 例如 'cites' | 'supports' | 'related'
  tags?: string[];
  meta?: Record<string, unknown>;
};

export type ResearchGraph = {
  id: GraphId;
  nodes: Record<PaperId, GraphNode>;
  edges: Record<EdgeId, GraphEdge>;
};
```

### 约束与去重
- 节点 key 即 `paperId`；不可重复。
- 边的 `from/to` 必须引用已存在的 `paperId`。
- 去重建议：对 `(from,to,relation)` 做稳定哈希，若存在则不再添加。

### 基础操作（精简）
```ts
interface GraphRepo {
  get(): ResearchGraph;
  addNode(node: GraphNode): void;                    // 若存在同 id 则忽略或覆盖
  addEdge(edge: GraphEdge): void;                    // 校验 from/to 存在；可去重
  removeNode(id: PaperId): void;
  removeEdge(id: EdgeId): void;
  listNeighbors(paperId: PaperId): { paper: GraphNode; via: GraphEdge }[];
}
```

### JSON 导入/导出（数据层互转）
- 导出：序列化完整 `ResearchGraph`。
- 导入：校验 `id/nodes/edges` 结构、`from/to` 必须在 `nodes` 中。
- 版本迁移：如未来 schema 调整，在导入时兼容转换。

### 文件放置与职责划分
- 领域目录：`src/features/graph/`
  - `data-access/graph-types.ts`：上述类型定义
  - `data-access/graph-repository.ts`：数据仓库（Dexie/内存）+ JSON 导入/导出
  - `components/GraphEditor.tsx`：简易图编辑页面（数据管理区）
  - `index.ts`：可选的领域导出聚合
  - 由于逻辑简单，暂时不做 services
- 与 Literature/Session 解耦：图谱仅存 `paperId`，论文详情由 Literature 域按需查询。




