# 图谱主线与重要性评分设计 v0.9.2

本文档记录图谱构建流程的改进方案，引入"主线"概念和重要性评分系统，优化构图流程并增强可视化效果。

## 1. 设计目标

### 1.1 核心需求
- **重要性评分**：每个文献节点都有重要性值，用于控制节点在UI中的大小
- **主线概念**：从所有论文中选出最重要的几个文献，构成研究主线，在图和JSON中都要体现
- **流程优化**：改进现有的构图流程，使其更加结构化和可控

### 1.2 设计原则
- **最小改动**：尽量在现有数据结构基础上扩展，避免大规模重构
- **向后兼容**：新字段使用可选类型，不影响现有图的导入导出
- **渐进增强**：重要性评分和主线信息作为增强功能，不破坏现有功能

## 2. 方案A：最小改动流程

### 2.1 整体流程

```
搜索完成 → 构图开始
  ↓
【阶段0：重要性评分】（新增，可并行/缓存）
  - 对所有论文计算重要性分数
  - 存储到节点的 meta.importanceScore
  ↓
【阶段1：主线选择】（2步，新增）
  - Step 1.1: 思考主线（基于重要性 + AI判断）
  - Step 1.2: 输出主线 paperId 列表（JSON格式）
  ↓
【阶段2：关系生成】（3步，改进现有流程）
  - Step 2.1: 思考所有论文与主线的关联
  - Step 2.2: 生成关系描述（自然语言，强调主线关系）
  - Step 2.3: 结构化边（从文本提取，标记主线边）
```

### 2.2 阶段0：重要性评分

**目标**：为所有论文计算重要性分数，用于后续主线选择和UI展示

**实现策略**：
- **时机**：构图开始前批量计算，不阻塞构图流程
- **缓存**：如果论文已在库中且已有评分，直接使用；否则实时计算
- **评分来源**：复用现有的 `importanceService`，使用 `calculateQualityScore` 函数
- **存储位置**：节点的 `meta.importanceScore` 字段

**评分维度**（参考现有实现）：
- S1: 年龄归一化引用 = log(1 + influential_citations) / age^α
- S2: 时效性加分 = exp(-age / τ)
- S3: Venue质量 = CCF分级得分
- 综合得分 = w1×S1 + w2×S2 + w3×S3

**输出**：
- 每个节点在 `meta.importanceScore` 中存储数值（0-1范围或原始分数）

### 2.3 阶段1：主线选择

**目标**：从所有论文中选出构成研究主线的核心论文（3-8篇）

**Step 1.1：思考主线**
- **输入**：所有论文的briefs（id, title, firstAuthor, year, abstract）+ 重要性分数
- **AI任务**：基于重要性排序和论文内容，思考哪些论文构成合理的研究主线
- **思考要点**：
  - 主线应该能够贯穿研究主题的发展脉络
  - 考虑时间顺序和逻辑关系
  - 结合重要性分数，但不完全依赖（避免全是高引用但主题分散）
- **输出**：自然语言思考过程（流式输出，用于UI展示）

**Step 1.2：输出主线列表**
- **输入**：Step 1.1的思考结果
- **AI任务**：输出结构化的主线 paperId 列表
- **输出格式**：JSON格式
  ```json
  {
    "mainline": ["paperId1", "paperId2", "paperId3", ...],
    "rationale": "选择这些论文作为主线的理由（中文）"
  }
  ```
- **数量控制**：建议3-8个，可根据图的总节点数动态调整（如10%或固定5-8个）

**存储**：
- 主线 paperId 列表存储到图的 `meta.mainline` 字段
- 每个主线节点在 `meta.isMainline = true` 标记

### 2.4 阶段2：关系生成（改进现有流程）

**目标**：生成所有论文之间的关系，特别强调与主线的关联

**Step 2.1：思考关联**
- **输入**：所有论文briefs + 主线paperId列表
- **AI任务**：分析所有论文如何与主线论文关联
- **思考要点**：
  - 主线内的论文之间如何关联（时间顺序、引用关系、改进关系等）
  - 非主线论文如何与主线论文关联（支持、扩展、应用等）
  - 非主线论文之间的关系（支线关系）
- **输出**：自然语言思考过程（流式输出）

