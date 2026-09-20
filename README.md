# 岗位闯关式实训平台 · 学生端

面向高职院校实训教学的学生端前端。以「岗位」为导向，把课程实训与技能成长串成一条线：

> 看技能树（技能体系 / 岗位体系）→ 挑项目加入关卡地图 → 逐关闯关 → 提交作答 → AI 评审 → 申请教师复核 → 认证

数据来自同仓库的后端 `training_platform`（FastAPI），前端不再依赖本地假数据：
岗位推荐、技能树进度、实训项目、闯关作答、AI 评审、AI 问答与历史记录都走真实接口；
只有**认证中心**（后端暂无证书接口）和 AI 助教的**快捷提问文案**仍是本地 mock。

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
- **后端要在跑**：`../training_platform`，默认 `http://127.0.0.1:8000`（见「对接后端」）

## 快速开始

```bash
# 1) 先起后端（另开一个终端）
cd ../training_platform
uv sync                                # 首次
uv run python -m app.db.init_db        # 建库 + 种子数据
uv run uvicorn app.main:app --reload   # http://127.0.0.1:8000
# 想「删库重建 + 连演示数据（教师/班级/学生/项目/闯关记录）一起灌」时用：
# uv run python -m app.db.build_db

# 2) 再起前端
cd ../Student
npm install         # 安装依赖
npm run dev         # 开发服务器，默认 http://localhost:5173（/api 自动代理到 8000）
npm run type-check  # 只做类型检查（vue-tsc）
npm run build       # 类型检查 + 生产构建，产物输出到 dist/
npm run preview     # 本地预览 dist/ 的构建结果
```

> 小提示：启动 dev server 时不要用 `> xxx.log` 重定向输出，否则仓库根目录会多出一个日志文件。Vite 自身不会写日志文件。

## 对接后端

### 地址与配置

| 项 | 位置 | 说明 |
| --- | --- | --- |
| API 前缀 | `src/config/env.ts` 的 `API_BASE_URL` | 默认 `/api`；开发时由 `vite.config.ts` 的代理转发到 `http://127.0.0.1:8000`，部署时同源反向代理即可，不用改代码 |
| 覆盖地址 | 环境变量 `VITE_API_BASE_URL` | 需要直连后端时用，例如 `VITE_API_BASE_URL=http://127.0.0.1:8000/api` |
| 演示学号 | 环境变量 `VITE_DEMO_STUDENT_NO` | 默认 `2024010101`（王浩然）。后端暂无登录/SSO 接口，学生端按学号取真实档案打通链路 |
| 切换演示学生 | 地址栏 | `/login?key=2024010105` —— 后端 SSO 未就绪前，`key` 直接当学号用（`teacher*` 开头视为教师身份） |

### 响应体约定

后端所有接口返回 `{code, data, msg}`：成功 `code=200`、`data` 是业务数据；
业务失败是 **HTTP 200 + `code=422`**，提示在 `msg`；分页是 `{items, total, page, page_size, pages}`。
这些统一在 `src/api/http.ts` 里处理（拆壳、抛 `ApiError`、Decimal 字符串转数字），页面只拿业务数据。

### 学生端用到的接口

