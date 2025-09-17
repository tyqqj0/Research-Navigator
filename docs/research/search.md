## 搜索后端契约与前端集成

### 服务端 API 契约
```
POST /api/search/candidates
Content-Type: application/json

Request:
{
  "seedPaperId": "string",
  "query": "string",
  "limit": 20
}

Response:
{
  "seedPaperId": "string",
  "candidates": [
    { "paperId": "string", "title": "string", "score": 0.86, "meta": { } }
  ]
}
```

建议：响应按 `score` 降序；`meta` 可包含摘要、年份、作者、venue、索引源等。

### 前端集成策略
- 少量高分（<=4 且 score>=阈值）→ 自动加入图谱并连边。
- 否则 → 弹出候选选择 UI；勾选后批量加入。

### 生成 per-node 搜索 query（AI）
输入：用户 `researchQuery`、`direction.focus/tags`、当前节点元信息（标题、摘要、关键词）。

输出 schema（zod）：
```ts
export const PerNodeSearchQuerySchema = z.object({
  query: z.string(),
  filters: z.record(z.union([z.string(), z.array(z.string())])).optional()
});
```

工作流：
1) `ai.generate(mode:'json', schema: PerNodeSearchQuerySchema)`
2) 调用 `/api/search/candidates`
3) 自动/人工加入图谱