**Step 2.2：生成关系描述**
- **输入**：Step 2.1的思考结果 + 所有论文briefs + 主线列表
- **AI任务**：生成自然语言的关系描述
- **要求**：
  - 优先生成主线内的关系（mainline edges）
  - 然后生成主线到非主线的关系（mainline-to-sideline）
  - 最后生成非主线之间的关系（sideline edges）
  - 使用论文标题而不是ID（便于AI理解）
  - 每条关系给出理由（rationale）和证据（evidence）
- **输出**：自然语言文本（类似现有的 Phase 2 输出）

**Step 2.3：结构化边**
- **输入**：Step 2.2的自然语言描述
- **任务**：从文本中提取结构化边关系
- **处理**：
  - 使用现有的 `structureEdgesFromText` 函数
  - 在提取边时，判断是否为主线边：
    - 如果 `from` 和 `to` 都在主线列表中 → `tags` 包含 `'mainline'`
    - 如果 `from` 或 `to` 任一在主线列表中 → `tags` 包含 `'mainline-to-sideline'`
    - 否则 → `tags` 包含 `'sideline'`
  - 在边的 `meta.isMainlineEdge` 中标记（如果两端都在主线）
- **输出**：结构化的边数组（Edge[]）

## 3. 数据结构扩展

### 3.1 现有数据结构回顾

根据 `src/features/graph/data-access/graph-types.ts`，现有结构为：

```typescript
export interface PaperNode {
    id: PaperId;
    kind: GraphNodeKind;   // 'paper'
    meta?: Record<string, unknown>;  // 可选扩展字段
}

export interface GraphEdge {
    id: EdgeId;
    from: PaperId;
    to: PaperId;
    relation: string;
    tags?: string[];       // 已有标签字段
    meta?: Record<string, unknown>;  // 可选扩展字段
}

export interface ResearchGraph {
    id: GraphId;
    name?: string;
    nodes: Record<PaperId, GraphNode>;
    edges: Record<EdgeId, GraphEdge>;
}
```

### 3.2 扩展方案（在现有基础上）

**节点扩展**：
- `meta.importanceScore?: number` - 重要性分数（0-1范围或原始分数）
- `meta.isMainline?: boolean` - 是否为主线节点

**边扩展**：
- `tags` 字段中可包含：
  - `'mainline'` - 主线内的边（两端都在主线）
  - `'mainline-to-sideline'` - 主线到非主线的边
  - `'sideline'` - 非主线之间的边
- `meta.isMainlineEdge?: boolean` - 是否为主线边（两端都在主线）

**图级别扩展**：
- `ResearchGraph` 类型本身没有 `meta` 字段，但可以考虑：
  - 方案A：在 `name` 字段后添加 `meta?: Record<string, unknown>` 字段
  - 方案B：使用现有结构，主线信息通过遍历节点获取（`nodes` 中 `meta.isMainline === true` 的节点）

**推荐方案**：
- 采用方案B，不修改 `ResearchGraph` 的核心结构
- 主线信息通过工具函数获取：`getMainlineNodes(graph: ResearchGraph): PaperId[]`
- 这样保持数据结构最小化，向后兼容性最好

### 3.3 数据结构示例

**节点示例**：
```json
{
  "id": "paper123",
  "kind": "paper",
  "meta": {
    "importanceScore": 0.85,
    "isMainline": true
  }
}
```

**边示例**：
```json
{
  "id": "edge456",
  "from": "paper123",
  "to": "paper124",
  "relation": "cites",
  "tags": ["mainline", "important"],
  "meta": {
    "isMainlineEdge": true,
    "rationale": "论文A引用了论文B，构成了主线的发展",
    "evidence": ["摘要片段1", "摘要片段2"]
  }
}
```

## 4. 导出功能考虑

### 4.1 现有导出实现

根据 `src/features/graph/data-access/graph-repository.ts`，导出功能为：
```typescript
async exportGraphToJson(graphId: string): Promise<string> {
    const graph = await this.db.graphs.get(graphId);
    return JSON.stringify(graph, null, 2);
}
```

**特点**：
- 直接序列化整个 `ResearchGraph` 对象
- 包含所有 `nodes` 和 `edges`，以及它们的 `meta` 字段
- 格式为标准的JSON，可读性好

