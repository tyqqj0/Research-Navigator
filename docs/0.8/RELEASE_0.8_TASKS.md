# Research Navigator v0.8 — 版本发布任务（问题 → 目标 → 验收标准）

> 范围：最小可用的隐私修复、备份恢复、AI 预设、搜索与界面打磨。

---

## 1）用户数据隔离（sessions/messages/settings）

**当前问题**
- 多用户登录时会出现会话/消息混淆（projection 和 Dexie 复用风险）。
- 本地存储（`sessionRepository`、`useSessionStore`）未按 `userId` 区分，可能数据串用。
- `resolveAIConfig()` 和搜索设置全局存储，未做用户隔离。

**目标状态**
- 所有持久化数据（sessions/messages/events/artifacts/layouts）都以 `userId` 为前缀隔离。
- 内存投影（`useSessionStore`）只展示当前用户数据，切换用户时自动清空/重载。
- 所有缓存和选择器避免混用多用户数据。

**验收标准**
- 切换账户后仅显示当前用户的会话/消息，刷新后无数据串用。
- 新增 Dexie schema 或 key 策略：所有表查询均以 `userId` 过滤。
- 回归验证：分别登录用户A、B，确认数据完全隔离。

---

## 2）全局备份/恢复（JSON 导出/导入）

**当前问题**
- 缺乏一键导出当前用户应用状态，迁移和同步困难。

**目标状态**
- 提供简单备份：把当前用户全部应用数据（sessions, messages, events, artifacts, 图谱, 文献基础信息, 用户设置）导出为单一 JSON 文件。
- 提供恢复流程：可从 JSON 恢复至当前用户下（须有 ID 重映射保护）。

**验收标准**
- UI：设置 → 备份部分有“导出 JSON”与“导入 JSON”按钮。
- 导出 JSON 包含：sessionDb（sessions/messages/events/artifacts/layouts）、graph-db（graphs/nodes/edges 快照）、literature的核心索引或必要字段、用户 `settings`。
- 导入校验：schema 版本、必填项、冲突处理（可新建或覆盖）。
- 导入成功自动刷新数据投影可见，失败弹出报错。

---

## 3）AI 预设硬编码（无需手动配置）

**当前问题**
- 需用户在 UI 自行配置 provider/model/apiKey/baseURL，用起来复杂且易出错。

**目标状态**
- 第一阶段用硬编码 JSON 文件作为预设（仓库维护）：定义如 "thinking"、"task" 等命名配置，含 `provider/model/baseURL/apiKey/header` 等。
- `resolveAIConfig()` 及 `resolveModelForPurpose()` 支持读取预设，无用户配置时可自动选取默认项。

**验收标准**
- 无需用户手动输入，也能直接对话/编排，流程可跑通。
- 支持 purpose 切换如 `thinking` / `task` 返回不同模型；未来切换后端无需改前端调用。
- API key 读取途径需有安全注释及开关（支持从环境变量/预设明文，允许开关明文）。

---

## 4）搜索流程切换后端及 UI 打磨

**当前问题**
- 搜索仅用 Tavily 且需手填 Key，后端搜索 API 未集成。
- 搜索与研究页的 UI 欠精致（缩放徽标、bookmark 样式、加载/流式动画缺失）。
- Prompt 设计粗糙，影响生成质量。

**目标状态**
- `searchExecutor`/`webDiscoveryService` 优先用后端搜索，没后端则回退 Tavily。
- 研究页 UI 升级：缩放控件与徽标/书签样式、Loading 和流式文字渐变动画。
- 基础 Prompt 优化：方向确立、集合扩展、报告生成均有更稳健的系统模板（仅换模板，不动逻辑）。

**验收标准**
- 打开后端搜索时，无 Tavily Key 也能新建/扩展集合；禁用后端则 Tavily 正常备选。
- 研究页缩放控件视觉通过设计验收；流式输出带平滑渐变，无闪烁。
- Prompt 模板：`assistant`, `direction`, `query-generator`, `report` 四处可分别调整且可回滚。

---

## 5）统一 Memory/@ 引用 与工作流/Prompt 管理（同时支持 A/B 方案）

