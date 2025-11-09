# 图谱主线与重要性评分实施总结 v0.9.2

## 实施完成情况

### ✅ 已完成的功能

#### 1. 数据结构扩展
- **位置**: `src/features/graph/utils/graph-utils.ts`
- **功能**: 提供了重要性评分和主线相关的工具函数
  - `getNodeImportanceScore()` - 获取节点重要性分数
  - `setNodeImportanceScore()` - 设置节点重要性分数
  - `isMainlineNode()` - 判断是否为主线节点
  - `setMainlineNode()` - 设置主线节点标记
  - `getMainlineNodes()` - 获取所有主线节点ID
  - `isMainlineEdge()` - 判断是否为主线边
  - `isMainlineToSidelineEdge()` - 判断是否为主线到非主线边
  - `classifyEdgeTags()` - 自动分类边的标签
  - `setMainlineEdgeFlag()` - 设置边的主线标记

#### 2. 构图流程扩展
- **位置**: `src/features/session/runtime/orchestrator/collection.orchestrator.ts`
- **新增阶段0**: 重要性评分计算和存储
  - 使用 `importanceService.scoreForPaperIds()` 批量计算所有论文的重要性分数
  - 将分数存储到节点的 `meta.importanceScore` 字段
  - 更新图中的所有节点
  
- **新增阶段0.5**: 主线选择
  - 调用 `graphBuilderExecutor.thinkingPhase0Mainline()` 选择主线论文
  - 将选中的论文标记为 `meta.isMainline = true`
  - 支持流式输出思考过程

#### 3. 主线选择函数
- **位置**: `src/features/session/runtime/executors/graph-builder-executor.ts`
- **新增函数**: `thinkingPhase0Mainline()`
  - 接受包含重要性分数的briefs
  - 使用AI选择3-8篇核心论文作为主线
  - 返回JSON格式的主线列表和理由
  - 包含fallback机制（如果AI解析失败，使用重要性分数排序）

#### 4. 关系生成改进
- **位置**: `src/features/session/runtime/executors/graph-builder-executor.ts`
- **修改函数**: `thinkingPhase2TextTitles()`
  - 新增 `mainlinePaperIds` 参数
  - 在prompt中明确标注主线论文
  - 要求AI优先生成主线内的关系，然后是主线到非主线，最后是非主线之间的关系

#### 5. 边提取改进
- **位置**: `src/features/session/runtime/executors/graph-builder-executor.ts`
- **修改函数**: `structureEdgesFromText()`
  - 新增 `mainlinePaperIds` 参数
  - 自动为每条边添加分类标签：
    - `mainline` - 两端都在主线
    - `mainline-to-sideline` - 一端在主线
    - `sideline` - 两端都不在主线
  - 在边的 `meta.isMainlineEdge` 中标记主线边（两端都在主线）

### 📋 数据结构

#### 节点扩展
```typescript
{
  id: PaperId;
  kind: 'paper';
  meta?: {
    importanceScore?: number;  // 重要性分数
    isMainline?: boolean;      // 是否为主线节点
  }
}
```

#### 边扩展
```typescript
{
  id: EdgeId;
  from: PaperId;
  to: PaperId;
  relation: string;
  tags?: string[];  // 包含 'mainline' | 'mainline-to-sideline' | 'sideline'
  meta?: {
    isMainlineEdge?: boolean;  // 是否为主线边（两端都在主线）
    rationale?: string;
    evidence?: string[];
  }
}
```

### 🔄 构图流程

新的构图流程（在 `BuildGraph` 命令中）：

1. **阶段0：重要性评分**
   - 批量计算所有论文的重要性分数
   - 更新图中节点的 `meta.importanceScore`

2. **阶段0.5：主线选择**
   - AI选择3-8篇核心论文作为主线
   - 更新图中节点的 `meta.isMainline = true`

3. **阶段1：语义分群**（原有）
   - AI分析论文的语义分组和主线脉络

4. **阶段2：关系生成**（改进）
   - AI生成关系描述，强调主线关系
   - 传递主线信息给AI

5. **阶段3：结构化边**（改进）
   - 从文本提取结构化边
   - 自动标记边的分类（mainline/mainline-to-sideline/sideline）

### 📤 导出功能

**导出功能无需修改**，因为：
- `exportGraphToJson()` 直接序列化整个 `ResearchGraph` 对象
- 所有 `meta` 字段（包括 `importanceScore`、`isMainline`、`isMainlineEdge`）会自动包含在导出的JSON中
- 边的 `tags` 字段也会自动包含

**导出示例**：
```json
{
  "id": "graph-123",
  "nodes": {
    "paper-1": {
      "id": "paper-1",
      "kind": "paper",
      "meta": {
        "importanceScore": 0.85,
        "isMainline": true
      }
    }
  },
  "edges": {
    "edge-1": {
      "id": "edge-1",
      "from": "paper-1",
      "to": "paper-2",
      "relation": "cites",
      "tags": ["mainline"],
      "meta": {
        "isMainlineEdge": true,
        "rationale": "...",
        "evidence": ["..."]
      }
    }
  }
}
```

### 🔙 向后兼容性

- **旧图兼容**：没有 `importanceScore` 和 `isMainline` 的旧图可以正常导入和使用
- **缺失字段处理**：工具函数会安全处理缺失的字段，返回 `undefined` 或默认值
- **导入兼容**：导入时会保留所有 `meta` 字段，不会丢失数据

### 🧪 测试建议

1. **重要性评分**
   - 验证所有论文都能正确计算分数
   - 验证分数正确存储到节点meta中

2. **主线选择**
   - 验证AI能正确选择主线论文
   - 验证fallback机制（当AI失败时使用重要性排序）
   - 验证主线节点正确标记

3. **边分类**
   - 验证边能正确分类为 mainline/mainline-to-sideline/sideline
   - 验证主线边正确标记 `isMainlineEdge`

4. **导出导入**
   - 验证导出JSON包含所有meta字段
   - 验证导入后数据完整保留

### 📝 待完成的工作

1. **UI展现**（Phase 3，未实施）
   - 节点大小根据重要性调整
   - 主线节点和边的视觉标记
   - 图例和筛选功能

2. **性能优化**
   - 重要性评分可以缓存（如果论文已在库中）
   - 批量更新节点可以优化为单次事务

3. **错误处理增强**
   - 更详细的错误日志
   - 用户友好的错误提示

### 🔍 关键文件清单

- `src/features/graph/utils/graph-utils.ts` - 工具函数
- `src/features/session/runtime/executors/graph-builder-executor.ts` - 构图执行器（新增主线选择，改进关系生成和边提取）
- `src/features/session/runtime/orchestrator/collection.orchestrator.ts` - 构图流程编排（新增阶段0和0.5）
- `src/features/graph/data-access/graph-types.ts` - 类型定义（无需修改，使用现有meta字段）
- `src/features/graph/data-access/graph-repository.ts` - 数据仓库（无需修改，导出自动包含meta）

### ✅ 验证清单

- [x] 数据结构扩展完成
- [x] 重要性评分计算和存储
- [x] 主线选择功能
- [x] 关系生成改进
- [x] 边提取和分类
- [x] 导出功能验证（自动支持）
- [ ] UI展现（待实施）
- [ ] 端到端测试

