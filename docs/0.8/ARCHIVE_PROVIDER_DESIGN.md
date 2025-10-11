# Research Navigator v0.8 — Archive Services/Provider 设计与数据隔离方案

> 目标：在不破坏稳定文献全局缓存（libraries/citations）的前提下，引入“按档案隔离”的数据访问层，解决多用户/多档案数据串用；并为未来的“多档案切换”与备份/恢复打基础。

---

## 1）范围与现状

- 全局稳定且无需按用户隔离的数据：文献基础信息与引文（不含 usermeta）。现有 `literature-database.ts` 可继续作为“全局库”复用，避免重复抓取与去重成本。
- 需按用户/档案隔离的数据：
  - 会话域：`sessions/messages/events/artifacts/layouts`
  - 图谱域：`graphs/nodes/edges`（引用 paperId）
  - 笔记域、研究树域
  - 文库的 user 相关：`userMetas/collections/collectionItems`

问题根因：多个仓储/Store 直接或间接依赖模块级单例数据库（Dexie 实例）或全局仓储，切换用户时未清空内存投影、未重建 DB 实例，导致串读/串写风险。

---

## 2）关键设计决策（结论）

- 保留“文献全局库”：`libraries/citations` 继续用全局 Dexie 实例，不随用户切换。
- 新增“按档案库”：会话/图谱/笔记/研究树，以及文库的 `userMetas/collections` 使用“按 `archiveId` 命名”的 Dexie 实例。
- 引入 Archive Services 提供器：
  - 管理“当前档案”的所有仓储实例（依赖注入 DB），作为单一访问入口。
  - 默认从登录态自动派生 `archiveId = currentUser.id`；支持手动覆盖，以支持“多档案/游客模式”。
- Provider/Manager 职责边界：只负责“装配与切换实例”；业务读写仍由各 Repository 完成。

---

## 3）架构与职责

### 3.1 组件
- ArchiveManager（基础设施，非 UI）
  - 维护 `archiveId`
  - 创建/缓存 per-archive Dexie 实例与仓储实例
  - 切档：关闭旧实例、重建新实例、发布切换事件
  - 提供 `getServices()` 供业务层调用

- ArchiveProvider（React 上下文）
  - 监听 `useAuthStore.currentUser` 自动切档（可通过 prop 覆盖）
  - 向 React 子树提供 `useArchiveServices()` 钩子

- Repositories（读写层）
  - 不再导出模块级单例，统一通过构造注入对应 DB 实例
  - 文库拆分为 Global 与 Archive 两类仓储

- Stores（Zustand 投影层）
  - 不再直接 import 单例仓储；改为从 ArchiveServices 获取仓储
  - 订阅“档案切换事件”：清空内存 Map/缓存，按需重载

### 3.2 目录建议
- `src/lib/archive/manager.ts`（基础设施：实例装配、切换、订阅）
- `src/lib/archive/provider.tsx`（React 上下文：自动跟随登录态）
- 文库 DB 拆分（分步实施）：
  - `literature-global-db.ts`（libraries/citations）
  - `literature-archive-db.ts`（userMetas/collections/collectionItems）

---

## 4）对登录态与切换的处理

- 默认 `archiveId = useAuthStore.getState().currentUser?.id ?? 'anonymous'`。
- Provider 挂载/登录态变化时：调用 `ArchiveManager.setCurrentArchive(archiveId)`。
- 切档流程：
  1. 关闭旧的 per-archive Dexie 实例（防止连接泄露）
  2. 构建新的 per-archive DB 与仓储集合
  3. 触发“archiveChanged”事件 → 各 Store 清空内存态并按需重载

---

## 5）API 草案（供实现参考）

```ts
// src/lib/archive/manager.ts
export type ArchiveId = string;

export interface ArchiveServices {
  // per-archive
  sessionRepository: SessionRepository;
  graphRepository: GraphRepository;
  notesRepository: NotesRepository;
  researchTreeRepository: ResearchTreeRepository;

  // literature
  literatureGlobal: LiteratureGlobalRepository;   // libraries/citations（全局）
  literatureUser?: LiteratureUserRepository;      // userMetas/collections（按档案，分步导入）
}

export const ArchiveManager = {
  getCurrentArchiveId(): ArchiveId,
  setCurrentArchive(archiveId: ArchiveId): Promise<void>,
  getServices(): ArchiveServices,
  subscribe(listener: (archiveId: ArchiveId) => void): () => void,
};
```

```tsx
// src/lib/archive/provider.tsx
export function ArchiveProvider(
  { archiveIdOverride, children }: { archiveIdOverride?: string; children: React.ReactNode }
) {
  // 1) 从登录态或覆盖值派生 archiveId
  // 2) 监听变化并调用 ArchiveManager.setCurrentArchive(id)
  // 3) 通过 Context 导出 useArchiveServices()
}

export function useArchiveServices(): ArchiveServices { /* ... */ }
```

---

## 6）各域改造要点

- Session/Graph/Notes/ResearchTree：
  - 移除模块级 `new XDatabase()`/单例仓储
  - 导出 `createXDatabase(archiveId)` 工厂；仓储构造注入 DB
  - Store 层通过 `useArchiveServices()` 获取仓储实例
  - 切档事件中：清空 Map（sessions/messages/…）并触发按需重载