**当前问题**
- 同一会话内多次启动 Deep Research 的运行（Run）与节点（NodeRun）缺少统一标识与历史浏览；复跑与对比不便。
- Prompt 管理分散，缺少统一覆盖（Run/Session/全局预设）、回滚与“本次实际使用 Prompt”的快照。
- Memory（会话记忆）与临时 @ 引用没有统一注入点与 Token 预算控制，导致质量与可复现性不稳。
- 备份/恢复无法完整复现“当时上下文+Prompt”的运行环境。

**目标状态**
- 运行约定：以 `CommandEnvelope.targetTaskId`/`EventEnvelope.taskId` 作为 `runId`；每个编排阶段作为 `NodeRun`（如 `direction/search/evaluate/graph/report/assistant`）。
- 新增 `ContextComposer`：统一整合 `session.meta.memory.pinned`、命令 `inputRefs`（@ 引用解析结果）与 `memory_summary`，产出可注入的 Memory Block，并在 token 超限时自动维护/使用摘要。
- 新增 `PromptRegistry`：按覆盖顺序（Run → Session → 全局 preset）解析各节点模板，输出“已展开 Prompt + 变量 + 模型配置”；每个 `NodeRun` 自动写入 `prompt_snapshot` 与 `context_snapshot` artifacts 以支持复现与回溯。
- UI 支持：
  - 同一会话“再次开启 Deep Research”（新建 Run），提供时间线/下拉切换，不影响既有流程。
  - 节点工具栏提供“查看/编辑本次 Prompt/上下文”“保存为会话默认/全局预设”“回滚到默认”“一键复跑该节点”。
- Token 与质量控制：
  - 设定 Memory 注入预算（如 20–30% tokens）；优先注入 `memory_summary` + 最近 pinned 摘要；必要时基于时间/类型/关键词做轻筛；后续可接入 embedding。
- 用户隔离与备份/恢复：
  - 仅在 `session.meta` 与 `artifacts` 增量使用，天然随当前 v0.8 的“用户隔离/导出导入”方案一并生效。

**验收标准**
- 同一会话内可连续发起≥2次 Deep Research，Run 可切换查看；节点级可复跑，历史可对比。
- `ContextComposer` 在 `assistant`、`direction`、`query-generator`、`report` 四处被调用；在 token 超限时降级为 `memory_summary` + 最近摘要，且可通过开关禁用注入。
- `PromptRegistry` 可读取 `preset.json`；支持 Run/Session 覆盖与回滚；每个 `NodeRun` 自动生成 `prompt_snapshot` 与 `context_snapshot` artifacts，导出导入后可复现查看。
- 会话内 @ 引用：输入框可选择当前会话 artifacts，解析为 `inputRefs` 注入各节点；无 @ 时不影响既有流程。
- 备份/恢复后，任一 Run/NodeRun 的 Prompt 与上下文快照可被完整复现。

---

## 跨层面非功能要求

**安全与隐私**
- 明确用户隔离和密钥渠道；客户端不得持久化明文密钥（如为开发期硬编码需注释开关及 TODO）。

**可观测性**
- 主要日志：搜索来源（backend/tavily）、事件记录数、导入导出状况、编排阶段日志。

**性能**
- 事件批量写入和去重机制保留；动画不阻塞主线程。

---

## 交付验收清单
- [ ] 用户数据隔离完成（schema、读写层、切换流程）。
- [ ] 备份/恢复：JSON 导出/导入（含版本、校验、错误处理、数据刷新）。
- [ ] AI 预设：preset.json 硬编码并完成接入（purpose 匹配功能）。
- [ ] 搜索：优先后端，降级 Tavily，切换配置回退验证。
- [ ] UI 打磨：缩放控件样式、流式渐变动画、细节设计对齐。
- [ ] Prompt 模板：方向、扩展、查询、报告四模板可配置且支持回滚。
- [ ] 统一上下文注入：`ContextComposer` 接入四处提示构建，含 token 预算与 `memory_summary` 降级。
- [ ] Prompt 管理：`PromptRegistry` 支持 Run/Session 覆盖与回滚；节点生成 `prompt_snapshot`/`context_snapshot` artifacts。
- [ ] Deep Research 多次运行：同会话可多次运行并切换；会话内 @ 引用解析为 `inputRefs` 并注入。

