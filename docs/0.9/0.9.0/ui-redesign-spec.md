# Research Navigator v0.9 UI 重设计规范（Draft）

本文档记录 v0.9 的 UI 重设计方案，目标是统一风格、提升可用性并为后续扩展奠定基础。实现时优先复用现有组件，控制改动半径。

## 1. 设计目标
- 去顶栏，保留左侧“悬浮侧边栏”；主页可保留右上角头像，其余页面头像置于左下角。
- 悬浮侧边栏默认收起为窄轨道（Rail），悬停≥1s 自动展开为卡片（Panel）；展开时主内容变暗/轻微虚化；交互延时和动效可配置。
- 侧边栏分区：上常驻（功能菜单，不滚动）/中部（历史对话，独立滚动）/底部常驻（头像、设置、深色模式）。
- 首页（/research 无 sessionId）提供居中“研究输入框”，提交即创建新会话；会话页保留更美观的对话体验。
- 统一视觉：减轻重描边，使用玻璃态、阴影层级与设计令牌；暗色模式对比达标。

## 2. 信息架构
- 全局：`AppShell = FloatingSidebar + Content + OverlayDimmer + (HomeHeader?)`。
- 导航（上常驻）：主页/Home、研究/Search（入口同首页输入）、文献库/Library、图谱数据库/GraphDB。
- 历史（中滚动）：最近、置顶（后续可加搜索/项目分组）。
- 底部常驻：用户头像（悬停展开菜单）、设置、深色模式切换。

## 3. 交互规范（Desktop 优先）
- 收起态（Rail）：宽 64px，圆角 16，弱阴影，靠左吸边；仅显示图标与简短 Tooltip。
- 展开态（Panel）：宽 320–360px（默认 340），圆角 20–24，玻璃态背景（backdrop-blur 4–6px），Elevation 2–3；可通过“图钉”固定。
- 触发：鼠标悬停 ≥1000ms 展开；离开 200ms 后关闭（可配置）；支持键盘 `Alt+/` 打开、`Esc` 关闭；点击遮罩关闭。
- 遮罩与虚化：遮罩 `rgba(0,0,0,0.4)`，主内容附加 `blur(4px)` 与 `opacity 0.6`；固定状态下不遮罩、不虚化。
- 用户菜单：左下角头像，悬停延时与侧栏一致；主页可在右上角额外显示一份（可选）。
- 可达性：焦点圈显著；`nav[aria-label="主导航"]`、`aside[aria-label="历史对话"]`；Tab 限制在面板内部循环；`prefers-reduced-motion` 降级动效。

## 4. 视觉与主题
- 令牌：新增 `--overlay-alpha`、`--blur-radius`、`--glass-surface`、`--elevation-{1,2,3}`；边框色使用 `--color-border-primary` 的低不透明度。
- 边框策略：减少大面积 `border` 分割，优先使用 `divide-*` 与阴影；卡片/弹层圆角统一（16/20/24）。
- 暗色：文本/背景对比 ≥ 7:1，阴影减弱、边框略增强以维持层次。

## 5. 页面细节
### 5.1 首页（/research，无 sessionId）
- 中央英雄区：大输入框（圆角 16，玻璃态），示例 Prompt Chips；回车或“开始研究”创建新 session 并跳转 `/research/[id]`。
- 移除“自动跳转最近会话”默认行为（可保留配置开关）。

### 5.2 会话页（/research/[sessionId]）
- 移除页内“会话列表子侧栏”，历史统一在浮动侧栏中呈现。
- 消息区：分组时间戳、引用/参考文献块标准化；长内容支持折叠/目录。
- 输入区：底部固定浮层，圆角 16、玻璃态；回车发送，Shift+Enter 换行；常用操作按钮更克制。

## 6. 可配置项（集中于 `src/config/ui/navigation.config.ts`）
- `railWidth`：默认 64
- `panelWidth`：默认 340（允许 320–360）
- `hoverOpenDelayMs`：默认 1000（建议范围 600–1200）
- `hoverCloseDelayMs`：默认 200
- `overlayAlpha`：默认 0.4（0.3–0.5）
- `blurRadius`：默认 4–6
- `allowPin`：默认 true（固定后取消遮罩与虚化，布局让出侧宽）
- `mobileBehavior`：v0.9 维持现状；v1.0 切换为底部工具栏 + 上拉抽屉。

## 7. 改动清单（按文件）
1) `src/components/layout/MainLayout.tsx`
   - 关闭默认顶栏（除首页/移动端）；托管侧栏展开状态；在展开时渲染 `OverlayDimmer`。
   - 删除/隐藏页面内“会话列表子侧栏”使用点（统一入口由浮动侧栏提供）。

2) `src/components/ui/sidebar.tsx` + `src/components/layout/AppSidebar.tsx`
   - 新增“浮动卡片”变体（fixed/玻璃态/阴影/圆角），支持 `topSlot` 固定、`middle` 滚动、`bottomSlot` 固定。
   - 加入 hover-intent（打开/关闭延时）、“图钉固定”与本地持久化。

3) `src/components/auth/UserMenu.tsx` / `src/components/ui/expandable-user-menu.tsx`
   - 触发改为“悬停延时”；默认定位至左下角（嵌入 `AppSidebar.bottomSlot`）。
   - 主页可在右上角额外挂载一份。

4) `src/features/session/ui/SessionList.tsx`
   - 复用为侧栏中部滚动区；增加“最近/置顶”分组头（首版静态分组）。

5) `src/app/research/page.tsx`
   - 替换自动跳转逻辑为英雄区输入创建会话；按新风格美化卡片与控件密度。

6) `src/app/research/[sessionId]/page.tsx`
   - 移除本页内部的“会话列表子侧栏”；其它区域保留过渡动画与响应式。

7) 主题与样式
   - `src/app/globals.css`：补充玻璃/阴影/遮罩变量；降低边框视觉重量。
   - 组件层统一圆角/阴影；减少硬边框使用，改为 `divide` 与 `shadow`。

8) 配置
   - 新增 `src/config/ui/navigation.config.ts` 与 `menu.config.ts`（菜单定义、图标、路由）。

## 8. 里程碑与验收
M1 侧栏交互与样式（3–4 天）
- 浮动变体、hover-intent、遮罩/虚化、图钉固定；用户头像迁移至左下角。
验收：侧栏收起/展开/固定稳定；遮罩不遮挡用户菜单；A11y 基本通过。

M2 首页英雄区与路由整理（1–2 天）
- 英雄区输入与会话创建；移除自动跳转；主页可选右上角头像。
验收：新会话创建成功并跳转；移动端不回归错误。

M3 会话页样式统一（2 天）
- 去除页内子侧栏；消息/输入区风格统一；长文档块折叠。
验收：对话流程、Graph/Collection 标签切换正常；视觉一致。

M4 主题与组件统一（1–2 天）
- 令牌、边框/阴影规范落地；常见组件边界减重。
验收：暗/亮模式无明显对比问题；全局无“粗重分割线”。

## 9. 风险与回退
- 交互延时感知：将延时/遮罩强度做成配置并提供快速开关。
- 动画性能：大量虚化在低端设备可能掉帧；`prefers-reduced-motion` 自动降级。
- SessionList 迁移：先保留旧入口隐藏开关，必要时临时回退。

## 10. 后续扩展（非 v0.9 范围）
- 侧栏搜索与项目分组；移动端底部工具栏；拖拽排序跨分组；主题编辑器。

---
Owner: UI/UX
Status: Draft for implementation
Version: 0.9


