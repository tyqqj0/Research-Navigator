## AI Streaming（最小职责版）

本模块“只做一件事”：把上层给定的文本内容以流式的方式持续生成出来，并把增量文本一个个地推给 UI。它：
- 不负责决定“做什么任务/提示词如何编排”；只接受已给定的内容并发送。
- 不暴露 Provider 细节；自动读取全局 AI 设置（模型、baseURL、密钥、代理等）。
- 提供开始、持续增量、结束、错误、打断能力。

### 职责边界
- 负责：建立流式连接、解析增量、节流与聚合、抛出事件、支持取消。
- 不负责：构造 prompt、选择工具/模式、解析 JSON 结构化结果、维护会话/图谱状态。

### 事件模型（仅文本）
```ts
type TextStreamEvent =
  | { type: 'start' }
  | { type: 'delta'; text: string }      // 新到的一段增量文本
  | { type: 'done' }                      // 完整流结束
  | { type: 'aborted'; reason?: string }
  | { type: 'error'; message: string; retryable?: boolean };
```

### API 设计（最小参数）
```ts
// 上层不强约束消息结构；可传入已拼好的整段字符串
// messages 也仅接受字符串数组，由上层决定“谁说的/如何拼接”
type MessageInput = string;

interface TextStream extends AsyncIterable<TextStreamEvent> {
  abort(reason?: string): void;
}

function startTextStream(
  args:
    | { prompt: string; messages?: never }
    | { prompt?: never; messages: MessageInput[] },
  options?: {
    temperature?: number;
    maxTokens?: number;
    modelOverride?: string;          // 可选临时覆盖全局模型
    batchingIntervalMs?: number;     // 增量聚合与 UI 刷新节流
    signal?: AbortSignal;            // 可选 AbortSignal
  }
): TextStream;
```

默认从全局设置中解析：`provider/baseURL/apiKey/model/headers`。若提供 `modelOverride` 则以之为准。

### 生成与更新流程（如何“蹦字”）
1) 调用方 `startTextStream(...)`。
2) 模块读取全局 AI 设置，拼装 Provider 请求（开启 streaming/SSE）。
3) 发起请求后：
   - 收到网络分片（chunk/SSE event）→ 解码出文本增量。
   - 立即推送 `delta{text}` 事件，同时把文本累加到内部缓冲。
   - 若设置了 `batchingIntervalMs`，则以该间隔聚合多个增量再推给 UI，减少重渲染。
4) 服务器发送完成标记或连接关闭 → 推送 `done` 事件，流结束。
5) 发生错误 → 推送 `error{message}` 并结束。
6) `abort()` 或外部 `signal.abort()` → 关闭连接，推送 `aborted` 事件。

UI 侧只需把所有 `delta.text` 依次拼接显示，即可获得“逐字输出”的体验；无需理解 Provider 协议。

### UI 集成示例（伪代码）
```ts
const stream = startTextStream({ messages }, { batchingIntervalMs: 32 });
let text = '';
for await (const ev of stream) {
  if (ev.type === 'delta') text += ev.text;   // 状态驱动渲染
  if (ev.type === 'done') break;
}
```

### 文件放置与 Provider 映射
- 前端：
  - `src/lib/ai/streaming/index.ts`：导出 `startTextStream`、事件类型
  - `src/lib/ai/streaming/providers/index.ts`：Provider 映射注册表
  - `src/lib/ai/streaming/providers/openai.ts`
  - `src/lib/ai/streaming/providers/anthropic.ts`
  - `src/lib/ai/streaming/providers/google.ts`
  - `src/lib/ai/streaming/providers/openrouter.ts`
  - `src/lib/ai/streaming/providers/azure.ts`
  - `src/lib/ai/streaming/providers/mistral.ts`
  - `src/lib/ai/streaming/providers/deepseek.ts`
  - `src/lib/ai/streaming/providers/xai.ts`
  - `src/lib/ai/streaming/providers/ollama.ts`
  - `src/lib/ai/streaming/providers/openai-compatible.ts`
  - `src/lib/settings/ai.ts`：读取全局 AI 设置（复用现有 `src/features/user/settings` 的 store）

- 可选后端代理与自定义后端占位：
  - `src/server/ai/proxy.ts`：统一转发至上游 Provider（隐藏密钥）
  - `src/server/ai/custom/index.ts`：自定义后端“会话/对话”占位，暴露 SSE/stream 接口，供前端直连

### Provider 映射（示意）
```ts
// src/lib/ai/streaming/providers/index.ts
export type ProviderName =
  | 'google' | 'openai' | 'anthropic' | 'deepseek' | 'openrouter'
  | 'mistral' | 'xai' | 'azure' | 'ollama' | 'openAICompatible';

export interface ProviderAdapter {
  start(
    input: { prompt?: string; messages?: string[] },
    options: { model: string; apiKey?: string; baseURL?: string; headers?: Record<string,string>;
      temperature?: number; maxTokens?: number; signal?: AbortSignal }
  ): TextStream;
}

export const providerRegistry: Record<ProviderName, ProviderAdapter> = {
  google: googleAdapter,
  openai: openaiAdapter,
  anthropic: anthropicAdapter,
  deepseek: deepseekAdapter,
  openrouter: openrouterAdapter,
  mistral: mistralAdapter,
  xai: xaiAdapter,
  azure: azureAdapter,
  ollama: ollamaAdapter,
  openAICompatible: openAICompatibleAdapter,
};
```

`startTextStream` 读取现有 `src/features/user/settings` 的 AI 设置（`useSettingsStore().ai`），解析 provider、model、apiKey、apiProxy（作为 baseURL）。若用户选择“自定义后端”，则将请求指向 `src/server/ai/custom`。

### 默认值与连接保护
- 若未传 `temperature/maxTokens`，使用全局设置里的默认值。
- 超时与重试在本模块内部做最小保护，错误统一以 `error{message}` 事件抛出。

### 非职责再强调
- 不做 JSON 模式/工具调用/思维链分流。
- 不读写 `session/graph`，也不决定“下一步做什么”。

