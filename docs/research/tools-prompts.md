## 工具/节点清单与 Prompt+Schema 注册表

本文件罗列可用的“节点/工具”与其输入输出，及 Prompt 与 Schema 的注册策略。

### 工具/节点（最小集）
- `ai.generate`：通用文本/结构化生成（见 `ai-streaming.md`）。
- `ai.summary`：报告生成（文本流）。
- `search.candidates`：后端搜索。
- `graph.expand`：将候选加入图谱并连边（自动或经由用户确认）。

### Prompt 注册表（建议命名）
- `direction.confirm.v1`：生成 `{ focus, tags[] }`
- `expand.query.v1`：生成 `{ query, filters? }`
- `summary.report.v1`：生成 Markdown 报告（正文），引用/图片后置追加由 orchestrator 控制

### Schema 注册表（zod）
- `DirectionFocusSchema`: `{ focus: string; tags: string[] }`
- `PerNodeSearchQuerySchema`: `{ query: string; filters?: Record<string,string|string[]> }`

### 版本化与演进
- Prompt 与 Schema 都需版本化（`id|vN`）。
- 变更规则：
  - 向后兼容优先；不兼容时并行保留旧版本。
  - 在 orchestrator 中显式选择版本，避免线上回滚风险。



