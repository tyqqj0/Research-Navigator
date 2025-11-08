# Research Navigator 0.9 — 无感同步（Versioned KV）设计方案

> 面向 0.9 发布的「多端无感同步」最小可用实现（MVP）。依赖新版 `@autolabz/data-sdk` 的 Versioned KV（ETag/If-Match/412），结合现有 `ArchiveManager` 分档架构与 Dexie 本地存储。

## 目标与范围

### 目标（用户体验）
- 用户停止操作后 2–3 秒内，在其它端获取最新状态（最终一致性）。
- 不要求实时协作；不要求两个端同时编辑时的强一致性。
- 离线可用；联网后自动收敛。

### 范围（0.9 MVP）
- 会话域：`sessions/messages/events/artifacts/layouts` 的最小必要子集（以会话为粒度同步）。
- 设置与图谱域不在 0.9 MVP 中（可选：预留 Key）。
- 匿名用户不启用云同步（仅本地）。

### 非目标
- 端到端加密（后续版本考虑）。
- 二进制大文件/重资源（仅同步元数据）。
- 多人同时编辑的冲突完美化处理（提供简化合并策略）。

## 背景与现状

- 本地存储：`sessionRepository` 基于 Dexie，4.x 版本已引入 `userId` 维度隔离并配合 `ArchiveManager` 进行“按档案”实例化。
- 归档/备份：已有全量 JSON 导出/导入（`exportArchiveToJson`/`importArchiveFromJson`）。
- 档案管理：`ArchiveManager` 负责按 `archiveId`（通常等于 `currentUser.id`）装配/切换 per-archive 仓储并通知 UI 投影清空/重载。
- 新依赖：`@autolabz/data-sdk` 提供 HTTP 客户端、401 刷新、重试、`createVersionedKV()`（ETag/If‑Match/412 冲突）能力。

## 总体架构

```
┌──────────────────────────────────────────────────────────────────┐
│                            UI / Stores                           │
│  useSessionStore (投影)           Settings UI (开关/手动同步)       │
└──────────────────────────────────────────────────────────────────┘
                 ▲                         ▲
                 │                         │
                 │ 事件/状态                │ 配置/开关
                 │                         │
┌────────────────┴──────────────┐  ┌───────┴──────────────────────┐
│        SyncController         │  │     SyncStateStore (Zustand) │
│  - 调度 Push/Pull/Flush       │  │  - 启用/状态/错误/统计        │
│  - 去抖/轮询/前后台/网络事件  │  └───────────────────────────────┘
│  - 冲突重试/回退              │
└────────────────┬──────────────┘
                 │
                 │ 使用/通知
                 ▼
┌──────────────────────────────────────────────────────────────────┐
│          DataSyncService (per-archive)                            │
│  - RevisionCache（ETag 映射）                                     │
│  - ChangeTracker（本地改动跟踪）                                  │
│  - MergePolicy（412 合并）                                        │
│  - KeyspaceAdapter（会话→KV 结构）                               │
└────────────────┬──────────────────────────────────────────────────┘
                 │
                 │ 读写
                 ▼
┌──────────────────────────────────────────────────────────────────┐
│     Repositories (per-archive Dexie) via ArchiveManager          │
│  sessionRepository / graphRepository / ...                        │
└────────────────┬──────────────────────────────────────────────────┘
                 │
                 │ HTTP（带鉴权/重试/ETag）
                 ▼
┌──────────────────────────────────────────────────────────────────┐
│      @autolabz/data-sdk   +   Versioned KV (server)              │
│  createDataClient + createVersionedKV                            │
└──────────────────────────────────────────────────────────────────┘
```

### 分层说明
- SyncController：单例（随 `ArchiveManager` 当前档案变更重建），负责所有时机与队列调度。
- DataSyncService：封装数据域差异（目前仅“会话”），暴露 Pull/Push API，内部依赖 `RevisionCache/ChangeTracker/MergePolicy`。
- RevisionCache：记录每个 Key 的本地已知 `revision`、上次 Pull/Push 时间、脏标记、墓碑等元数据。
- ChangeTracker：订阅 `sessionRepository` 的变更（或在写入路径上调用 hook），将受影响的 `sessionId` 标记为 dirty。
- MergePolicy：负责 412 时的合并策略（会话元数据 LWW、消息/事件按 id 去重合并）。

## Key 空间与数据模型

### Key 命名（namespace）
- `rn.v1.sessions.index`：会话索引（远端摘要）。
- `rn.v1.session.{sessionId}`：单会话数据。
- 预留：`rn.v1.settings`、`rn.v1.layout`（0.9 不启用）。

