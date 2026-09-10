# 岗位闯关式实训平台 · 学生端

面向高职院校实训教学的学生端前端。以「岗位」为导向，把课程实训与技能成长串成一条线：

> 选岗位 → 看技能树 → 逐关闯关 → 提交作答 → AI 判分 → 申请教师复评 → 认证

当前版本的数据全部来自本地 Mock，接口层已按真实后端的调用方式设计，接入后端时只需替换 `src/api` 的内部实现，页面不用改。

## 技术栈

| 分类 | 选型 |
| --- | --- |
| 框架 | Vue 3.5（Composition API + `<script setup>`） |
| 构建 | Vite 8 |
| 语言 | TypeScript 6 |
| 路由 | Vue Router 5（history 模式，页面组件全部懒加载） |
| 状态 | Pinia 4 |
| UI | Element Plus 2.14 + @element-plus/icons-vue |

## 环境要求

- Node.js `^22.18.0 || >=24.12.0`
- npm（仓库内含 `package-lock.json`）

## 快速开始

```bash
npm install         # 安装依赖
npm run dev         # 启动开发服务器，默认 http://localhost:5173
npm run type-check  # 只做类型检查（vue-tsc）
npm run build       # 类型检查 + 生产构建，产物输出到 dist/
npm run preview     # 本地预览 dist/ 的构建结果
```

> 小提示：启动 dev server 时不要用 `> xxx.log` 重定向输出，否则仓库根目录会多出一个日志文件。Vite 自身不会写日志文件。

## 目录结构

