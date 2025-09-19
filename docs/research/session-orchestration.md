## 会话编排与循环设计（方向 → 集合 → 图谱 → 报告）

本文件回答：
- 如何处理“多轮循环、用户确认、AI 反复提案”的流程；
- 阶段拆分、结束条件、触发方式；
- 是否需要 XState、以及不用库如何落地；
- 命令/事件/产出物的数据契约；
- 文件/模块的组织方式与 UI 交互点。

---

## 总览

阶段划分（三大阶段，第二阶段含三小步）：
1) 方向确定（不做检索）
   - 目标：从用户一个宽泛的 query 出发，反复澄清，产出一个“清晰的研究目标 + 约束/边界”。
   - 机制：AI 提案 → 等用户确认/修改 → 记录决策 → 循环直到确认。
2) 文献集合构建（初始化 → 扩展循环 → 过滤/精选）
   - 初始化集合：根据目标，做首次检索得到 seed 集合（batch#0）。
   - 扩展循环：依据现有集合反复生成检索式/邻近扩展（batch#1..k），可多次迭代，直到满足条件或用户停止。
   - 过滤/精选：根据规则（引用量、相似度、时间窗等）筛选形成“用于建图的候选集合”。
3) 图谱与报告
   - 图谱构建：先节点（集合 → 节点），再关系（AI/规则）分批产出边（渐进更新）。
   - 报告生成：基于目标+集合+图谱分阶段生成（提纲 → 草稿 → 精修）。

关键原则：
- 命令（意图）与事件（事实）分离；事件引用产出物（artifacts），不嵌大数据；
- 循环过程用“提案/确认/拒绝”事件驱动，用户与 AI 均可触发；
- 结束条件为“多条件任意满足”：AI 评估/规则达成/用户按钮操作。

---

## 阶段一：方向确定（循环确认）

状态机（简化）：
- idle → collect_input → propose → wait_user_decision →
  - confirm → direction_confirmed（结束）
  - refine → collect_input（继续）
  - cancel → idle

命令（intent）：
- ProposeDirection { sessionId, userQuery }
- DecideDirection { sessionId, action: 'confirm' | 'refine' | 'cancel', feedback? }

事件（fact）：
- DirectionProposed { sessionId, proposalText, checklist, assumptions }
- DirectionDecisionRecorded { sessionId, action, feedback? }
- DirectionConfirmed { sessionId, directionSpec }

UI 交互：
- Chat 回复里附带“提案卡片”（方向概要、关键问题、边界），按钮：确认/继续完善；
- 用户点击按钮 → 派发 DecideDirection 命令；
- 若“继续完善”，AI 会基于反馈生成新一版提案（循环）。

产出物（artifact）：
- direction_spec vN（不可变，事件引用最新版本）。

---

## 阶段二：文献集合构建（三步，其中第二步为循环）

2.1 初始化集合（单次）
- 命令：InitCollection { sessionId, directionRef }
- 事件：SearchExecuted { batchId, query }
- 事件：PapersIngested { batchId, count }
- 事件：CollectionUpdated { collectionId, version }

2.2 扩展循环（多次）
- 状态机：expand_loop.running → { execute_search → ingest → evaluate } →
  - continue → running
  - stop → done
- 命令：
  - ExecuteSearch { sessionId, strategy, seedRef? }
  - MergeCollection { sessionId, batchId }
  - EvaluateCollection { sessionId, metrics }
  - StopExpansion { sessionId, reason? }（用户或 AI 决策）
- 事件/条件：
  - SearchExecuted / PapersIngested / CollectionUpdated
  - ExpansionEvaluated { addedCount, dupRate, coverageScore }
  - ExpansionStopped { by: 'user'|'ai'|'rule', reason }

结束条件（任一满足）：
- 总量达到阈值（≥N）；最近 M 轮增量 < T；覆盖指标达标；用户点击“停止扩展”。

2.3 过滤/精选（单次或少量迭代）
- 命令：SelectCandidates { sessionId, collectionRef, ruleSet }
- 事件：CandidatesSelected { candidateRef, ruleSet }
- 规则示例：引用量分位、主题相似度阈值、时间窗、Top-K。

产出物：
- search_batch_k、literature_collection vN、candidate_set v1。

---

## 阶段三：图谱与报告

图谱（渐进）：
- 命令：BuildGraph { sessionId, candidatesRef }
- 事件：GraphNodesUpdated { graphId, nodeCount }
- 命令：InferEdges { sessionId, graphId, strategy }
- 事件：GraphEdgesUpdated { graphId, addedEdges }
- 事件：GraphBuilt { graphId, version }

报告（可流式）：
- 命令：GenerateReport { sessionId, graphRef, directionRef }
- 事件：ReportDelta / ReportCompleted（产出 report vN）。

UI：
- 中栏 `GraphCanvas` 订阅 graphId；右栏列表绑定 candidate_set / collection 投影；
- 左栏 Chat 展示报告流式文本与“重新生成/微调”按钮。

---

## 循环与确认的通用建模

提案/确认/拒绝三件套：
- ProposalGenerated { type, version, summary }
- DecisionRequested { type, proposalVersion }
- DecisionRecorded { action: confirm|refine|cancel, feedback? }