| 功能 | 接口 |
| --- | --- |
| 登录（按学号取档案） | `GET /users`、`GET /classes`、`GET /classes/{id}/students` |
| 岗位推荐（成长中心的岗位卡片） | `GET /students/{id}/job-recommendations`、`GET /students/{id}/jobs` |
| 我的实训（自己挑的 ∪ 老师点名必修） | `GET/POST /students/{id}/my-projects`（批量、幂等）、`DELETE /students/{id}/my-projects/{project_id}` |
| 技能树进度 | `GET /students/{id}/skill-tree-progress` |
| 项目列表 | `GET /students/{id}/training-projects` |
| 项目详情（关卡/作答/提交/评语，一次拿全） | `GET /students/{id}/projects/{project_id}` |
| 项目全量（关卡组成 + 项目资料） | `GET /projects/{id}`、`GET /projects/{id}/skills`、`GET /stage-templates` |
| 开始 / 重新挑战 | `POST /students/{id}/projects/{project_id}/start` |
| 保存作答（批量草稿） | `PUT /attempts/{id}/answers` |
| 整单提交 / 撤回 / 异议 | `POST /attempts/{id}/submit`、`POST /submissions/{id}/withdraw`、`POST /submissions/{id}/objection` |
| AI 评审（提交后自动触发） | `POST /submissions/{id}/ai-review` |
| 历史记录：提交记录 / 评审明细 | `GET /submissions?student_id=`（分页 + 项目筛选）、`GET /submissions/{id}/reviews` |
| 评审人姓名（评审明细里显示教师） | `GET /users/{id}` |
| 关卡附件 | `POST /file-assets/upload`、`GET/POST/DELETE /attempts/{aid}/stages/{sid}/files[/{asset_id}]` |
| 文件下载 | `GET /file-assets/{id}/download`（文件流，不包统一响应体） |
| 实训项目进度（三档，`scope` 切分母：全部 / 我自主选择的 / 老师下发的） | `GET /students/{id}/project-progress` |
| AI 助教（会话 + SSE 流式提问 + 用量） | `GET/POST /qa/sessions`、`GET /qa/sessions/{id}`、`POST /qa/sessions/{id}/ask`、`GET /qa/usage` |
| 枚举字典（状态 code → 中文文案） | `GET /enums` |

### 后端前置依赖（AI 相关）

| 能力 | 需要 |
| --- | --- |
| AI 问答 | `system_config` 里 `ai.llm.api_key` 已配 + 后端装了 `llm` 依赖组（`uv sync --extra llm`） |
| AI 评审 | 同上，并且**项目里要上传评分标准**（附件用途 `SCORING_CRITERIA`）。评分标准 ≤ 6 万字时整份喂模型，不需要向量库 |
| 知识库检索 / 带引用问答 | 额外需要 Milvus + `uv sync --extra rag`（FlagEmbedding + torch）+ BGE-M3 权重 |

### 还没接的（后端暂无接口）

- **认证中心**：`student_certificate` 表是空的，也没有证书路由 → 页面仍用本地 mock 数据
- **顶栏「消息 / 待办」角标**：`notification` 表空且无接口 → 角标是写死的

### 数据口径（前端不要自己另算一套）

页面上所有进度类数字都来自后端，前端只做展示与四舍五入；这几条是最容易踩坑的口径：

| 指标 | 口径 | 来源 |
| --- | --- | --- |
| 技能点进度 | 该技能点关联的**已发布项目**完成度均值（0~100） | `GET /students/{id}/skill-tree-progress` 的 `progress` |
| 体系进度 / 整体进度 | 该体系（或全部）技能点进度的**均值** | 同上：`trees[].percent`、`overall_percent` |
| 岗位匹配度 | 该岗位关联技能点进度的**均值**，后端已排序 | `GET /students/{id}/job-recommendations` 的 `match_score` |
| 关卡进度 | 项目已启用关卡数 vs 最新一轮闯关已填写的关卡数（重新挑战从 0 重新计，最高分保留） | 项目列表的 `level_total` / `level_done` |
| 项目「已完成」 | `student_project.completed_at` 有值（AI 或教师评审通过后写入） | 项目列表的 `status=COMPLETED` |
| 关卡地图 = 「我的实训」 | 学生自己挑的 ∪ 老师发任务点名必修的，都只算已发布项目 | `GET /students/{id}/my-projects`（带 `picked` / `is_required` / `sources`） |
| 实训进度概览的三档 | 分母由 `scope` 决定：`ALL` 全部已发布 / `SELF` 我自主选择的 / `TEACHER` 老师下发的 | `GET /students/{id}/project-progress?scope=` |