### sessions.index（示例）
```json
{
  "version": 1,
  "sessions": {
    "s-1": { "revision": "r_abc", "updatedAt": "2025-10-25T10:00:00Z", "deleted": false },
    "s-2": { "revision": "r_def", "updatedAt": "2025-10-25T10:05:00Z", "deleted": true }
  }
}
```

### session.{id}（示例）
```json
{
  "id": "s-1",
  "title": "My research",
  "updatedAt": "2025-10-25T10:05:00Z",
  "metadata": { "model": "gpt-4o", "tags": ["NLP"] },
  "messages": [
    { "id": "m-1", "role": "user", "content": "...", "createdAt": "..." },
    { "id": "m-2", "role": "assistant", "content": "...", "createdAt": "..." }
  ],
  "events": [ /* 必要事件子集，append-only */ ],
  "artifacts": [ /* 仅元信息或小体量文本 */ ],
  "layout": { /* 可选：面板次序、展开状态等小体量 UI */ },
  "deleted": false
}
```

说明：
- 删除采用“墓碑”（`deleted: true`），并在 `sessions.index` 同步该标记；客户端据此做软删除并清理本地。
- 将大体量/二进制 Artifact 排除出 0.9；如需同步，仅存储引用与轻量元数据。

## RevisionCache（本地元数据表）

建议在 per-archive Dexie 中新增一张小表 `syncMeta`：

```
syncMeta: {
  key: string;              // 例如 rn.v1.session.s-1 / rn.v1.sessions.index
  localRevision?: string;   // 最近一次成功 save 之后的 revision
  remoteRevision?: string;  // 最近一次成功 load 得到的 revision（用于 If-None-Match）
  lastPulledAt?: string;
  lastPushedAt?: string;
  dirty?: boolean;          // 本地有未推送的变更
  tombstone?: boolean;      // 删除标记
}
```

注意：`localRevision` 与 `remoteRevision` 在语义上可合并为“已知远端 revision”，但分离有助于诊断。

## 同步时机与调度

### Push（上传）
- 去抖触发：用户最后一次会话域写入后的 2–3 秒（同一窗口内批量合并）。
- 主动触发：`visibilitychange -> hidden`、`online` 事件、手动“立即同步”。
- 顺序：先 Push session.{id}，成功后更新/合并 sessions.index 并 Push。

### Pull（下载）
- 立即触发：登录完成 / `ArchiveManager` 切档 / app 回前台 / `online`。
- 后台轮询：每 45 秒对 `sessions.index` 做条件载入；304 成本极低。
- 启动序：Pull 优先于 Push（先合入远端以减少 412）。

## 具体流程

### Pull 流程
1. `load('rn.v1.sessions.index', prevIndexRevision)`
   - 304 → 无变更，结束。
   - 200 → 得到 `{ value: index, revision: newIndexRev }`。
2. 计算需要更新的 `sessionId` 集合：
   - 远端新增或 `revision` 不同或 `deleted: true`。
3. 对每个 `sessionId`：
   - `load('rn.v1.session.{id}', prevSessionRevision)`；
   - 304 → 跳过；200 → 写入本地仓储（覆盖/合并），更新 `syncMeta` 的 `remoteRevision`；
   - 若远端 `deleted: true` → 本地做软删除并清理相关数据。
4. 更新本地 `syncMeta` 中 `sessions.index` 的 `remoteRevision=newIndexRev`。

### Push 流程
1. 收集 dirty 的 `sessionId` 集合（ChangeTracker 标记）。
2. 对每个 `sessionId`：
   - 从仓储读取会话快照 → `save('rn.v1.session.{id}', value, currentRevision)`；
   - 成功 → 更新 `localRevision`，并在 `sessions.index` 中将该 id 的 revision 更新为响应的 `newRevision`。
   - 412 → 进入冲突合并流程。
3. 更新/合并 `sessions.index`：
   - 先 `load('rn.v1.sessions.index', prevIndexRevision)`；
   - 在内存中将本次成功保存的会话条目合入（并保留远端对其它会话的变更）；
   - `save('rn.v1.sessions.index', mergedIndex, indexPrevRev)`；如 412 则重试一次：重新 `load` → 合并 → `save`。

### 冲突合并（412）
- 会话元数据（如标题、偏好）：LWW（比较 `updatedAt`）。
- 消息/事件：以 id 去重并按时间排序合并（append-only 假设）。
- 布局：以 LWW 简化；必要时进行字段级合并。
- 合并后以远端最新 `revision` 作为 If-Match 重试 `save`。

### 删除语义
- 本地删除：标记 `(deleted: true, deletedAt)`，Push `session.{id}` → Push `sessions.index`；
- 远端删除：Pull 时看到 `deleted: true` → 本地执行软删除并清理。
- 墓碑 TTL（后续）：服务端可定期清理超期墓碑以控制 Key 空间。

