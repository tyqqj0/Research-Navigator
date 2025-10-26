本文面向前端应用，介绍如何集成 @autolabz/oauth-sdk、@autolabz/data-sdk、@autolabz/points-sdk 与 @autolabz/llmapi-sdk。示例参考仓库中的 oauth-example-app。
oauth-example-app:http://114.132.91.247/oauth-app/
（由于暂时没有https证书[需要域名]，http访问时需浏览器设置--unsafely-treat-insecure-origin-as-secure=http://114.132.91.247）
sdk包:https://www.npmjs.com/settings/autolabz/packages
选择建议
- 推荐使用 @autolabz/oauth-sdk：标准 OAuth 2.0 授权码（含 PKCE）登录，适合对外或跨域/第三方生态接入（独立登录状态，需 HTTPS）。
- 业务数据与 LLM/计费能力通过 data-sdk、llmapi-sdk、points-sdk 接入，并使用 oauth-sdk 的桥接能力自动注入鉴权。
ClientId 获取与固定配置
联系@毛智辉 
- ClientId 由 AutoLab 组织统一分配，应用需向组织申请后获得固定的 clientId。
- ClientId 是专属于应用的，作为固定参数提供给给SDK；一般仅需在 Provider 的 clientId 属性传入。
- 可用方式
  - 前端：在 Provider 的 clientId 属性传入；值可来自构建时环境变量、运行时配置、编译期常量或 Secrets 管理；
  - Node/后端：从环境变量、配置文件或配置中心/Secrets 管理读取；
- URL 查询、sessionStorage 的自动解析仅用于开发联调兜底，生产不建议依赖。

---

环境变量与固定地址约定

- VITE_AUTH_API_BASE_URL：例如 http://114.132.91.247/api
- VITE_DATA_BASE_URL：例如 http://114.132.91.247/data
- VITE_POINTS_BASE_URL：例如 http://114.132.91.247/points
- VITE_LLMAPI_BASE_URL：例如 http://114.132.91.247/llmapi
- VITE_OAUTH_REDIRECT_URI：例如 http://114.132.91.247/oauth-app/callback
- VITE_OAUTH_PROFILE_URL：例如 http://114.132.91.247/auth/profile

---

1) @autolabz/oauth-sdk（OAuth 授权码 + PKCE）

安装

npm install @autolabz/oauth-sdk

（可选样式）

import '@autolabz/oauth-sdk/dist/style.css';
特性

- 标准 OAuth 2.0 授权码 + PKCE 流程封装（构造授权 URL、回调处理、换取 Token）
- 本地会话管理：持久化访问令牌与用户信息，提供 refreshAccessToken
- React 友好：OAuthProvider / useOAuth / AuthAvatar 组件与样式
- Bridge 能力：createAuthBridgeFromContext 供 data-sdk / points-sdk / llmapi-sdk 复用鉴权
- 可配置 scope、额外参数与回调地址，支持跨域与 HTTPS 部署
快速开始（React）

1. 根组件挂载 Provider：
import { OAuthProvider } from '@autolabz/oauth-sdk';
const AUTOLAB_CLIENT_ID = import.meta.env.VITE_AUTOLAB_CLIENT_ID; // 固定 clientId

function App() {
  const authServiceUrl = import.meta.env.VITE_AUTH_API_BASE_URL; // 固定地址
  return (
    <OAuthProvider authServiceUrl={authServiceUrl} clientId={AUTOLAB_CLIENT_ID}>
      <YourApp />
    </OAuthProvider>
  );
}
2. 发起登录（授权码 + PKCE）：


```tsx
import { useOAuth } from '@autolabz/oauth-sdk';

function LoginButton() {
  const { startLogin } = useOAuth();
  const handleLogin = async () => {
    await startLogin({
      redirectUri: import.meta.env.VITE_OAUTH_REDIRECT_URI,
      scope: 'openid profile email',
      usePkce: true,
      additionalParams: { prompt: 'consent' },
    });
  };
    return <button onClick={handleLogin}>登录</button>;
}
3. 回调页处理并建立会话：

```tsx
import { useEffect } from 'react';
import { useOAuth } from '@autolabz/oauth-sdk';

function CallbackPage() {
  const { handleRedirect, isAuthenticated, user } = useOAuth();
  useEffect(() => {
    handleRedirect({ fetchUserinfo: true, redirectUri: import.meta.env.VITE_OAUTH_REDIRECT_URI }).catch((e) => console.error('OAuth 回调失败:', e));
  }, [handleRedirect]);
  if (!isAuthenticated) return <div>正在登录...</div>;
  return <div>欢迎回来，{user?.nickname || user?.email}</div>;
}

与 data-sdk 桥接

oauth-sdk 同样提供桥接方法用于 data-sdk：

import { useOAuth, createAuthBridgeFromContext } from '@autolabz/oauth-sdk';
import { createDataClient } from '@autolabz/data-sdk';