```text
Student/
├─ public/                       # 静态资源，构建时原样拷贝到产物根目录
│  ├─ favicon.png                # 站点图标（由校徽裁切而成）
│  └─ favicon.ico                # Vite 默认图标，已不再引用，保留备用
│
├─ src/
│  ├─ main.ts                    # 应用入口：注册 Pinia、路由、Element Plus（中文语言包）
│  ├─ App.vue                    # 根组件，只承载 <router-view>
│  │
│  ├─ api/                       # 接口层：页面只通过这里取数据，不直接碰 Mock
│  │  ├─ auth.ts                 # 登录、SSO 回调、获取学生信息
│  │  ├─ position.ts             # 岗位列表、岗位切换、岗位关联技能
│  │  ├─ skill.ts                # 技能树查询、统计口径、按项目筛选节点
│  │  ├─ project.ts              # 实训项目、关卡提交、AI 判分与复评流转
│  │  ├─ certification.ts        # 认证条件与证书列表
│  │  └─ chat.ts                 # AI 助教问答（返回带知识库来源的回复）
│  │
│  ├─ assets/
│  │  ├─ images/
│  │  │  ├─ gate.jpg             # 登录页背景（校园正门）
│  │  │  └─ logo.png             # 校徽 + 校名字标（透明底，适配深色/蓝色背景）
│  │  └─ styles/
│  │     ├─ tokens.css           # 设计令牌：主色、状态色、圆角、阴影、字体，并接管 Element Plus 主题变量
│  │     └─ base.css             # 全局重置、排版工具类、卡片/药丸/骨架屏等通用样式
│  │
│  ├─ components/                # 可复用组件
│  │  ├─ AppHeader.vue           # 顶栏：校徽、学生信息与称号、三项指标、消息/待办/收藏、退出登录
│  │  ├─ AppNav.vue              # 左侧主导航：分组标题、线性图标、选中态；配色集中在顶部变量里
│  │  ├─ PageTitle.vue           # 页面标题 + 右侧插槽（放图例、统计等）
│  │  ├─ PositionCard.vue        # 岗位卡片：compact（列表）/ select（选择页）两种形态
│  │  ├─ SkillNode.vue           # 技能节点：未解锁 / 已激活 / 已精通 / 点亮进度角标
│  │  ├─ ProjectCard.vue         # 关卡卡片：可挑战 / 进行中 / 已完成 / 未解锁 四态 + 进度条
│  │  ├─ LevelStepper.vue        # 关卡步骤条：已完成可回看，未解锁禁用
│  │  ├─ AiReviewPanel.vue       # AI 判分结果：总分环、各维度理由、提升建议、复评入口
│  │  ├─ AiAssistantDock.vue     # AI 助教对话浮窗（右下角悬浮球展开）
│  │  └─ EmptyState.vue          # 空态 / 未解锁引导
│  │
│  ├─ config/
│  │  └─ nav.ts                  # 主导航配置、平台信息（校名、学院、版本、开关）
│  │
│  ├─ layouts/
│  │  └─ DefaultLayout.vue       # 登录后外壳：顶栏 + 左侧导航 + 内容区 + 悬浮 AI 助教
│  │
│  ├─ mock/
│  │  └─ data.ts                 # Mock 数据（固定 seed，不随机）：学生、6 个岗位、4 大技能体系、9 个实训项目、认证、问答
│  │
│  ├─ router/
│  │  └─ index.ts                # 路由表、登录守卫、meta.nav（导航高亮）
│  │
│  ├─ stores/                    # Pinia 状态
│  │  ├─ user.ts                 # 登录态、学生信息、退出登录
│  │  ├─ position.ts             # 岗位列表、当前岗位、按匹配度排序
│  │  ├─ skill.ts                # 技能体系、统计、按项目查节点
│  │  ├─ project.ts              # 项目与关卡状态、草稿、提交记录、复评流转
│  │  └─ chat.ts                 # AI 对话、每日配额、上下文裁剪、失败重试
│  │
│  ├─ types/
│  │  └─ index.ts                # 全局类型定义（数据契约）
│  │
│  ├─ utils/
│  │  ├─ request.ts              # 请求层：Mock 延迟、Authorization 注入、401 兜底、失败重试、Token 刷新占位
│  │  ├─ storage.ts              # localStorage 封装：Token、学生信息、关卡草稿、对话缓存
│  │  └─ format.ts               # 格式化与展示映射：数字、日期、文件体积、状态文案与配色
│  │
│  └─ views/                     # 页面（全部按路由懒加载）
│     ├─ LoginView.vue           # 身份入口页（学生端 / 教师端）
│     ├─ GrowthCenterView.vue    # 成长中心：我的岗位、实训进度概览
│     ├─ SkillTreeView.vue       # 技能树：四大体系分列 + 节点详情
│     ├─ LevelMapView.vue        # 关卡地图：岗位筛选 + 三层级分组
│     ├─ ProjectLevelView.vue    # 关卡详情：步骤条、作答、附件上传、提交、AI 判分
│     ├─ PositionSelectView.vue  # 岗位选择：筛选、匹配度排序、确认切换
│     ├─ CertificationView.vue   # 认证中心：认证条件、证书列表、鉴定书预览
│     └─ NotFoundView.vue        # 404 兜底
│
├─ index.html                    # HTML 模板（页面标题、站点图标、主题色）
├─ vite.config.ts                # Vite 配置（`@` 别名指向 src，Vue DevTools 插件）
├─ tsconfig.json                 # TypeScript 工程引用入口
├─ tsconfig.app.json             # 应用侧 TS 配置（含 `@/*` 路径映射）
├─ tsconfig.node.json            # Node 侧 TS 配置（用于 vite.config.ts）
├─ package.json                  # 依赖与脚本
├─ .gitignore                    # Git 忽略规则
├─ README.md                     # 本文件
└─ PRD.md                        # 需求文档（产品侧材料，是否随仓库发布自行决定）
```

## 路由与页面

| 路由 | 页面 | 说明 |
| --- | --- | --- |
| `/login` | 身份入口 | 学生端 / 教师端两条入口，也支持带 `?key=xxx` 的 SSO 回调 |
| `/growth` | 成长中心 | 默认首页，`/` 会重定向到这里 |
| `/skill-tree` | 技能树 | 四大体系分列展示，节点可点开详情 |
| `/map` | 关卡地图 | 按岗位筛选、按层级分组，支持从其它页面带筛选参数进入 |
| `/map/project/:projectId` | 关卡详情 | 主导航高亮仍停留在「关卡地图」 |
| `/positions` | 岗位选择 | 达标后可切换目标岗位 |
| `/certification` | 认证中心 | 认证条件、证书状态、鉴定书预览 |
| `/:pathMatch(.*)*` | 404 | 兜底页 |

除 `/login` 与 404 外，其余路由都需要登录态，未登录会自动跳转到身份入口页。

## 数据流

```text
View（views/*.vue）
   ↓ 读取/触发
Store（stores/*.ts）      ← 页面状态、跨页共享数据
   ↓ 调用
API（api/*.ts）           ← 接口签名层，未来接后端只改这里
   ↓ 当前指向
Mock（mock/data.ts）      ← 固定 seed 的假数据
```

同时：

- 类型统一放在 `src/types/index.ts`，页面与接口层共用；
- 需要跨页面保留的内容（登录态、关卡草稿、AI 对话）通过 `utils/storage.ts` 落到 `localStorage`；
- 请求的延迟模拟、401 兜底、失败重试集中在 `utils/request.ts`。

## 常见改动指引

| 想做什么 | 改哪里 |
| --- | --- |
| 新增 / 调整左侧导航入口 | `config/nav.ts` 加一项（含 `group` 分组），`router/index.ts` 加路由，`views/` 加页面 |
| 改全局配色、圆角、字体 | `assets/styles/tokens.css` |
| 改左侧栏配色（含深色版） | `components/AppNav.vue` 顶部的 `--side-*` 变量组 |
| 增删 Mock 数据 | `mock/data.ts` |
| 调整关卡步骤 | `mock/data.ts` 里的关卡模板数组（页面按 `modules` 渲染，没有写死步骤数量） |
| 接入真实后端 | 替换 `utils/request.ts` 的请求实现与 `api/*` 内部逻辑，`types/` 与页面保持不变 |
| 改登录/鉴权规则 | `router/index.ts` 的守卫 + `stores/user.ts` |

## 设计约定

- 主色 `#1E7BE8 → #1677FF`，页面底色 `#F0F6FF`，卡片白底 + 12px 圆角；
- 状态色统一：已完成 `#52C41A`、进行中 `#FA8C16`、可挑战 `#1677FF`、未解锁 `#BFBFBF`；
- 数字（积分、完成率、分数、进度）统一使用等宽数字字体，避免刷新时跳动；
- 图标分两类：界面按钮用 Element Plus 线性图标，岗位/项目用 emoji；
- 加载态用骨架屏，不用整页遮罩；动效遵守 `prefers-reduced-motion`。

## 当前范围说明

- 只实现学生端。教师端未开放，入口页点击后会给出提示。
- AI 判分与 AI 助教回复均为本地模拟：判分依据作答长度与附件数量推导，问答按关键词命中知识库片段。
- 技能鉴定书为静态预览样式，暂不支持生成与下载。
