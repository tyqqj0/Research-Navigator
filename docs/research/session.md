## Session 模型与持久化

`session` 是研究模式的唯一顶层状态容器，聚合：研究问题、目标、图谱、方向、报告与运行中元数据。它既支撑 UI，又为编排提供条件判断与触发依据。

### TypeScript 定义（参考实现）
```ts
export type ResearchSession = {
  id: string;
  researchQuery: string;     // 用户想知道什么
  researchGoal: string;      // 简短目标
  collectionId: string;      // 关联的文献集合
  graph: ResearchGraph;      // 研究图谱（非 citation）
  direction?: {              // Phase 1 输出
    focus: string;
    tags: string[];
  };
  finalReport?: string;      // Phase 3 输出（Markdown）
  meta?: {
    createdAt: number;
    updatedAt: number;
    version: number;         // 会随 schema 变化而递增
  };
};

export type ResearchGraph = {
  id: string;
  nodes: Record<string, GraphNode>;
  edges: Record<string, GraphEdge>;
};

export type GraphNode = {
  id: string;
  kind: 'paper'|'concept'|'method'|'dataset';
  title: string;
  meta?: Record<string, unknown>;
};

export type GraphEdge = {
  id: string;
  from: string; to: string;
  relation: 'supports'|'contradicts'|'extends'|'related';
  weight?: number;
};
```

### JSON 导入/导出
- 导出：序列化完整 `session` 对象；附带 `meta.version`，以便未来兼容迁移。
- 导入：
  - 校验必填字段（`id/researchQuery/researchGoal/collectionId/graph`）。
  - 若 `version` 落后，执行迁移步骤（添加缺省字段、调整类型）。
  - 不信任外部 `finalReport` 的 HTML/脚本内容（只保存 Markdown 文本）。

### 不变式与约束
- `graph.nodes/edges` 内部 id 全局唯一；边 `from/to` 必须存在于 `nodes`。
- `direction` 一旦生成可被更新，但更新应记录时间戳。
- `finalReport` 与 `graph` 从属关系：报告仅针对当前图谱视图生成；若图谱重大变化，应提示重新生成。

### 存储位置
- 短期：浏览器内（Zustand + IndexedDB/LocalStorage）。
- 中期：后端存储（用户态加密），支持跨设备同步与分享。

### 版本化建议
- `meta.version` 初始 `1`；当字段新增或枚举扩展时递增。
- 维护 `migrations/session/*.ts`，按版本顺序执行迁移。



