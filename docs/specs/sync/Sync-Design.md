## 同步设计（确认版 + Dataset 方案）

本设计基于现有代码与你的最新确认，聚焦“批量接收标识 → 通过后端批量端口解析 → 入库并加入集合”的流程，以及“区域抓取到集合”的旧版能力在新版中的落位。前端不新增独立同步 API 路由，直接复用现有 Data Access 与后端批量端点适配；授权方式为 API Key。

---

### 1. 范围与目标

- 批量接收标识（DOI、S2、CorpusId、ArXiv、URL 等），走“后端批量解析端口”并入库。
- 前端复用已有入口：`literatureEntry.batchImport()` 与 `backendApiService.getPapersBatch()`，不新增前端 API route。
- 支持“区域抓取 → 选择集合 → 批量导入并加入该集合”的编排，与旧版一致。
- 不引入新的全局同步 store；进度/结果由调用侧组件掌控（必要时通过回调/事件聚合）。

- Dataset（外部源）模块：提供“读取外部库结构/条目/笔记”的统一前端适配层，拉取只读数据并桥接到现有 `literature` 与 `notes`。
  - 不改动现有 literature/后端；dataset 仅负责：连接、读取、解析映射、预览、导入编排。
  - 设置读取：复用 `useSettingsStore`，在设置页暴露 dataset 的 API Key/Endpoint 配置。

---

### 2. 关键现有实现（引用）

- 文献批量导入入口（归一化、后端批量、缺口单条回退、批量加入集合）：
```480:689:src/features/literature/data-access/index.ts
    async batchImport(entries: Array<{
        type: 'identifier';
        data: string;
        options?: any;
    }>): Promise<{
        successful: LibraryItem[];
        failed: Array<{ entry: any; error: string }>;
    }> {
        ...
        const res = await backend.getPapersBatch(uniqueNormalized);
        ...
        // 对未命中的标识降级成单条调用（并发限制）
        const missing = uniqueNormalized.filter(n => !normToPaper.has(n));
        const concurrency = 4;
        ...
        // 分组：按集合选项批量加入集合
        const collectionGroups = new Map<string, string[]>();
        ...
        // 批量加入集合，并同步 CollectionStore + 图谱
        if (collectionGroups.size > 0) {
            const userId = this.authUtils.getStoreInstance().requireAuth();
            for (const [cid, paperIds] of collectionGroups.entries()) {
                await this.services.collection.addLiteratureToCollection(cid, unique, userId);
                ...
            }
        }
        return { successful, failed };
    }
```

- 后端批量端点适配（POST `/api/v1/paper/batch`）：
```107:166:src/features/literature/data-access/services/backend-api-service.ts
    async getPapersBatch(paperIds: string[]): Promise<LibraryItem[]> {
        ...
        const response = await this.apiRequest('POST', '/api/v1/paper/batch', { ids: needFetch });
        const items = Array.isArray(response) ? response : (response.papers || response.items || []);
        const valid = items.map(this.mapBackendToFrontend).filter(x => x && x.paperId);
        ...
        return result; // 合并缓存并按原顺序
    }
```

- 会话编排使用批量导入并直接加入集合（“区域抓取/会话扩展”对应新版用法）：
```139:169:src/features/session/runtime/orchestrator/collection.orchestrator.ts
const result = await literatureEntry.batchImport(
  identifiers.map((id) => ({ type: 'identifier', data: id, options: { addToCollection: collectionId } }))
);
// 再读取集合计算真正新增数量
```

- 集合数据访问与 Store 同步能力：
```1022:1105:src/features/literature/data-access/index.ts
class CollectionDataAccessImpl implements CollectionDataAccessAPI { ... }
```

---

### 3. 同步流程（落地）

1) 收集标识（包括“区域抓取”的来源）：得到 `string[] identifiers`。
2) 指定目标集合 `collectionId`（可选，若为空则仅入库不分组）。
3) 调用：
```ts
await literatureEntry.batchImport(
  identifiers.map(id => ({ type: 'identifier', data: id, options: { addToCollection: collectionId } }))
);
```
4) 行为细节：
- 归一化标识，过滤 URL-only（提示改用 DOI/ArXiv）。
- 优先使用后端批量端口；未命中的降级到单条查询（并发 4）。
- 已存在文献：立即同步到列表，并即时写入集合 Store（避免 UI 延迟）。
- 新创建文献：通过组合服务创建并同步 Store；同时收集待加入集合的分组。
- 末尾批量将分组写入集合（去重），并为绑定图谱的会话追加节点。