- Literature：
  - 保留 GlobalDB 负责 `libraries/citations`
  - 将 `userMetas/collections/collectionItems` 迁移至 ArchiveDB（第二阶段进行）
  - 图谱仍只引用 `paperId`，详情从 GlobalDB 读取

---

## 7）兼容与迁移

- 未发版/开发环境：可直接切为新结构。如需保留数据，可一次性迁移到 `archiveId = 'default'`。
- 已发版/有历史数据：
  - 保持 GlobalDB 不变
  - 为 per-archive 新建 DB 名称（建议 `ResearchNavigator{Domain}__{archiveId}`）
  - 提供一次性迁移脚本（可选）：从旧库读出后写入目标档案

命名建议：`archiveId` 使用 UUID 或短可控 ID；如为任意字符串，需裁剪到固定长度，并在 Dexie 名称中做安全转义。

---

## 8）验收标准（与 v0.8 目标一致）

- 切换用户或档案后，Session/Graph/Notes/ResearchTree 数据完全隔离；刷新后不混淆。
- 文献全局缓存仍复用：换档案查看同一论文不重复抓取。
- 多标签页独立：档案切换在各标签页相互独立，IndexedDB 连接无泄露。
- Store 内存态切换时被清空并按需重载，无“旧数据残留”。

---

## 9）实施顺序（最小可落地）

1. 新增 `ArchiveManager` 与 `ArchiveProvider`（仅装配，不改文库）。
2. 将 Session/Graph 两域改为按档案实例（删除单例，Store 接入 Provider）。
3. Notes/ResearchTree 同步改造。
4. Literature 拆分 Global/Archive（仅迁移 user 相关），保持 libraries/citations 不变。
5. 顶层布局挂载 Provider；必要时提供“档案切换器”（可选）。

---

## 10）风险与注意事项

- 切档时务必调用 `db.close()`，避免 Dexie 连接泄露。
- 严禁仓储内隐式读取 `useAuthStore`；只能由 Provider 注入 `archiveId`。
- Store 清空应幂等（确保“切档事件”触发多次也安全）。
- 长期运行/流式写入的任务需绑定到“当前档案”，切档后应中断或重绑定（后续在编排层完善）。

---

## 11）后续扩展

- 多档案模型：允许用户新建/切换自定义 `archiveId`，而非仅跟随 `userId`。
- 备份/恢复：以 `archiveId` 为单位导入导出（与 v0.8 导出/导入任务对齐）。




---

## 12）当前实现进展与差距（v0.8 快照）

已完成（核心路径已可运行）：

- ArchiveProvider：在 `src/app/layout.tsx` 顶层挂载，自动根据 `useAuthStore.currentUser?.id` 推导并调用 `ArchiveManager.setCurrentArchive()`；通过 Context 暴露 `useArchiveServices()`。
- ArchiveManager：具备 `archiveId` 管理与订阅能力，`getServices()` 作为统一入口；可在切换时通知监听者。
- Session 域接入：
  - `useSessionStore` 改为通过 `ArchiveManager.getServices().sessionRepository` 访问仓储，并在档案切换时清空内存投影（`sessions/messagesBySession/orderedSessionIds`）。
  - Session 仓储（`session-repository.ts`）已完成 v4 升级：表结构带 `userId` 维度；读写接口均按当前用户隔离，并提供布局排序/重排能力（fractional key）。
- 运行态/编排层：各 orchestrator/executor 与 UI 面板（`ChatPanel.tsx`）已切换为经 `ArchiveManager` 访问 session 仓储。

尚缺（按设计目标对齐）：

- ArchiveServices 完整体：目前仅暴露 `sessionRepository`；待补充 `graphRepository/notesRepository/researchTreeRepository`，以及文库 `literatureGlobal`（全局）与可选 `literatureUser`（按档案）。
- Graph 域按档案改造：`graph-repository.ts` 仍为全局 DB（Dexie 名称固定）。需要：
  - 引入 `createGraphDatabase(archiveId)` 并使仓储按 `archiveId` 构造。
  - Zustand `graph-store.ts` 通过 `ArchiveServices` 获取仓储，并在档案切换事件中清空/重载。
- Literature 按设计拆分：
  - 保持 `libraries/citations` 使用全局库（已满足）。
  - 将 `userMetas/collections/collectionItems` 拆至 per-archive DB，形成 `literatureUser`（第二阶段）。
- ArchiveManager 切档资源管理：切换时关闭旧 Dexie 实例，重建并缓存新实例；当前仍为 TODO 占位。

---

## 13）v0.8 实施清单（可勾选）

- [x] 顶层挂载 `ArchiveProvider` 并随登录态切档
- [x] `useSessionStore` 接入 `ArchiveManager`，切档清空投影
- [x] Session 仓储支持 `userId` 维度与布局排序（v4 迁移）
- [ ] `ArchiveServices` 扩充：`graphRepository/notesRepository/researchTreeRepository/literatureGlobal/literatureUser?`
- [ ] Graph 仓储/Store 改为 per-archive DB，并对接切档事件
- [ ] Literature 拆分 user 相关为 per-archive（保持 libraries/citations 全局）
- [ ] ArchiveManager 切档时关闭旧 DB、重建新实例并缓存
- [ ] 为 Graph/Notes/ResearchTree 提供一次性迁移/导入脚手架（可选）