### 4.2 导出内容扩展

**自动包含的内容**（无需修改代码）：
- ✅ 节点的 `meta.importanceScore` - 因为存储在 `meta` 中，会自动导出
- ✅ 节点的 `meta.isMainline` - 同上
- ✅ 边的 `tags` 字段（包含 `'mainline'` 等标签）- 已有字段
- ✅ 边的 `meta.isMainlineEdge` - 存储在 `meta` 中，会自动导出
- ✅ 边的 `meta.rationale` 和 `meta.evidence` - 已有字段

**需要确认的内容**：
- 主线列表：由于采用方案B（不存储在图的顶层），导出时需要：
  - 方案1：导出时动态计算主线列表（遍历节点找出 `isMainline === true` 的）
  - 方案2：在导出JSON中添加一个 `_mainline` 字段（仅用于导出，不存储到数据库）
  - **推荐方案1**：保持数据结构纯净，导入时可以从节点恢复主线信息

### 4.3 导入兼容性

**向后兼容**：
- 旧版本的图（没有 `importanceScore` 和 `isMainline`）可以正常导入
- 这些字段是可选的，缺失时使用默认值：
  - `importanceScore` 缺失 → UI中显示默认大小
  - `isMainline` 缺失 → 视为非主线节点

**导入验证**：
- 现有的导入逻辑已经支持 `meta` 字段的任意扩展
- 只需要确保导入时不会因为缺少新字段而报错（已有保护）

## 5. UI展现方案

### 5.1 现有UI结构

根据 `src/features/graph/editor/canvas/GraphCanvas.tsx`，现有UI特点：
- 节点渲染在947-1002行
- 节点大小由 `nodeUi.scale` 控制
- 节点有不同显示模式：`'nano'`, `'micro'`, `'compact'`, `'full'`
- 节点选中状态有视觉反馈（ring-2边框）
- 边有hover tooltip显示关系信息

### 5.2 重要性评分在UI中的展现

**节点大小**：
- **方案A**：根据 `meta.importanceScore` 动态调整节点大小
  - 重要性高的节点 → 更大的 `scale` 值
  - 重要性低的节点 → 更小的 `scale` 值
  - 映射函数：`scale = baseScale * (0.7 + 0.6 * importanceScore)` （示例）
- **方案B**：使用固定大小范围，重要性只影响颜色/边框
  - 所有节点大小相近，但重要性高的节点有更粗的边框或不同的颜色
- **推荐方案A**：更直观，用户一眼就能看出重要性差异

**视觉层次**：
- 重要性高的节点：更大、更突出
- 重要性低的节点：较小、较淡
- 可以考虑添加一个"重要性视图"切换开关，让用户选择是否启用大小差异

### 5.3 主线在UI中的展现

**节点视觉标记**：
- **方案A**：主线节点有特殊的边框样式
  - 例如：主线节点使用 `ring-2 ring-primary` 或特殊颜色边框
  - 或者：主线节点有特殊的图标/徽章（如"⭐"或"M"标记）
- **方案B**：主线节点使用不同的背景色或阴影
  - 例如：主线节点有更明显的阴影或不同的背景色
- **推荐方案A+B结合**：主线节点既有特殊边框，也有轻微的背景色差异

**边的视觉标记**：
- **主线边**（两端都在主线）：
  - 更粗的线条（如 `strokeWidth: 3` vs 普通边的 `2`）
  - 使用主色调（如 `var(--color-primary)`）
  - 可以有动画效果（如轻微的脉冲动画）
- **主线到非主线边**：
  - 中等粗细（如 `strokeWidth: 2.5`）
  - 使用次要色调
- **非主线边**：
  - 标准粗细（`strokeWidth: 2`）
  - 使用较淡的颜色

**图例/筛选**：
- 在图的右上角或侧边栏添加图例，说明：
  - 主线节点样式
  - 主线边样式
  - 重要性大小映射
- 添加筛选开关：
  - "仅显示主线" - 隐藏所有非主线节点和边
  - "高亮主线" - 保持所有节点，但淡化非主线部分

### 5.4 UI交互增强