## 组件与接口（建议）

### DataSyncService（per-archive）
- `pullIndexAndSessions(): Promise<void>`
- `pushDirtySessions(): Promise<void>`
- `markSessionDirty(sessionId: string): void`
- 依赖：`createVersionedKV(client)`、`sessionRepository`、`RevisionCache`、`MergePolicy`

### SyncController（单例，跟随档案切换）
- 事件：`app idle`、`visibilitychange`、`online/offline`、`auth ready`、`archive changed`
- 定时：轮询间隔（默认 45s，可配置）
- 策略：启动时 Pull→Push；写入去抖 2.5s；关闭前 Flush 尽力而为

### RevisionCache（Dexie 表）
- `get(key)` / `set(key, meta)` / `markDirty(key)` / `clear(key)`

### MergePolicy
- `mergeSession(local, remote): merged`

## SDK 集成要点

### 客户端初始化（React）
```ts
import { useAuth, createAuthBridgeFromContext } from '@autolabz/auth-sdk';
import { createDataClient, createVersionedKV } from '@autolabz/data-sdk';

const auth = useAuth();
const client = createDataClient({
  baseURL: import.meta.env.VITE_DATA_BASE_URL,
  auth: createAuthBridgeFromContext(auth),
});
const kv = createVersionedKV(client);
```

### 环境与开关
- `VITE_DATA_BASE_URL`：数据服务地址。
- 设置开关：`Enable Cloud Sync (beta)`（默认开启，匿名用户禁用）。
- Feature Flag：`VITE_SYNC_ENABLED`（全局禁用备用）。

## 可靠性与可观察性

- SDK 已内置 429/503/504 重试与抖动；我们仅需控制去抖与并发度（每次批量 ≤ N 个会话）。
- 401 自动刷新由 `auth-sdk` 处理；若刷新失败，暂停同步并在 UI 上提示重新登录。
- 日志：为 Push/Pull/412/重试添加结构化日志（含 `X-Request-Id`）。
- 指标（可选）：成功率、平均延迟、流量、冲突率。

## 安全与隐私

- 仅同步所需字段，排除大体量与敏感内容（后续引入字段级筛选白名单）。
- 传输依赖 HTTPS 与 OAuth 令牌；令牌管理由 `auth-sdk` 负责，不在同步层持久化。

## 启动与降级策略

1) Shadow Read（只 Pull，不写）观测 1–2 天冲突率与延迟；
2) 小流量灰度开启 Push（仅新建/改名/消息追加）；
3) 全量开启会话域 Push/Pull；
4) 后续纳入 settings/layout；
5) 任意阶段可通过开关降级为“仅本地 + 手动全量导出/导入”。

## 测试计划

- 单元：MergePolicy（并发改名 / 消息交错 / 删除合并）。
- 集成：模拟 304/412/429/503/离线/回前台场景，验证调度与重试。
- 端到端：两端交替编辑，验证 2–3s 内最终一致；匿名用户不触发网络请求。

## 验收标准（0.9）

- 单端编辑停止后 3s 内，另一端点击“同步”或等待轮询即可看到变更。
- 断网 → 编辑 → 联网后自动上传并收敛。
- 冲突（轻度并发）不丢消息，标题以 LWW 收敛；无崩溃、无数据串档。

## 与现有代码的集成点（建议落地）

- `ArchiveManager`：在 `setCurrentArchive()` 后构建 per-archive 的 `DataSyncService` 与 `SyncController`；切档时关闭旧实例。
- `sessionRepository`：在 `putSession/putMessage/appendEvent/...` 路径调用 `markSessionDirty(sessionId)`；或通过事件总线统一上报。
- 备份工具：保留全量导出/导入作为“手动云备份”后备方案，可映射为单 Key `rn.v1.archive.snapshot`（可选，不与会话细粒度冲突）。

## 里程碑与任务拆解（执行参考）

1. 搭建 SDK 客户端与 KV 封装；新增 `syncMeta` 表与模型。
2. DataSyncService：Index Pull / Session Pull / Push / 412 合并。
3. SyncController：时机与调度（去抖/轮询/前后台/网络）。
4. 仓储 Hook：ChangeTracker 标记 dirty；匿名禁用。
5. 开关与 UI：设置页开关 + 调试的“立即同步”。
6. 指标与日志：基础埋点与日志统一。
7. 测试：单元、集成、端到端。

---

附：为何需要 `sessions.index`
- 服务器端 Versioned KV 为“按 Key”的条件读写；多 Key 的“是否变更”需要一个汇总入口。
- 通过维护 `sessions.index`，客户端可在 O(1) 请求内发现差异，再对具体会话做条件 GET；304 时开销极低，满足“无感”与低流量目标。


