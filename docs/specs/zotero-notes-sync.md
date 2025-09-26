# Zotero 笔记同步规格（草案）

## 目标
- 从 Zotero（用户库或群组库）读取笔记（itemType=note），与文献条目建立关联并持久化到本地。
- 支持首次全量导入、之后的增量同步（含删除同步）。
- 兼容当前导入流程：在导入文献时可选“包含笔记”，或在已导入文献后补充同步笔记。

## 术语
- 库范围（Library Scope）：user/{userId} 或 group/{groupId}。
- 条目键（Item Key）：Zotero 条目唯一键，例：ABCD1234。
- 版本（Version）：Zotero 的版本号（If-Modified-Since-Version/Last-Modified-Version 相关语义）。

## 服务端 API 设计
现有代理（已实现）：
- 获取条目子项（用于读取单条文献的笔记）：
  - `GET /api/dataset/zotero/items/{itemKey}/children?itemType=note[&group={groupId}]`

建议新增（仅规划，不落地代码）：
- 批量拉取集合内的所有笔记（分页 + 增量）：
  - `GET /api/dataset/zotero/notes?collection={collectionKey}&group={groupId}&start=0&limit=100&since={version}`
  - 逻辑：透传到 Zotero 对应库下的集合，参数：`itemType=note`、分页 `start/limit`、增量 `since`。
- 拉取删除记录（用于软删除同步）：
  - `GET /api/dataset/zotero/deleted?since={version}[&group={groupId}]`
  - 逻辑：代理 Zotero `/deleted`，从中提取 `items`/`notes` 相关的删除键。

注：如遇集合为空或需要跨集合查询，可在集合层失败时回退为库层批量查询 + 客户端过滤。

## 客户端同步算法
两条路径，按使用场景触发：
1) 导入文献时一并拉取笔记
   - 在批量导入界面增加“包含笔记”开关（默认开）。
   - 对每个被导入/已存在的条目：
     - 优先批量（集合维度）获取笔记，若未覆盖到再对单条目调用 `children?itemType=note` 补齐。
   - Upsert 到本地存储（见数据结构）。

2) 独立的笔记同步（手动或定时）
   - 维度：库或集合。
   - 读取本地保存的 `lastLibraryVersion`（按 user/group 区分）。
   - 使用 `since` 做增量拉取；若缺失则执行全量并更新版本。
   - 同步删除：调用 `/deleted`，将本地匹配的笔记做软删除（或硬删除，视需求）。

## 数据模型（建议）
Notes 表（或集合）核心字段：
- `id`：本地主键。
- `paperId`：关联文献的本地 ID（如无法匹配可暂为空，后续补链）。
- `zoteroKey`：Zotero note 的 itemKey。
- `libraryType`：`user | group`。
- `libraryId`：数值 ID。
- `parentItemKey`：笔记的父条目 key（Zotero `parentItem`）。
- `collectionKeys[]`：所属集合 keys。
- `html`：Zotero 返回的 HTML 内容（原文存储）。
- `markdownCache`：可选，渲染缓存。
- `tags[]`：标签。
- `dateAdded` / `dateModified`：Zotero 时间字段。
- `version`：Zotero 版本号。
- `deleted`：布尔，软删除标记。
- `source`：固定 `"zotero"`。

版本追踪（每库一条）：
- `libraryType`、`libraryId`、`lastLibraryVersion`、`updatedAt`。

## 关联策略
优先依据 `parentItemKey` → 本地 `paperId` 的映射：
- 在导入文献时保存 `zoteroKey ↔ paperId` 映射；
- 若缺失，尝试用 DOI / URL / 标题近似匹配建立关联（带阈值，避免误绑）。

## 失败与回退
- 速率限制：尊重 `Backoff`/429，指数退避重试；限制并发。
- 网络错误：分页级别重试；失败页记录并跳过，后续补偿。
- 内容过大：保留原始 HTML，Markdown 转换作为渲染时的延迟任务。

## UI/UX 变更（最小集）
- 导入面板右上：增加“包含笔记”开关（默认开）。
- 文献详情页：新增“Zotero 笔记”分节，按 `dateModified` 倒序列表；点击展开全文，支持内链/图片懒加载。
- 同步入口：
  - 数据集面板增加“同步笔记”按钮（库/集合层）。
  - 设置页可选定时同步（如每日/每周）。

## 性能建议
- 优先集合维度批量拉取，减少 N×`children` 请求。
- 使用分页 `limit=100~200`（依据实际性能调优）。
- 缓存 `Link` 头的下一页游标，避免重复计算。

## 开放问题
- 跨库重复笔记是否合并展示？（建议按库隔离）
- 删除策略：软删除保留恢复能力，或硬删除释放存储？
- Markdown 转换是否需要规范图片/附件的本地化？