**节点hover信息**：
- 当hover到节点时，tooltip中显示：
  - 重要性分数（如"重要性: 0.85"）
  - 是否为主线节点（如"主线节点 ⭐"）
  - 如果是主线节点，显示主线序号（如"主线 #1"）

**边hover信息**：
- 当hover到边时，tooltip中显示（已有功能，需要增强）：
  - 关系类型
  - 是否为主线边（如"主线边"标签）
  - 理由和证据（已有）

**右键菜单**：
- 节点右键菜单可以添加：
  - "标记为主线" / "取消主线标记"（如果允许用户手动调整）
  - "查看重要性详情" - 显示评分的各个维度

### 5.5 UI实现位置

**需要修改的文件**：
- `src/features/graph/editor/canvas/GraphCanvas.tsx` - 节点和边的渲染逻辑
- 可能需要新增：
  - `src/features/graph/editor/canvas/MainlineLegend.tsx` - 图例组件
  - `src/features/graph/editor/canvas/GraphFilters.tsx` - 筛选控件组件

**工具函数**：
- `src/features/graph/utils/mainline.ts` - 主线相关的工具函数
  - `getMainlineNodes(graph: ResearchGraph): PaperId[]`
  - `isMainlineNode(node: GraphNode): boolean`
  - `isMainlineEdge(edge: GraphEdge, mainlineNodes: PaperId[]): boolean`
  - `getNodeImportanceScore(node: GraphNode): number | undefined`

## 6. 实施考虑

### 6.1 优先级

**Phase 1（核心功能）**：
1. 重要性评分计算和存储（阶段0）
2. 主线选择流程（阶段1）
3. 数据结构扩展（节点和边的meta字段）

**Phase 2（关系生成改进）**：
1. 改进关系生成流程，强调主线关联（阶段2）
2. 边标签和meta字段的填充

**Phase 3（UI展现）**：
1. 节点大小根据重要性调整
2. 主线节点和边的视觉标记
3. 图例和筛选功能

### 6.2 兼容性策略

**数据迁移**：
- 旧图没有重要性分数 → 首次打开时批量计算（后台任务，不阻塞）
- 旧图没有主线信息 → 可以提供一个"生成主线"按钮，手动触发

**功能开关**：
- 可以考虑添加配置项，允许用户关闭重要性评分或主线功能
- 这样对于不想使用这些功能的用户，可以保持原有体验

### 6.3 性能考虑

**重要性评分**：
- 批量计算时，如果论文数量很大（>100），可能需要分批处理
- 考虑使用Web Worker进行后台计算，不阻塞UI

**主线选择**：
- AI思考过程是流式的，不会阻塞
- 主线列表很小（3-8个），存储和查询都很高效

**UI渲染**：
- 节点大小计算可以在渲染时实时计算，性能影响很小
- 主线判断可以预先计算并缓存，避免每次渲染都遍历

## 7. 待讨论问题

### 7.1 主线数量策略
- **固定数量**：始终选择5-8个（简单，但可能不适合小图或大图）
- **动态数量**：根据总节点数的百分比（如10%），但限制在3-10个范围内
- **用户可配置**：允许用户在构图前设置期望的主线数量

### 7.2 重要性评分权重
- 是否允许用户自定义评分权重（w1, w2, w3）？
- 还是使用系统默认权重？

### 7.3 主线可编辑性
- 是否允许用户在构图后手动调整主线（添加/移除节点）？
- 如果允许，需要提供UI操作入口

### 7.4 导出格式增强
- 是否需要在导出JSON中添加一个 `_metadata` 字段，包含：
  - 主线列表（方便外部工具使用）
  - 重要性评分的统计信息（最大值、最小值、平均值等）
  - 构图时间、版本等信息

## 8. 总结

本方案在现有数据结构基础上进行最小化扩展，通过三个阶段（重要性评分、主线选择、关系生成）改进构图流程，并通过UI增强展现重要性和主线信息。整体设计保持向后兼容，可以渐进式实施。

**关键优势**：
- ✅ 最小改动，复用现有基础设施
- ✅ 向后兼容，不影响现有图
- ✅ 渐进增强，可以分阶段实施
- ✅ 数据结构清晰，易于维护

**下一步行动**：
1. 确认数据结构扩展方案
2. 确定主线数量策略
3. 设计UI视觉样式细节
4. 开始实施Phase 1

