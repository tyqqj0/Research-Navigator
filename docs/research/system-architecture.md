## 系统分层与依赖总览（Session/Graph/Literature/AI）

本文档梳理当前项目的主要模块、依赖关系、分层架构、核心接口契约、数据结构与前后端传输方案，并给出可落地的演进步骤。

### 目标
- 清晰解耦：UI、编排、数据访问、外部提供方（AI/后端）各司其职。
- 可迁移：前端先自洽运行；未来迁到后端时复用相同“命令/事件/产出物/投影”语义，最小改动。
- 可观察：事件记录事实、可回放；产出物版本化、可回溯。

## 现有模块与依赖

### 文献（Literature）
- UI：`src/features/literature/management/components/*`（如 `CollectionTreePanel.tsx`、`LiteratureListPanel.tsx`）。
- 业务：`useLiteratureOperations`、`useCollectionOperations`（加载/筛选/选择）。
- 数据：当前以前端本地为主（Dexie/内存）。后续与 Session/Graph 的事件流无强耦合，仅通过数据契约（paperId 等）协作。

### 图谱（Graph）
- 类型：`src/features/graph/data-access/graph-types.ts`（`ResearchGraph`、`GraphNode/Edge`、`GraphSnapshot`、`GraphDataSource`）。
- 存储：`graph-repository.ts`（Dexie）、`graph-store.ts`（Zustand 投影 + 适配器 `graphStoreDataSource`）。
- UI：`GraphCanvas.tsx`（主体交互/布局/缩放/物理模拟）、`TimelineAxis.tsx`（坐标轴与密度）。
- 依赖：`GraphCanvas` 通过 `GraphDataSource` 解耦存储；可平滑替换为后端数据源。

### 设置与用户（Settings/User）
- `src/features/user/settings/data-access/settings-store.ts`
- AI 配置解析：`src/lib/settings/ai.ts` → `resolveAIConfig()`。
- 主题与颜色：`src/app/globals.css` 中 CSS 变量，Canvas/Axis 已改用 CSS 变量。

### AI 流（Streaming AI）
- 核心：`src/lib/ai/streaming/*`
  - `index.ts`（类型）、`start.ts`（入口）、`react.ts`（Hook）、`providers/openai-compatible.ts`（SSE/Abort/URL 兼容）、`providers/index.ts`（注册/别名）。
- 依赖设置：`resolveAIConfig()`（provider/baseURL/model/key）。
- 已支持：OpenAI 兼容 API（含 baseURL），SSE 流式，停止时 `aborted` 事件。

### 本地存储与同步
- 本地优先：Dexie（Graph/未来 Session/Event/Artifact）。
- 同步预留：后端通过命令（REST/WS）与事件（SSE/WS）保持一致；产出物走对象存储或 DB。

## 分层架构

### 层次划分
- UI 层：页面与组件（GraphCanvas/ChatWindow 等）。只读投影（Zustand），通过命令触发业务。
- 投影层（Projection）：Zustand stores（`graph-store.ts`、未来 `session-store.ts`）。仅持有“查询友好”的快照。
- 编排层（Orchestration）：状态机/Saga（XState 推荐），将事件转化为后续命令，串联大任务与子任务。
- 事件/命令总线（Event/Command Bus）：发布/订阅事件、派发命令；事件是事实、命令是意图。
- 数据层（Data Access）：Dexie 仓库（Graph/Session/Artifacts/Events）。产出物不可变且版本化；事件可回放构建投影。
- 提供方/适配层（Providers/Transport）：AI provider 适配器；后端传输（REST 命令 + SSE/WS 事件）。

### 依赖方向
UI → 投影 → 事件/命令 → 编排 → 执行器/提供方（AI/后端） → 产出物/事件存储 → 投影

## 核心接口契约（最小集）

### GraphDataSource（已实现）
```ts
interface GraphDataSource {
  getSnapshot(graphId: string): GraphSnapshot | null;
  subscribe(graphId: string, cb: (snap: GraphSnapshot) => void): () => void;
  addNode(graphId: string, node: GraphNode): Promise<void>;
  removeNode(graphId: string, paperId: PaperId): Promise<void>;
  addEdge(graphId: string, edge: Omit<GraphEdge,'id'> & { id?: string }): Promise<void>;
  removeEdge(graphId: string, edgeId: string): Promise<void>;
}
```

