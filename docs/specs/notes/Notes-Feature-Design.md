## Notes 功能设计（v0.7.x）

本文档定义“笔记（Notes）”的领域模型、前后端接口、同步导入策略，以及在现有 Literature 体系中的集成方式。目标是在不增加用户使用成本的情况下，实现高质量的文献+个人笔记冷启动，并为后续推荐、报告整合与反向标注打基础。

---

### 1. 目标与非目标

- 目标（MVP）
  - 为每个用户在每篇文献下维护多条笔记（1:N）。
  - 前端本地持久化（IndexedDB/Dexie）与后端接口契约明确。
  - 支持 Zotero 单向拉取（pull-only）导入笔记，具备幂等与增量能力。
  - 在文献详情面板新增 Notes 标签页；文献列表显示有无笔记的标记。
  - Service 层自动处理用户上下文（不做 userId 参数下钻）。

- 非目标（MVP）
  - 双向同步与冲突合并（先不做回写）。
  - 单独的全局“笔记页面”（先不做）。
  - PDF/附件导入与图片/截图存储（后续扩展）。

---

### 2. 领域与目录边界

- 新增独立领域 `features/notes`（与 `features/literature` 并列）：
  - `data-access/`：类型、仓储、服务、Dexie 接入
  - `hooks/`：React hooks（查询/增删改）
  - `components/`：`NotesPanel`、`NoteList`、`NoteItem`、`NoteEditor`
- 在 `features/literature` 仅做集成：
  - `LiteratureDetailPanel` 新增 “Notes” 标签页并挂载 `NotesPanel`
  - `LiteratureListPanel` 在卡片或行项上显示笔记数量/有无标记

---

### 3. 数据模型（Types）

关系：`User(1) — Paper(1) — Note(N)`，每条笔记归属“单个用户 + 单篇文献”。

```ts
// Note 来源
export type NoteSource = 'manual' | 'zotero' | 'import';

// 可见性（后续可扩展共享/工作区）
export type NotePrivacy = 'private';

// 外部映射（用于幂等/增量）
export interface NoteExternalRef {
  provider: 'zotero';
  libraryId?: string;     // 用户/群组库
  itemKey: string;        // 唯一键（Zotero）
  parentKey?: string;     // 关联父条目（文章）
  lastModified?: string;  // 用于变更检测
}

export interface NoteModel {
  noteId: string;       // uuid
  userId: string;       // 自动注入
  paperId: string;      // 关联文献
  title?: string;       // 可选标题
  contentMarkdown: string; // 主存储格式（Markdown）
  rawHtml?: string;     // 保留原始 HTML（来自 Zotero）
  tags?: string[];      // 可选标签
  source: NoteSource;   // 来源标记
  externalRef?: NoteExternalRef; // 外部引用（幂等）
  privacy: NotePrivacy; // 默认 private
  isDeleted?: boolean;  // 软删标记（与外部删除同步）
  createdAt: Date;
  updatedAt?: Date;
}
```

说明：
- 统一使用 Markdown 作为主内容格式；Zotero 导入保留 `rawHtml` 以便必要时对比/回写。
- 不做旧数据迁移：现阶段无历史数据，移除 `UserLiteratureMeta.personalNotes` 的 UI 入口即可。

---

### 4. 前端存储（Dexie）

新增表 `notes`：

```ts
// Dexie stores 定义（示意）
notes: `
  &noteId,
  userId,
  paperId,
  [userId+paperId],
  source,
  createdAt,
  updatedAt,
  externalRef.itemKey
`.replace(/\s+/g, ' ').trim(),
```

查询模式：
- 文献详情页按 `paperId` 拉取该用户的所有笔记。
- 列表页批量拉取 `paperId -> notesCount`（可选缓存），用于展示标记。

---

### 5. 后端接口（契约）

仅定义契约，具体实现可由后端落地或临时由前端 mock：

```
GET    /api/notes?paperId=:paperId                // 当前用户上下文
GET    /api/notes/count?paperIds=:ids[]           // 批量计数（可选）
POST   /api/notes                                 // 创建（body: { paperId, title?, contentMarkdown, tags? })
PUT    /api/notes/:noteId                         // 更新（title/content/tags/privacy）
DELETE /api/notes/:noteId                         // 软删

// 导入/同步（MVP：拉取-only）
POST   /api/sync/zotero/notes/pull                // 后端利用安全凭据拉取并入库（推荐）
```

约定：
- 用户上下文由后端依据会话/令牌解析；无需在请求中显式传递 `userId`。
- 幂等：Zotero 笔记以 (`userId`, `externalRef.itemKey`) 唯一；更新按 `lastModified` 或内容哈希。

---

### 6. Service 设计（自动用户上下文）

对齐 Literature 的 Service 模式：不做 userId 参数下钻，内部自动获取当前用户。

```ts
export class NotesService {
  constructor(/* repo, http, authStore 等依赖注入 */) {}

  private getCurrentUserId(): string { /* 从 auth store 读取 */ }

  async listByPaperId(paperId: string): Promise<NoteModel[]> { /* userId 内部注入 */ }
  async create(paperId: string, input: { title?: string; contentMarkdown: string; tags?: string[] }): Promise<NoteModel> {}
  async update(noteId: string, input: Partial<Pick<NoteModel, 'title'|'contentMarkdown'|'tags'|'privacy'>>>): Promise<NoteModel> {}
  async remove(noteId: string): Promise<void> {}

  // 批量计数（可选）
  async countByPaperIds(paperIds: string[]): Promise<Record<string, number>> {}
}
```