两个由此推出的产品行为：**加入 / 移出「我的实训」不改进度**（进度记在学生 × 项目上，清单只是清单，
记录与最高分都保留）；**必修项目移出后仍在列表与地图上**（必修是任务实时算的，撤回任务才消失）。

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
│  ├─ api/                       # 接口层：页面只通过这里取数据
│  │  ├─ http.ts                 # 真实请求层：统一响应体拆壳、分页、错误、上传/下载辅助
│  │  ├─ session.ts              # 当前登录学生 ID（拼 /students/{id}/... 路径用）
│  │  ├─ enums.ts                # 枚举字典（/api/enums）：状态 code → 中文文案
│  │  ├─ auth.ts                 # 登录（按学号取真实档案）、SSO 回调、学生档案
│  │  ├─ position.ts             # 岗位推荐、选岗、岗位项目进度
│  │  ├─ skill.ts                # 技能树与技能点进度
│  │  ├─ project.ts              # 项目与关卡、作答保存、整单提交、AI 评审、附件
│  │  ├─ history.ts              # 历史记录：跨项目提交记录与每次提交的评审明细
│  │  ├─ file.ts                 # 文件上传（带进度）、下载地址、关卡附件挂/摘
│  │  ├─ qa.ts                   # AI 助教：会话、SSE 流式提问、用量统计
│  │  ├─ certification.ts        # 认证中心（后端暂无接口，走本地 mock）
│  │  └─ chat.ts                 # 旧版 AI 助教 mock（已停用，保留作参考）
│  │
│  ├─ assets/
│  │  ├─ images/
│  │  │  ├─ gate.jpg             # 登录页背景（校园正门）
│  │  │  └─ logo.png             # 校徽 + 校名字标（透明底，适配深色/蓝色背景）
│  │  └─ styles/
│  │     ├─ tokens.css           # 设计令牌：主色、状态色、圆角、阴影、字体，并接管 Element Plus 主题变量
│  │     └─ base.css             # 全局重置、排版工具类、卡片/药丸/骨架屏、.page-toolbar 等通用样式
│  │
│  ├─ components/                # 可复用组件
│  │  ├─ AppHeader.vue           # 顶栏：校徽、学生信息与称号、三项指标、消息/待办/收藏、退出登录
│  │  ├─ AppNav.vue              # 左侧主导航：一层平铺列表（无分组标题）、线性图标、选中态、页脚信息与收起按钮
│  │  ├─ PositionCard.vue        # 岗位卡片：compact（列表）/ select（选择页）两种形态
│  │  ├─ ProjectCard.vue         # 项目卡片：状态文案取 /enums 字典，关联技能点标签
│  │  ├─ ProjectPickRow.vue      # 「项目 + 加入关卡地图」一行（技能体系与岗位体系共用）
│  │  ├─ LevelStepper.vue        # 关卡步骤条：已完成可回看，未解锁禁用
│  │  ├─ AiReviewPanel.vue       # 评审结果：总分环、各维度理由、教师评语、撤回/提异议入口
│  │  ├─ AiAssistantDock.vue     # AI 助教浮窗：会话历史、模型选择、SSE 流式问答
│  │  ├─ EmptyState.vue          # 空态 / 未解锁引导
│  │  └─ PageTitle.vue           # 旧的页面标题组件（页面标题已移除，当前无引用）
│  │
│  ├─ config/
│  │  ├─ env.ts                  # 运行时配置：API 前缀、演示学号
│  │  ├─ nav.ts                  # 主导航配置（含分组）、平台信息（校名、学院、版本、开关）
│  │  └─ models.ts               # AI 助教可选模型清单（id 与后端 ai.llm.models 的键一一对应）
│  │
│  ├─ layouts/
│  │  └─ DefaultLayout.vue       # 登录后外壳：顶栏 + 可收起的左侧导航 + 内容区 + 悬浮 AI 助教
│  │
│  ├─ mock/
│  │  └─ data.ts                 # 还在被引用的只有三处：认证中心证书（api/certification.ts）、
│  │                             # AI 助教的快捷提问 / 旧版回复模板（components/AiAssistantDock.vue、api/chat.ts）；
│  │                             # 文件里的岗位 / 技能树 / 项目示例数据已无人引用，保留作参考
│  │
│  ├─ router/
│  │  └─ index.ts                # 路由表、登录守卫、meta.nav（导航高亮）、路由预取
│  │
│  ├─ stores/                    # Pinia 状态
│  │  ├─ user.ts                 # 登录态、学生档案、退出登录
│  │  ├─ enums.ts                # 枚举字典缓存（全站拉一次，取不到用本地兜底文案）
│  │  ├─ position.ts             # 岗位列表、当前岗位、匹配度排序
│  │  ├─ skill.ts                # 技能体系、技能点进度、按项目查节点
│  │  ├─ project.ts              # 项目与关卡状态、草稿、作答保存、提交、附件
│  │  └─ chat.ts                 # AI 对话会话、SSE 流式回答、失败重试
│  │
│  ├─ types/
│  │  └─ index.ts                # 全局类型定义（数据契约）
│  │
│  ├─ utils/
│  │  ├─ request.ts              # 旧版 Mock 请求层（仅认证中心还在用 mockRequest）
│  │  ├─ storage.ts              # localStorage 封装：Token、学生档案、关卡草稿、UI 偏好
│  │  ├─ answer.ts               # 关卡多题作答的拼装与还原（后端只有一个 answer_text 字段）
│  │  └─ format.ts               # 格式化与展示映射：数字、日期、文件体积、状态文案与配色
│  │
│  └─ views/                     # 页面（全部按路由懒加载）
│     ├─ LoginView.vue           # 身份入口页（学生端 / 教师端）
│     ├─ GrowthCenterView.vue    # 成长中心：我的推荐岗位、实训进度概览
│     ├─ SkillTreeView.vue       # 技能树：技能体系（技能点图谱 + 节点详情）/ 岗位体系（岗位清单 + 岗位详情）
│     ├─ LevelMapView.vue        # 关卡地图：只列「我的实训」项目，按三层级分组 + 来源筛选（全部/自主选择/下发任务）
│     ├─ ProjectLevelView.vue    # 关卡详情：步骤条、作答、附件、提交、评审结果、项目资料
│     ├─ HistoryView.vue         # 历史记录：提交记录（项目筛选 + 评审展开）、项目闯关记录
│     ├─ CertificationView.vue   # 认证中心：认证条件、证书列表、鉴定书预览
│     └─ NotFoundView.vue        # 404 兜底
│
├─ index.html                    # HTML 模板（页面标题、站点图标、主题色）
├─ vite.config.ts                # Vite 配置（`@` 别名、Vue DevTools、/api 代理到后端）
├─ env.d.ts                      # Vite 环境类型声明（import.meta.env 等）
├─ tsconfig.json                 # TypeScript 工程引用入口
├─ tsconfig.app.json             # 应用侧 TS 配置（含 `@/*` 路径映射）
├─ tsconfig.node.json            # Node 侧 TS 配置（用于 vite.config.ts）
├─ package.json                  # 依赖与脚本
├─ package-lock.json             # 依赖锁定（提交时一起带上）
├─ .gitignore                    # Git 忽略规则
├─ README.md                     # 本文件
└─ PRD.md                        # 需求文档（产品侧材料，是否随仓库发布自行决定）
```

## 路由与页面

| 路由 | 页面 | 说明 |
| --- | --- | --- |
| `/login` | 身份入口 | 学生端 / 教师端两条入口，也支持带 `?key=xxx` 的回调（后端 SSO 未就绪时 key 当学号用） |
| `/growth` | 成长中心 | 默认首页，`/` 会重定向到这里 |
| `/skill-tree` | 技能选项（左侧导航的叫法，页面标题仍是"岗位与技能体系"） | 顶部切换「技能体系 / 岗位体系」：技能体系是四大体系的技能点图谱（点节点看它训练的关联项目）；岗位体系列出全部岗位，点开岗位看它承担的实训项目。两个体系的每个项目都有「+」加入关卡地图 |
| `/map` | 关卡地图 | 只显示「我的实训」项目（技能选项里点「+」加入 ∪ 老师下发），按层级分组、按来源筛选（全部岗位 / 自主选择 / 下发任务）；自己加的项目可在卡片上直接「移出」，一条都没有时引导去技能选项 |
| `/map/project/:projectId` | 关卡详情 | 主导航高亮仍停留在「关卡地图」 |
| `/map/history` | 历史记录 | 从关卡地图顶部工具条进入（无独立导航项），主导航高亮仍是「关卡地图」 |
| `/certification` | 认证中心 | 认证条件、证书状态、鉴定书预览（数据仍为 mock） |
| `/:pathMatch(.*)*` | 404 | 兜底页 |

除 `/login` 与 404 外，其余路由都需要登录态，未登录会自动跳转到身份入口页。

## 数据流

```text
View（views/*.vue）
   ↓ 读取/触发
Store（stores/*.ts）        ← 页面状态、跨页共享数据（含枚举字典缓存）
   ↓ 调用
API（api/*.ts）             ← 接口签名与后端字段映射（snake_case → 前端模型）
   ↓ HTTP（/api，开发时经 vite 代理）
后端 training_platform       ← 统一响应体 {code, data, msg}
```

同时：

- 类型统一放在 `src/types/index.ts`，页面与接口层共用；
- 需要跨页面保留的内容（登录态、关卡草稿、UI 偏好）通过 `utils/storage.ts` 落到 `localStorage`；
- 状态文案优先取 `GET /enums`（`stores/enums.ts`），取不到时用 `utils/format.ts` 里的本地兜底文案；
- 关卡的多题作答按「`【标题】` + 内容」拼成一段文本存进后端 `answer_text`，读写规则集中在 `utils/answer.ts`。

## 常见改动指引

| 想做什么 | 改哪里 |
| --- | --- |
| 新增 / 调整左侧导航入口 | `config/nav.ts` 加一项（现在是**一层平铺列表**，不写 `group` 就没有分组标题；要分组再给对应项补 `group`），`router/index.ts` 加路由，`views/` 加页面 |
| 改全局配色、圆角、字体 | `assets/styles/tokens.css` |
| 改左侧栏配色（含收起态） | `components/AppNav.vue` 顶部的 `--side-*` 变量组 |
| 改接口地址 / 演示学号 | `config/env.ts`，或用 `VITE_API_BASE_URL`、`VITE_DEMO_STUDENT_NO` 覆盖 |
| 换某个接口或调整字段映射 | 对应的 `api/*.ts`（页面与 store 不用动） |
| 加一个新的后端接口调用 | 在 `api/` 里加函数（用 `http.ts` 的 `get/post/put/patch/del`），再在 store 里调用 |
| 调整状态中文文案 | 后端 `/api/enums` 字典；前端兜底在 `utils/format.ts` |
| 调整 AI 助教可选的模型 | 前端 `config/models.ts` 的 id + 后端 `system_config.ai.llm.models.<id>`（两边 id 必须一致，缺 key 会在回答时报"XX 还没配置 api key"） |
| 调整关卡地图上能出现哪些项目 | 学生自己在技能树节点详情点「+」加入；过滤逻辑在 `views/LevelMapView.vue` 的 `mapProjects` |
| 调整关卡地图顶部的来源筛选 | `views/LevelMapView.vue` 的 `sourceOptions`（全部岗位 / 自主选择 / 下发任务，对应 `picked` / `isRequired` 两个标记） |
| 认证中心接真实后端 | `api/certification.ts` 把 `mockRequest` 换成 `http.ts` 的 `get`，页面（`CertificationView.vue`）不用改；它已经有 `loading` 骨架，接完不会闪空态 |
| 换 AI 助教回答下面显示的模型名 | 后端 SSE 首帧 `meta.model`（`stores/chat.ts` 的 `onModel` 写进消息的 `model` 字段），历史消息读 `ai_qa_message.model_name` |
| 调整技能树的两种体系模式 | `views/SkillTreeView.vue`：顶部 `mode`（skill / job）切换，岗位体系的分组在 `jobProjectGroups` |
| 改浏览器标签标题 | `router/index.ts` 的 `meta.title`，标签统一拼成「{title} · 岗位闯关式实训平台」 |
| 岗位卡片的标签 | `components/PositionCard.vue`：岗位名后面只跟方向标签（等级区间已去掉）；难度药丸由 `showDifficulty` 控制 —— 成长中心显示（需求确认书 §2.3「我的岗位」的卡片字段含难度），技能树「岗位体系」不显示 |
| 调整关卡步骤 | 后端「模块库 + 项目关卡组成」，页面按 `modules` 渲染，没有写死步骤数量 |
| 改登录/鉴权规则 | `router/index.ts` 的守卫 + `stores/user.ts`、`api/auth.ts` |

## 设计约定

- 主色 `#1E7BE8 → #1677FF`，页面底色 `#F0F6FF`，卡片白底 + 12px 圆角；
- 状态色统一：已完成 `#52C41A`、进行中 `#FA8C16`、可挑战 `#1677FF`、未解锁 `#BFBFBF`；
- 数字（得分、完成率、分数、进度）统一使用等宽数字字体，避免刷新时跳动；
- 左侧导航是 `config/nav.ts` 的**一层平铺列表**（四项：成长中心 / 技能选项 / 关卡地图 / 认证中心，不显示分组小标题），每项一个 Element Plus 线性图标；配置项仍保留可选的 `group`，需要分组时再启用；
- **页面不再显示大标题**：页面级的操作、图例、统计放在顶部工具条 `.page-toolbar` 里（`assets/styles/base.css`）；
- 图标分两类：界面按钮用 Element Plus 线性图标，岗位/项目用 emoji；
- 加载态一律用骨架屏，不用整页遮罩，也**不要让空态抢在数据前面渲染**（`CertificationView.vue`、`LevelMapView.vue`、`GrowthCenterView.vue` 都是这个写法）；动效遵守 `prefers-reduced-motion`；
- 岗位卡片的难度药丸只有三种取值：`较易`(BASIC) / `中等`(ADVANCED) / `较难`(EXPANDED)，由 `api/position.ts` 的 `DIFFICULTY_BY_LEVEL` 映射；药丸固定**独占一行、右对齐**（`PositionCard.vue` 的 `.position-card__badges`），不要塞回统计行，否则会随数字宽度在同行/换行之间跳；
- 用户可见文案统一：这个列表叫**关卡地图**（不叫"我的实训"，那是后端 `my-projects` 的内部叫法）、这个页面叫**技能选项**（导航用语，页面标题仍是"岗位与技能体系"）。

## 当前范围说明

- 只实现学生端。教师端未开放，入口页点击后会给出提示。
- **AI 评审**走后端真链路：整单提交后自动调用 `POST /submissions/{id}/ai-review`（后端召回该项目的评分标准 → 大模型打分 → 落库结算）；失败时前端降级为「待评审」并把原因显示在判分面板里。
- **AI 助教**接后端 `/qa`：会话与消息落库、SSE 流式回答、失败可重试；会话历史支持切换 / 改名 / 关闭 / 删除与往上翻更早的消息（后端按保留期过滤）；一期不接知识库检索，回答会带「未接入知识库检索」的提示。
- **AI 助教的模型选择是真分流**：浮窗里选 DeepSeek / Kimi / MiMo，提问时把 id 放进请求体的 `model`，后端按 `ai.llm.models.<id>` 取那一家的 `base_url / model / api_key` 去调用（`ai.llm` 的平铺字段是默认模型，留空 `model` 就用它）。回答下面会显示**实际出这条回答的模型名**（来自 SSE 首帧 `meta.model`，历史消息读 `ai_qa_message.model_name`）。某家没配 key / 没配地址时，回答会明确报"XX 还没配置 api key：请在系统配置 ai.llm.models.xx 里填"，不会悄悄用默认模型。
- **历史记录**（`/map/history`）走真链路：提交记录按项目筛选 + 分页，展开某一行时才去拉该次提交的 AI / 教师评审；项目闯关记录展示状态、关卡进度与最高分，已通过的项目可直接「重新挑战」（后端新建一轮闯关，历史成绩保留在最高分字段里，前端不做数据清理）。
- **关卡地图 = 学生的「我的实训」清单**：后端口径是「自己挑的 ∪ 老师发任务点名必修的」（`GET /students/{id}/my-projects`，项目列表里带 `picked` / `is_required` / `sources`）。自己挑的入口在技能树（技能体系 / 岗位体系）项目行右边的「+」，点它是 `POST /students/{id}/my-projects`（批量、幂等，写 `student_project_pick` 清单表）；**移出有两个入口**：技能树项目行的「已加入」，以及关卡地图卡片上的「移出」（`DELETE /students/{id}/my-projects/{project_id}`，删除前有二次确认）。**老师点名必修的项目即使移出也仍会留在列表里**（必修是任务实时算的，撤回任务后才消失），所以地图上的卡片带「必修」标记、移出后按钮消失但卡片保留。地图顶部的筛选是**项目来源**：全部岗位（地图上全部项目）/ 自主选择（自己加的）/ 下发任务（老师点名必修），与成长中心「实训进度概览」的三种口径同名同义。
- **技能树有两条挑项目的路径**：技能体系按技能点（技能点详情 → 关联项目），岗位体系按岗位（岗位清单 → 岗位详情 → 该岗位承载的项目），两边的项目行都用 `components/ProjectPickRow.vue`，所以「+ / 已加入」状态与关卡地图完全同源。技能体系那张 G6 图在切到岗位体系时会销毁、切回时重建。
- **前端不再依赖后端的编码列**：后端已删掉 `skill_tree.tree_code` / `skill_node.node_code` / `project_stage_template.stage_key`（唯一约束落到名称上），所以体系 id 改用 `tree-<id>`、体系颜色按返回顺序取、关卡简介按「关卡名称」去模块库里关联。
- **岗位选择页已下线**：导航入口、`/positions` 路由与页面文件都已删除，成长中心只保留「我的推荐岗位」卡片（去掉了「查看全部岗位」入口）。后端 `/students/{id}/jobs`（选目标岗位）接口保留未动，前端 `api/position.ts` 里的 `selectPosition` 目前没有页面调用。
- **认证中心**与顶栏的消息/待办角标仍是本地 mock —— 后端还没有证书与通知接口。
- 技能鉴定书为静态预览样式，暂不支持生成与下载。

## 提交前自查

```bash
npm run type-check      # vue-tsc 类型检查（改完代码至少跑这个）
npm run build           # 类型检查 + 生产构建（合并/发版前跑）
```

后端侧对应的是 `cd ../training_platform && uv run python -m pytest -q`（本轮改动已验证：175 通过 / 5 跳过）。

提交时注意：

- `dist/`、`node_modules/`、`.shots/`、`.env*`、`*.tsbuildinfo` 都已在 `.gitignore` 里，不会被误提交；
- 本机截图、临时脚本请放在 `.shots/` 或 `_tmp*/`（同样被忽略）；
- `git diff --check` 在本仓库只会提示 `LF will be replaced by CRLF`——那是 Windows 换行符提示，不是错误；
- 后端仓库里 `data/app.db` 等数据库文件被 `data/*.db` 忽略，但**手工备份要放到 `data/backups/`** 才会被忽略（放在 `data/` 下的其它文件名会变成未跟踪文件）。

## 常见问题

**页面先进来是空的、随后数据才“跳”出来** —— 说明那块没有加载态：数据还没到就渲染了空态 / 0 值。正确写法是先 `loading` 骨架、再 `v-else-if="有数据"` 列表、最后才是空态（参考 `views/CertificationView.vue` 的证书列表区）。

**接口一律 422、提示学生不存在** —— 多半是登录态里的学生 id 过期（换过库 / 换过演示学号）。重新走一次 `/login` 选「学生端」即可；本地登录态存在 `localStorage`，`utils/storage.ts` 里有 `clearAuth`。

**`npm run dev` 报端口被占用** —— Vite 会自动顺延到 5174/5175，看终端里打印的 `Local:` 地址就行；`/api` 代理仍指向 `http://127.0.0.1:8000`。

**AI 助教提示「XX 还没配置 api key」** —— 不是前端问题：让后端在 `system_config` 的 `ai.llm.models.<id>` 里补 `api_key`（或 `scripts/set_llm_config.py --model-key kimi --api-key-env …`）。前端只需保证 `config/models.ts` 的 id 与后端那家的键一致。

**认证中心的证书是假的** —— 后端还没有证书接口（`student_certificate` 表为空），页面在用 `mock/data.ts` 的数据，接后端时只改 `api/certification.ts` 一处。