### AI ProviderAdapter（已实现）
```ts
interface ProviderAdapter {
  start(opts: StartOptions): TextStream; // on(event)
}
```

### Session 命令/事件（建议）
```ts
type EventEnvelope<T extends string, P> = {
  id: string; type: T; ts: number; sessionId?: string;
  taskId?: string; parentTaskId?: string; correlationId?: string; causationId?: string;
  payload: P; artifacts?: { kind: string; id: string; version?: number }[];
};

type CommandEnvelope<T extends string, P> = {
  id: string; type: T; ts: number; sessionId?: string; targetTaskId?: string;
  params: P; inputRefs?: { kind: string; id: string; version?: number }[];
};
```

## 数据结构（最小字段）

### Graph（现有）
- `ResearchGraph { id, name?, nodes: Record<PaperId,GraphNode>, edges: Record<EdgeId,GraphEdge> }`
- `GraphSnapshot` 用于 UI；`GraphDataSource` 作为解耦接口。

### Session/Message（投影）
- Session: `id, title, provider, model, createdAt, updatedAt, meta?`
- Message: `id, sessionId, role(user|assistant|system|tool), content, status(streaming|done|error|aborted), error?, usage?, createdAt`

### Artifact（产出物）
- `id, kind(chat_message|provider_config|...), version, uri/blobKey, meta, hash?`

## 前后端传输方案

- 命令上行：`POST /commands`，body=CommandEnvelope（含幂等 `commandId`）。
- 事件下行：`GET /events/stream?since=seq`（SSE）或 WebSocket；事件为 EventEnvelope 序列；客户端按 `serverSeq` 去重与恢复。
- 产出物传输：大内容走 OSS/S3（后端返回 `uploadUrl/downloadUrl`）；小内容可直存 DB。

## 目录规划（新增 Session）

```
src/features/session/
  data-access/
    types.ts                // 事件/命令/产出物/投影 契约
    session-repository.ts   // Dexie：sessions/messages/events/artifacts
    session-store.ts        // Zustand：仅投影
  runtime/
    event-bus.ts           // 本地事件总线（前期内存 + Dexie 存档）
    command-bus.ts         // 命令总线（本地/后端）
    orchestrator.ts        // XState/Saga 编排器
    projectors.ts          // 事件→投影
    transport.ts           // 后端 REST/SSE/WS 适配
  ui/
    ChatWindow.tsx         // 复用 useTextStream，写事件、读投影
```

## 与现有模块的依赖映射

- Literature：输出 paperId/元数据，供 Graph 与 Session（提示词构造）消费；与 Session/Graph 仅数据契约耦合。
- Graph：通过 `GraphDataSource` 与存储解耦；未来可替换为后端数据源，UI 不变。
- Settings：`resolveAIConfig()` 提供 Provider/baseURL/model/key；被 Session 编排/执行器消费。
- AI Streaming：作为执行器被编排器调用；产出 token → 事件 → 投影。
- 本地存储：Dexie 承载 Graph/Session/Events/Artifacts；投影只读写简化快照。

## 实施步骤与子任务拆分

1) 契约与类型：`types.ts`（命令/事件/产出物/投影最小集）。
2) Dexie 表：`session-repository.ts`（sessions/messages/events/artifacts）+ 版本管理。
3) 总线：`event-bus.ts`、`command-bus.ts`（内存实现 + 持久化写入）。
4) 编排器：`orchestrator.ts`（SendMessage/Stop/Regenerate 的最小状态机），执行器对接 `startTextStream`。
5) 投影：`projectors.ts`（AssistantMessageStarted/Appended/Completed/Aborted/Error → session-store）。
6) Transport：`transport.ts`（本地 no-op；预留后端 REST/SSE 接口）。
7) UI：`ChatWindow.tsx`（读投影/派发命令）。
8) Graph 写操作统一走 `dataSource`（减少对 store 的直接耦合）。

## 风险与注意事项

- 幂等与去重：命令需带幂等键；事件按 `serverSeq` 去重；本地 `lastAckSeq` 断点续传。
- 产出物不可变与版本化：避免在事件中嵌入大数据；以 `artifact_id/version` 引用。
- 跨端一致性：以事件存储为权威，投影可重建；离线优先、在线增量同步。
- 性能：事件批处理投影、流式 token 批量合并（已有实现）。

---

本文件为实施参考与统一约定，详细流程示例与状态机图可在后续补充至 `docs/research/session.md`。


