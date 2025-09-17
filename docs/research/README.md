## Research 宏观设计（V1）

本文件概述“研究模式”的顶层设计：三阶段流程、触发式编排、核心分层与事件协议。目标是在最小复杂度下，支持稳定的流式生成、可观察进度、可持久化的 `session` 状态，并为后续演进（LangGraph/人审/长时任务）留出接口。

### 分层与职责
- **Settings/Config**：提供 `ResolvedAIConfig` 与模型选择（思考模型 thinking / 任务模型 task）。
- **Transport**：统一发起请求与流式解析；输出标准事件：`message`、`reasoning`、`progress`、`error`；支持 Abort/超时/重试。
- **Prompts & Schemas**：固定模板与 zod 校验，版本化管理。
- **Orchestrator/Workflow**：固定流程的步骤与依赖；调用 Transport，不关心网络细节；读写 Session/Graph。
- **State**：唯一顶层状态体 `session`（详见 `session.md`）。
- **UI**：订阅事件流与会话状态，不直接调模型。

### 三阶段主流程（固定 Workflow）
1) 方向确认 Direction
   - 依据 `session.researchQuery` 与 `session.researchGoal` 澄清研究方向与重点（结构化 `focus/tags`）。
   - 选择 1–N 篇种子文献作为图谱起点，初始化 Graph。

2) 图生成 Graph Expansion
   - 以图谱中的纸张节点为中心，调用“AI 生成 per-node 搜索 query”→ 后端搜索 → 得到候选文献。
   - 少量高分自动加入；大量结果由用户筛选后加入；持续“搜索→选择→扩展”，直至满足目标。

3) 总结报告 Summary
   - 输入：研究 query/goal + 完整 Graph；产出：Markdown 报告（可后续附引用与图片块）。

事件示例：
- `progress{ step:'direction'|'expand'|'summary', status:'start'|'end', payload? }`
- `message{ kind:'text', delta }`（正文递增）
- `reasoning{ text }`（可选）
- `error{ message }`

### 触发式编排（Trigger-based）
当 `session` 的关键字段变化时，触发对应子流程（详见 `workflow.md`）：
- 若 `session.researchQuery` 存在但 `session.direction` 不存在 → 触发方向确认。
- 若 `session.direction` 存在但 `session.graph` 未满足目标 → 触发图扩展（可循环）。
- 若图扩展满足目标且 `session.finalReport` 为空 → 触发总结报告。

### 顶层状态：Session（唯一事实源）
`session` 聚合会话的所有领域状态：研究 query/goal、关联集合、研究图谱、方向、报告与运行中元数据；支持 JSON 导入/导出、版本化（详见 `session.md`）。

### 执行模型：最简执行队列
固定工作流下引入“轻量执行队列”（详见 `workflow.md`）：
- Job 类型：`ai.generate`、`ai.summary`、`search.candidates`、`graph.expand` 等。
- 去重/幂等：相同输入的重复 Job 合并；失败可重试；支持取消。
- 进度：通过标准 `progress` 事件对外广播，UI 可观测。

### AI 流式补全（高内聚原语）
统一的 `generateStream`：输入 prompt/messages + 模型类型（thinking/task）+ 可选 json schema；输出统一事件流，支持中断与超时（详见 `ai-streaming.md`）。

### Graph（非 citation graph）
节点/边模型、核心操作与字符串化策略（用于 prompt 压缩/上下文编排），详见 `graph.md`。

### 搜索后端契约
`POST /api/search/candidates`：输入 seedPaper+query，返回候选列表与评分；前端的“自动/人工选择”策略详见 `search.md`。

### 工具与 Prompt/Schema 目录
标准节点/工具清单与 Prompt/Schema 注册表规范，详见 `tools-prompts.md`。