实现要点：
- 所有“需要用户确认”的节点都发 DecisionRequested；
- UI 在消息卡上渲染按钮；
- 点击后派发 DecideXxx 命令，事件闭环；
- 支持多次 refine，使用 proposal version 做幂等与回溯。

---

## 是否采用 XState？

建议：
- 复杂循环（方向确认、扩展循环）用 XState 更易表达“状态/子状态/守卫/并发”，易测试；
- 若不引入库，也可在 orchestrator 内维护一个 `sessionRuntimeState`（内存状态机），用命令/事件推进状态。

XState 示例（方向阶段伪代码）：
```ts
// states: idle → propose → waitDecision → done
on: {
  ProposeDirection: { target: 'propose' }
}
states: {
  propose: { invoke: genProposal, onDone: 'waitDecision' },
  waitDecision: {
    on: {
      DecideDirection_confirm: 'done',
      DecideDirection_refine: 'propose',
      DecideDirection_cancel: 'idle'
    }
  },
  done: { type: 'final' }
}
```

不用库的实现（当前仓库已采用）：
- 在 `chat.orchestrator.ts` 里维护 Map<sessionId, runtimeState>；
- 处理命令时读取状态，依据守卫/条件发后续命令与事件；
- 用事件更新 runtimeState 与投影；
- 需要并发子流程时为其分配子 taskId 与状态子对象。

选择策略：先用“轻量内置状态机”（无需额外依赖），后续若阶段/分支增多再切 XState，事件/命令/产出物契约不变。

---

## 数据契约（在 types.ts 基础上扩展）

命令（示例）：
- ProposeDirection { sessionId, userQuery }
- DecideDirection { sessionId, action, feedback? }
- InitCollection { sessionId }
- ExecuteSearch { sessionId, strategy, seedRef? }
- MergeCollection { sessionId, batchId }
- EvaluateCollection { sessionId, metrics }
- StopExpansion { sessionId, reason? }
- SelectCandidates { sessionId, ruleSet }
- BuildGraph { sessionId, candidatesRef }
- InferEdges { sessionId, graphId, strategy }
- GenerateReport { sessionId, graphRef, directionRef }

事件（示例）：
- DirectionProposed / DecisionRequested / DecisionRecorded / DirectionConfirmed
- SearchExecuted / PapersIngested / CollectionUpdated / ExpansionEvaluated / ExpansionStopped
- CandidatesSelected
- GraphNodesUpdated / GraphEdgesUpdated / GraphBuilt
- ReportDelta / ReportCompleted

产出物：
- direction_spec vN、search_batch_k、literature_collection vN、candidate_set vN、graph_snapshot vN、report vN

---

## 文件与模块划分

runtime/
- orchestrator/
  - chat.orchestrator.ts（已）
  - direction.orchestrator.ts（方向阶段子流程）
  - collection.orchestrator.ts（扩展循环子流程）
  - graph.orchestrator.ts（建图子流程）
  - report.orchestrator.ts（报告子流程）
- executors/
  - assistant-executor.ts（已，对接 AI 流）
  - search-executor.ts（检索，对接后端或本地 mock）
  - graph-executor.ts（写 GraphRepository/适配器）
  - report-executor.ts（报告流）
- projectors.ts（扩展事件映射，更新阶段/进度/计数/refs）
- command-bus.ts / event-bus.ts（已）

data-access/
- types.ts（已，扩展命令/事件联合类型）
- session-repository.ts（已：sessions/messages/events）
- session-store.ts（已：Zustand 投影）

ui/
- ChatPanel.tsx / GraphPanel.tsx / CollectionPanel.tsx / SessionPage.tsx
- 交互：提案卡、确认按钮、停止扩展、生成报告等。

---

## 结束条件、暂停/恢复、错误处理

结束条件：
- 按阈值（数量/覆盖度/增量）或显式 Stop 命令结束；
- 守卫统一在 orchestrator 中实现，事件写入评估指标。

暂停/恢复：
- 命令：PauseStage / ResumeStage；
- runtimeState 持久化（sessionDb.events + 最近快照），Resume 后根据状态继续派发命令。

错误处理：
- 所有执行器产出 Failed 事件，orchestrator 记录 attempt 计数与退避策略；
- UI 给出重试/跳过选项，命令驱动继续。

---

## UI 交互点清单

- 方向阶段：提案卡（确认/继续完善），可编辑反馈；
- 集合阶段：进度条（总量、增量、去重率、覆盖指数）、停止扩展按钮、规则选择器；
- 图谱阶段：边/节点渐进数；
- 报告阶段：流式预览、重生/微调；
- 任何阶段：暂停/恢复、查看事件日志（审计）。

---

## 渐进实施建议

1) 扩展 `types.ts` 命令/事件；完善 projectors 维护阶段与进度。
2) 在 `chat.orchestrator.ts` 内先内嵌 direction + collection 简化状态机；
3) 落地 `search-executor`（mock），完成扩展循环与阈值结束；
4) 接 GraphRepository 渐进产出节点/边；
5) 报告流可先简单拼接说明文字，后续再完善提示词与结构。


