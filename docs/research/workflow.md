## 触发式工作流与最简执行队列

目标：用尽量简单的机制驱动三阶段流程，减少 UI 手工操作，同时保持可控与可中断。

### 触发条件（Triggers）
- T1：`session.researchQuery` 存在 且 `session.direction` 不存在 → 触发“方向确认”。
- T2：`session.direction` 存在 且 图谱尚未满足目标（由策略函数判定） → 触发“图扩展”。
- T3：图谱满足目标 且 `session.finalReport` 为空 → 触发“总结报告”。

触发不立即执行，转化为队列中的 Job，统一由执行器调度。

### 执行队列（Jobs）
Job 结构：
```ts
type JobKind = 'ai.generate'|'ai.summary'|'search.candidates'|'graph.expand';

type Job = {
  id: string;
  kind: JobKind;
  payload: Record<string, unknown>;
  createdAt: number;
  dedupeKey?: string; // 用于去重
  retries?: number;
};
```

执行策略：
- 单消费者顺序执行，避免并发竞态；必要时按 Session 维度串行。
- 去重：相同 `dedupeKey` 的待执行 Job 合并。
- 幂等：同一输入的重复执行不改变最终状态（例如写入前先对比）。
- 失败重试：指数退避；用户可取消。

### 阶段实现为 Job 组合
- 方向确认：`ai.generate(mode:'json', prompt: direction.confirm)` → 更新 `session.direction`。
- 图扩展（循环）：
  1) `ai.generate(mode:'json', prompt: expand.query for node)` → 得 query
  2) `search.candidates(seedPaper, query)` → 候选
  3) `graph.expand(attach policy)` → 自动或人工确认后写入图
- 总结报告：`ai.summary(stream markdown)` → `session.finalReport`

### 满足目标的判定（策略）
```ts
type GraphSatisfaction = {
  minPapers: number;         // 至少 N 篇
  maxHops?: number;          // 扩展半径
  coverageTags?: string[];   // 覆盖方向 tags
};

function isGraphSatisfactory(graph: ResearchGraph, s: GraphSatisfaction): boolean { /* impl */ }
```

### 事件与可观察性
- 每个 Job 在开始/结束时发送 `progress` 事件；AI 相关 Job 还会发送 `message`/`reasoning`。
- UI 订阅队列状态（运行中/等待中/失败/重试次数）。

### 与 n8n/Agent 的关系
- 该设计等价于“固定 Agent Workflow 的轻量内嵌实现”。
- 未来可将 Job 执行器替换为 LangGraph/n8n 后端，保持相同 Job 接口与事件协议。