说明：
- 与 `composition-service` 一致，内部通过 `authStore` 获取 `userId`，避免参数下钻。
- 与 Repo 层配合支持 Dexie 本地持久化与远端同步（可先本地，后接后端）。

---

### 7. Zotero 导入/同步（Pull-only, 幂等）

组件/职责划分：
- `ZoteroClient`：封装 API 调用（分页、限速、指数退避）。
- `NotesSyncService`：将 Zotero 笔记映射为 `NoteModel` 并入库（幂等）。

流程：
1) 拉取 `type=note` 的条目，读取 `parentItem` 以定位对应文献。
2) 文献匹配优先级：DOI/S2/arXiv → 失败则 title+作者+年份 模糊匹配。
3) 匹配不到 → 放入“未匹配笔记箱”，等待用户在 UI 中手动绑定 `paperId`。
4) 内容转换：HTML → Markdown；保留 `rawHtml`。
5) 幂等键：(`userId`, `externalRef.itemKey`)，变更检测使用 `lastModified` 或内容哈希。
6) 删除同步：外部删除 → 本地 `isDeleted=true` 软删。

后续阶段（非 MVP）：
- 双向同步：增加 `syncState: 'clean'|'dirty'|'conflict'` 与版本号；冲突以“保留两版+提示”解决。
- 回写策略：在 HTML/Markdown 转换质量可控后启用。

---

### 8. UI/UX 方案（MVP）

集成点：`LiteratureDetailPanel` 新增 Notes 标签页；`LiteratureListPanel` 展示笔记标记。

- `NotesPanel`（挂载在详情右侧 Tabs）：
  - 列表：显示当前文献的笔记（按 `updatedAt` 倒序）。
  - 新建：内联编辑（简易 Markdown 编辑，可先用 Textarea）。
  - 编辑：点击进入编辑模式；保存/取消；删除（软删）。
  - 来源徽标：`zotero`/`manual`。

- `LiteratureListPanel` 标记：
  - 若该文献存在笔记，显示一个小徽标或计数（`notesCount`）。

- 不新增独立“笔记页面”，减少信息架构复杂度；后续若需跨文献检索/聚合，再扩展。

可访问性与性能：
- 列表仅渲染可见项；详情页懒加载 `notes`。
- 编辑控件具备键盘可达性；提供保存/取消的明确反馈。

---

### 9. 与现有界面元素的变更

- 移除 `LiteratureDetailPanel` 里旧的“纯文字个人笔记”输入区域。
- 在右侧 Tabs 新增 `Notes` 标签页，替换旧入口。
- 在文献列表项增加“有无笔记/计数”标记（不改变现有布局结构）。

---

### 10. 里程碑与验收标准

里程碑 A：模型与接口
- [ ] `NoteModel`、Dexie schema、NotesService（本地）完成。
- [ ] 后端 API 契约冻结（或提供 mock）。

验收：
- 能为任一文献创建/编辑/删除多条笔记，刷新后数据持久。

里程碑 B：UI 集成
- [ ] `LiteratureDetailPanel` 新增 `Notes` 标签页并挂载 `NotesPanel`。
- [ ] 列表显示笔记标记（或计数）。

验收：
- 详情页可查看/新增/编辑/删除笔记；列表正确标记。

里程碑 C：Zotero 拉取（单向导入）
- [ ] 支持凭据配置（后端/安全存储）。
- [ ] 可按页拉取笔记并入库，具备幂等与增量。
- [ ] 未匹配笔记进入“待关联”视图。

验收：
- 重复拉取不产生重复笔记；更新按 `lastModified` 生效。

---

### 11. 决策与答复（针对提出的问题）

- 是否为每条 Note 做组件？
  - 采用轻量拆分：`NotesPanel`（容器）内含 `NoteList` 与 `NoteItem`；`NoteEditor` 用于创建/编辑。这样保证维护性与复用性，同时避免过度组件化。

- 组件放在哪里生成？
  - 在 `LiteratureDetailPanel` 的右侧 Tabs 中新增 `Notes`，在该 Tab 渲染 `NotesPanel`。

- 旧数据兼容需要吗？
  - 不需要。当前无历史数据。移除旧的 `personalNotes` UI 入口即可（模型保留与否不影响本期）。

- 是否单独做“笔记页面”？
  - 不做。先在文献详情内聚焦体验，列表显示标记即可。

- Service 是否自动处理用户上下文？
  - 是。`NotesService` 对齐 literature 的 Service 模式，内部读取当前用户，不做 userId 参数下钻。

---

### 12. 开放问题（需要拍板）

1) 未匹配的 Zotero 笔记：是否需要在 UI 中提供“待关联”收纳箱（建议：提供）。
2) Markdown 编辑器：先用 Textarea 还是引入轻量编辑器（建议：Textarea MVP，预留替换接口）。
3) 列表计数的来源：实时计算 vs 定时缓存（建议：服务层提供 `countByPaperIds`，内部缓存）。

---

### 13. 附：字段映射（Zotero → NoteModel）

| 来源字段     | Note 字段                 | 说明                      |
| ------------ | ------------------------- | ------------------------- |
| itemKey      | externalRef.itemKey       | 幂等主键之一              |
| libraryId    | externalRef.libraryId     | 库标识                    |
| parentItem   | externalRef.parentKey     | 父条目（文章）            |
| dateModified | externalRef.lastModified  | 变更检测                  |
| note (HTML)  | rawHtml / contentMarkdown | HTML → Markdown；保留原文 |
| tags         | tags                      | 可选                      |

匹配文献（parentItem → paperId）：
- 优先：DOI/S2/arXiv →
- 失败：title+作者+年份 模糊匹配 →
- 仍失败：进入“待关联”视图。

---

（完）