备注：若“区域抓取”提供的是“集合目标路径”，在集合域已有创建/获取能力：
```214:235:src/features/literature/hooks/use-collection-operations.ts
const collection = await literatureDataAccess.collections.createCollection(input);
```
可先按路径创建/定位集合，再把 `collectionId` 注入 `batchImport` 的 `options`。

---

### 4. 授权与配置

- 授权使用 API Key；由 `backendApiService` 构造时注入：
```561:565:src/features/literature/data-access/services/backend-api-service.ts
export const backendApiService = new BackendApiService({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000',
  apiKey: process.env.NEXT_PUBLIC_API_KEY
});
```
- 前端不新增额外 API route；所有解析/查重/引用处理均由后端负责。

---

### 5. UI/设置入口（最小改动）

- 在设置页新增或复用一处“账号与同步”区域：
  - 配置显示/填写 API Key（保存到环境或受控配置）。
  - 选择目标集合（或新建/选择目录型集合）。
  - 触发“从区域抓取导入”按钮，传入 identifiers 与 collectionId，调用 `batchImport`。
  - 展示导入反馈（成功/失败数、失败原因前若干条）。

注：现有 `src/app/settings/page.tsx` 已有多 Tab 架构，可复用新增 Tab；也可在功能入口处以对话框方式承载。

---

### 6. 行为与边界

- 幂等：
  - 标识层面：`batchImport` 内部去重（同一归一化标识仅处理一次）。
  - 集合层面：批量加入前去重；已存在不会重复加入。
- 失败处理：
  - 批量阶段失败将降级单条重试；单条失败记录到 `failed[]`。
  - URL-only 标识直接反馈错误提示。
- 性能：
  - 后端批量端点优先；单条并发默认 4，可根据后端限速调整。
  - 本地缓存命中（`BackendApiService`）降低重复请求。

---

### 7. 对旧版“区域抓取 → 导入到集合路径”的映射

- “选择某些集合进行导入”：通过 `options.addToCollection` 或 `addToCollections` 注入集合 ID。
- “导入后直接创建集合路径”：调用集合 Data Access 的 `createCollection`/`getCollection`，得到 ID 后再调用 `batchImport`。
- 结果统计：可参考会话 orchestrator 的“导入前后集合差集”办法，准确计算新增数量：
```151:164:src/features/session/runtime/orchestrator/collection.orchestrator.ts
const after = await literatureDataAccess.collections.getCollection(collectionId);
const newlyAdded = afterIds.filter(pid => !beforeSet.has(pid));
```

---

### 8. Dataset 模块设计

目录与分层（与 `features/literature`、`features/notes` 并列）：

```
src/features/dataset/
  data-access/
    dataset-types.ts            // 对外暴露的领域类型（Provider/Node/Item/Note 映射）
    dataset-adapter.ts          // 适配层接口定义（connect/list/preview/fetchNotes）
    providers/
      example-provider.ts       // 示例/占位 provider（HTTP API）
    dataset-service.ts          // 聚合服务：读取设置 → 适配器 → 解析映射
  hooks/
    use-dataset.ts              // 拉取结构、分页条目、选择集合并发起导入
  components/
    DatasetSyncPanel.tsx        // 左树（文件夹/集合） + 右侧列表（文献/笔记预览）
```

核心接口（示例）：

```ts
// dataset-types.ts（核心契约）
export type DatasetProvider = 'zotero' | 'notion' | 'obsidian' | 'custom';

export interface DatasetAuthConfig {
  apiKey?: string;
  apiBase?: string;
  libraryId?: string;
}

export interface DatasetNode { id: string; name: string; kind: 'root' | 'folder' | 'collection'; parentId?: string | null; totalItems?: number; }

export interface DatasetPaperItem { id: string; title: string; authors?: string[]; year?: number; doi?: string | null; url?: string | null; s2Id?: string | null; extra?: Record<string, any>; }

export interface DatasetNoteItem { id: string; paperExternalId: string; title?: string; markdown?: string; rawHtml?: string; tags?: string[]; externalRef?: Record<string, any>; }

export interface IDatasetAdapter {
  connect(cfg: DatasetAuthConfig): Promise<{ ok: boolean; message?: string }>
  listNodes(): Promise<DatasetNode[]>;
  listPapers(nodeId: string, opts?: { cursor?: string; limit?: number }): Promise<{ items: DatasetPaperItem[]; next?: string }>
  listNotesByPaper(paperExternalId: string): Promise<DatasetNoteItem[]>;
}
```