const auth = useOAuth();
const data = createDataClient({ baseURL: '/data', auth: createAuthBridgeFromContext(auth) });

await data.put('/v1/data/user.theme', { value: 'dark' });

低层 API（可选）：startAuthorization / getAuthorizeUrl / handleRedirectCallback / buildAuthorizeUrl，用于自定义跳转或仅构造授权 URL。


---

2) @autolabz/data-sdk（数据访问客户端）

安装

npm install @autolabz/data-sdk @autolabz/oauth-sdk axios

特性

- required_scope: "data"
- 自动注入 Authorization: Bearer <token> 与 X-Client-Id
- 401 自动刷新（依赖桥接的刷新逻辑）
- 429/503/504 指数退避 + 抖动重试
- 每个请求自动附加 x-request-id
API 概览

import { createDataClient, DataAPIClient } from '@autolabz/data-sdk';

const data = createDataClient({
  baseURL: '/data', // 或服务地址
  auth: /* 来自 oauth-sdk 的 bridge */
});

// 提供的方法
await data.health();
await data.get('/v1/users/me');
await data.post('/v1/data/key', { value: '...' });
await data.put('/v1/data/key', { value: '...' });
await data.patch('/v1/data/key', { value: '...' });
await data.delete('/v1/data/key');
快速开始（React + oauth-sdk 桥接）
```tsx
import { useOAuth, createAuthBridgeFromContext } from '@autolabz/oauth-sdk';
import { createDataClient } from '@autolabz/data-sdk';

const auth = useOAuth();
const data = createDataClient({ baseURL: '/data', auth: createAuthBridgeFromContext(auth) });

const kv = await data.get(`/v1/data/${encodeURIComponent('demo-key')}`);


---

3) @autolabz/points-sdk（积分/用量客户端）

安装

npm install @autolabz/points-sdk @autolabz/oauth-sdk axios
特性

- required_scope: "points"
- 提供积分能力：查询余额、扣费、消费记录列表
- 自动注入 Authorization 与 X-Client-Id，401 自动刷新并重试
- 指数退避 + 抖动重试（429/503/504），每个请求附带 x-request-id
- 支持通过 requestId 建议实现扣费幂等
- LLM应用如果没有额外消费内容，无需手动引入points-sdk，llmapi-sdk会自动结算积分
快速开始（React + oauth-sdk 桥接）

import { useOAuth, createAuthBridgeFromContext } from '@autolabz/oauth-sdk';
import { createPointsClient } from '@autolabz/points-sdk';

const auth = useOAuth();
const points = createPointsClient({ baseURL: '/points', auth: createAuthBridgeFromContext(auth) });
// 查询余额（首次自动初始化）
const bal = await points.getMyBalance();

// 扣费（保证 requestId 幂等）
const res = await points.consume({ amount: 50, reason: 'chat:gpt-4o', requestId: crypto.randomUUID() });
4) @autolabz/llmapi-sdk（OpenAI 兼容 Chat Completions）
安装
```bash
npm install @autolabz/llmapi-sdk @autolabz/oauth-sdk
特性

- required_scope: "points,llmapi"
- OpenAI 兼容的 Chat Completions API 封装
- 支持非流式与 SSE 流式输出，事件回调简单易用
- 自动注入 Authorization 与 X-Client-Id，401 自动刷新与重试
- 指数退避 + 抖动重试（429/503/504），请求自动附带 x-request-id
- 自动使用 points-sdk ，用于按量计费的前置余额校验与扣费
快速开始（React + oauth-sdk 桥接）

import { useOAuth, createAuthBridgeFromContext } from '@autolabz/oauth-sdk';
import { createLLMClient } from '@autolabz/llmapi-sdk';

const auth = useOAuth();
const llm = createLLMClient({ baseURL: '/llmapi', auth: createAuthBridgeFromContext(auth) });
// 非流式
const resp = await llm.chat({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Say hello' },
  ],
});

// 流式（SSE）
await llm.chatStream({ model: 'gpt-4o-mini', messages: [], stream: true }, {
  onMessage: (data) => {
    // 处理 OpenAI 风格增量
  },
  onDone: () => {
    // 结束
  },
});
常见问题（FAQ）
- ClientId 从哪里来？
  - 由 AutoLab 组织分配并下发，应用侧将其作为固定配置使用；

- 如何加载该固定配置由应用自行决定；常见做法包括：前端通过 Provider 的 `clientId` 属性（值来自环境变量/运行时配置/常量），Node/脚本从环境变量/配置文件/配置中心读取；
  - URL 查询、sessionStorage 的解析仅用于开发联调兜底，生产不建议依赖。

- Token 存储在哪里？
  - SDK 会在本地存储（localStorage/sessionStorage）维护必要状态；自动刷新失败会清理并回到未登录态。

- 与现有 axios 实例共存？
  - 建议使用 `data-sdk`/`points-sdk`/`llmapi-sdk` 客户端，以获得统一的注入/刷新/重试能力；如需自定义，请确保在 401 时正确触发刷新或降级登出。