服务编排（`dataset-service.ts`）：
- 读取 `useSettingsStore` 中 dataset 配置（如 `settings.ai` 内或新增 `settings.dataset`，见下一节）。
- 基于 provider 选择适配器实例；仅进行读取与解析，不持久化。
- 将 `DatasetPaperItem` 转换为 `literatureEntry.batchImport` 的 identifiers（优先 DOI/ArXiv/URL/S2）。
- 将 `DatasetNoteItem` 转换为 `notesService.create({ paperId, ... })`（需在导入后以映射表对齐 `paperExternalId -> paperId`）。

UI（`DatasetSyncPanel.tsx`）：
- 左侧树：`DatasetNode[]`，显示名称与 `totalItems`；点击加载右侧列表。
- 右侧列表：基本字段（标题、作者、年份、DOI/URL/S2），支持分页加载；勾选若干项、或全选当前节点。
- 顶部工具条：选择目标集合（或新建）、导入按钮；进度与结果 toast。
- 可选预览笔记数量（调用 `listNotesByPaper` 计数）；导入时按需创建笔记。

导入编排：
1) 组装 identifiers → 调 `literatureEntry.batchImport(entries)` 写入并加入集合。
2) 获取 `paperExternalId -> paperId` 的映射（根据后端返回的 DOI/S2 与本地 `paperId` 匹配；或在导入过程中维护临时映射）。
3) 拉取笔记并调用 `notesService.create` 落本地 Dexie（来源标记为 `import`，并保留 `externalRef`）。

幂等与增量：
- 以外部 `item.id`/`note.id` + provider 标记为幂等键，导入时检查是否已存在（在 notes 仓储中扩展索引或通过 `externalRef` 检查）。
- 文献层幂等由现有 literature 判重+集合去重保证。

---

### 9. 设置扩展（dataset 配置）

在不影响现有结构的前提下，建议在 `UserSettings` 中新增 `dataset` 小节（默认空字符串，不会破坏已存数据）：

```ts
// settings-types.ts（建议）
export interface DatasetSettings {
  provider: DatasetProvider;         // 'zotero' | 'notion' | ...
  apiKey?: string;
  apiBase?: string;
  libraryId?: string;                // 例如 Zotero 用户库/群组库
}

export interface UserSettings {
  ai: AISettings;
  search: SearchSettings;
  ui: UISettings;
  research: ResearchSettings;
  dataset?: DatasetSettings;         // 可选，默认 undefined
  version: string; createdAt: Date; updatedAt: Date;
}
```

默认值可设为 `dataset: { provider: 'zotero', apiKey: '', apiBase: '', libraryId: '' }`，设置页提供一个 Tab 或分组编辑以上字段。adapter 读取优先顺序：override > settings.dataset > env。

---

- 进度事件：如需 UI 侧进度条，可在调用侧包装 `batchImport`，按阶段发出进度（归一化 → 批量请求 → 单条回补 → 集合分组 → 批量落库）。
- Notes 同步：保持在独立 `features/notes` 域，通过类似“外部源 Pull-only + 幂等”策略，未来可在设置页同一 Tab 呈现。
- 更多 Provider：后续可在后端拓展批量解析能力，前端保持 `batchImport` 不变。

---

### 10. 使用示例（最终形态）

```ts
import { literatureEntry } from '@/features/literature/data-access';

async function importFromSelection(identifiers: string[], collectionId?: string) {
  const entries = identifiers.map(id => ({ type: 'identifier', data: id, options: collectionId ? { addToCollection: collectionId } : undefined }));
  const res = await literatureEntry.batchImport(entries);
  return res; // { successful: LibraryItem[], failed: {entry,error}[] }
}
```

Dataset 端到端（示意）：

```ts
import { datasetService } from '@/features/dataset/data-access/dataset-service';

const { nodes } = await datasetService.preview();
const { items } = await datasetService.listPapers({ nodeId: nodes[0].id });

const identifiers = items.map(i => i.doi ? `DOI:${i.doi}` : (i.s2Id ? `S2:${i.s2Id}` : (i.url ? `URL:${i.url}` : i.title)));
await literatureEntry.batchImport(identifiers.map(id => ({ type: 'identifier', data: id, options: { addToCollection } })));

// 可选：同步笔记
await datasetService.importNotesFor(items, { collectionId: addToCollection });
```


