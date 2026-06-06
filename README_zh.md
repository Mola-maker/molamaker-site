<div align="center">

# molamaker · 墨拉工坊

**一个人，一份数据，六种体验方式。**

一个 Claude 风格的个人**作品集 + 文集**站点：把*同一份*实时数据
（仓库、文章、音乐、留言、访客）通过六种可切换的视觉「变体」呈现出来，
另外还有一个自托管的**工作台（Workplace）**，内含 AI 看板娘、AI 几何工作室，
以及真实可用的登录鉴权。

[English](./README.md) · [简体中文](./README_zh.md)

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres-3FCF8E?logo=supabase&logoColor=white)
![next-intl](https://img.shields.io/badge/next--intl-v4-FF6B6B)
![License](https://img.shields.io/badge/license-MIT-blue)

![杂志变体](docs/images/magazine.png)

</div>

---

## ✨ 这是什么？

`molamaker-site` 的核心理念是：**你的数据不该被锁死在一种布局里。**
站点维护单一数据源——GitHub 仓库、博客文章、正在播放的音乐、留言、访客数——
再把它喂给六个互相独立的「变体」。从底部 dock 切换，同一份内容就会重新渲染成
杂志、星图、音乐流、工作台等不同形态。

| # | 变体 | 感觉像 |
|---|------|--------|
| 01 | **Terminal 终端** | 打字机式命令行首页，默认落地页。 |
| 02 | **Magazine 杂志** | 双语编辑式排版，大号标题字。 |
| 03 | **Atlas 星图** | 把各板块变成可导航的星座节点。 |
| 04 | **Stream 流** | 实时「此刻」信息流，带可播放的黑胶唱片机。 |
| 05 | **Workplace 工作台** | 登录后的工作区：AI 看板娘、几何工作室、看板。 |
| 06 | **Notebook 笔记本** | 安静的纸张质感阅读布局。 |

全站通过 `next-intl` 实现**中英双语**，语言路由位于 `app/[locale]/…`。

---

## 📸 截图画廊

<table>
  <tr>
    <td width="50%"><img src="docs/images/magazine.png" alt="杂志变体" /><br/><sub><b>02 · 杂志</b> — 双语编辑式大字排版</sub></td>
    <td width="50%"><img src="docs/images/atlas.png" alt="星图变体" /><br/><sub><b>03 · 星图</b> — 站点的星座地图</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/images/stream.png" alt="流变体" /><br/><sub><b>04 · 流</b> — 实时信息流 + 黑胶唱片机</sub></td>
    <td width="50%"><img src="docs/images/workplace.png" alt="工作台变体" /><br/><sub><b>05 · 工作台</b> — AstrBot 对话 + Live2D 看板娘</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/images/math-studio.png" alt="几何工作室" /><br/><sub><b>几何工作室</b> — AI 描述几何，GeoGebra 作图，「Magic!」导出 TikZ</sub></td>
    <td width="50%"><img src="docs/images/workplace-upload.png" alt="AstrBot 图片上传" /><br/><sub><b>AstrBot 上传</b> — 直接把图片拖进对话框</sub></td>
  </tr>
</table>

> 💡 想新增或替换截图？见下文 **[添加与替换截图（最简流程）](#-添加与替换截图最简流程)**，三步搞定。

---

## 🧩 功能亮点

- **六种视觉变体** —— 一份数据、六种布局，切换瞬间带电影感过场动画。
- **实时数据** —— 置顶的 GitHub 仓库、基于文件系统的博客（`content/*.md`）、
  Supabase 的浏览计数、留言簿、实时访客轮询。
- **工作台（No. 05）** —— 一个真正需要登录的工作区：
  - **AstrBot + Live2D 看板娘** —— 自托管动画角色的对话 Agent，支持**图片 / 文件上传**。
  - **几何工作室** —— 用自然语言描述几何题，LLM 流水线先规划，再由
    **GeoGebra** 作图，最后用 **「Magic!」** 按钮导出干净的 `tkz-euclide`
    TikZ 代码供 LaTeX 使用。
  - **鉴权** —— 手机验证码（阿里云短信）、微信扫码登录、管理员密钥。
- **音乐播放器** —— 黑胶风格播放器，后端走网易云音乐 API。
- **双语** —— 基于 `next-intl` v4 的完整中英文。
- **隐私优先的统计** —— 中间件把页面浏览写入 Postgres，无第三方追踪。

---

## 🏗️ 架构

本站是**混合部署**：Next.js 前端部署在 Vercel，较重的自托管服务
（AI 看板娘、GeoGebra 资源包、音乐 API）跑在 ECS 上。工作台变体会请求这些后端，
所以当你只在本地跑 Vercel 前端时，它的面板显示为离线属于正常现象。

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│  Next.js 16（App Router）    │        │  自托管（ECS）               │
│  • 6 个变体 / [locale]       │  HTTP  │  • AstrBot（对话 + 上传）    │
│  • Server Actions + API      │ ─────▶ │  • GeoGebra 数学应用包       │
│  • next-intl 中间件          │        │  • Live2D 看板娘资源         │
└──────────────┬──────────────┘        │  • 网易云音乐 API（Docker）  │
               │                        └──────────────────────────────┘
               ▼
        ┌──────────────┐
        │  Supabase    │  posts · page_views · guestbook · contacts（RLS）
        └──────────────┘
```

**技术栈：** Next.js 16 · React 19 · TypeScript 5 · Supabase（Postgres + RLS）·
next-intl v4 · GSAP · KaTeX · Zod。

---

## 🚀 快速开始

> 需要 **Node ≥ 22** 与 **npm ≥ 10**。

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量——复制模板并填入你的密钥
cp .env.local.example .env.local

# 3. 初始化数据库（Supabase → SQL Editor → 粘贴 supabase/schema.sql）
#    或在已 link 的 Supabase CLI 下执行：npm run db:reset

# 4. 启动
npm run dev
```

打开 <http://localhost:3000>，站点会自动跳转到 `/en` 或 `/zh`。

> **工作台**面板（AstrBot、几何工作室、音乐）依赖自托管后端，本地会显示离线，
> 这是预期行为，并非 bug。

### 常用脚本

| 命令 | 作用 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 生产构建 |
| `npm run lint` | ESLint（零警告策略） |
| `npm run test` | 运行 Vitest 测试 |
| `npm run i18n:check` | 校验翻译 key 是否同步 |
| `npm run db:types` | 生成 Supabase TypeScript 类型 |

---

## 🔑 环境变量

所有配置都在 **`.env.local`**（已被 git 忽略）。从带完整注释的
[`.env.local.example`](./.env.local.example) 开始。主要分组：

| 分组 | Key | 用途 |
|------|-----|------|
| **Supabase** | `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY` | 文章、浏览数、留言（核心） |
| **GitHub** | `GITHUB_TOKEN`、`GITHUB_USERNAME` | 置顶仓库卡片 |
| **AI / 对话** | `ASTRBOT_*`、`COZE_*`、`DEEPSEEK_API_KEY`、`DASHSCOPE_API_KEY`、`ANTHROPIC_API_KEY` | 工作台对话与几何工作室 |
| **鉴权** | `OWNER_EMAIL`、`WORKPLACE_SESSION_SECRET`、`WORKPLACE_ADMIN_KEY`、`WORKPLACE_OWNER_PHONE` | 工作台登录 |
| **手机验证码** | `ALIYUN_SMS_*` | 生产环境真实短信 |
| **微信登录** | `WECHAT_APP_ID`、`WECHAT_APP_SECRET`、`WECHAT_REDIRECT_URI` | 扫码登录 |
| **自托管** | `NEXT_PUBLIC_GEOGEBRA_BASE_URL`、`NEXT_PUBLIC_LIVE2D_BASE`、`NETEASE_API_URL` | 几何、看板娘、音乐资源 |

> 🔒 **切勿提交密钥。** `.gitignore` 会忽略所有真实的 `.env*` 文件，只追踪
> `*.example` / `*.template` 模板。可用 `git check-ignore .env.local` 验证——
> 它应当输出该文件名。

---

## 📦 部署

权威操作手册见 **[`deploy/DEPLOY.md`](./deploy/DEPLOY.md)**。

- **前端 → Vercel：** 导入仓库，并补上 `.env.local` 里的环境变量。
- **自托管服务 → ECS：** AstrBot、GeoGebra 资源包、Live2D 资源、网易云音乐 API
  都跑在服务器上。各服务的部署指南见 `deploy/` 目录
  （`deploy/geogebra/SETUP.md`、`deploy/live2d/SETUP.md`、`deploy/netease/`）。

---

## 🗂️ 目录结构

```
app/
  [locale]/            # 所有本地化页面（en、zh）
  api/                 # 路由处理器（不本地化）
    astrbot/           # 对话、流式、上传
    workplace/         # 鉴权（手机/微信/密钥）、数学、代理
    github/ music/ views/ visitors/ …
components/redesign/    # 六个变体 + chrome（导航、变体栏、dock）
  v-magazine · v-atlas · v-stream · v-workplace · …
  data.ts              # 可视化原型用的静态演示数据
lib/
  workplace/           # 几何工作室：GeoGebra 流水线、TikZ 导出
  supabase/ github.ts rate-limit.ts …
content/                # 文件系统博客文章（*.md）
supabase/               # schema.sql + 迁移 + 类型
deploy/                 # DEPLOY.md + 各服务部署指南
docs/images/            # README 截图  ← 新截图放这里
```

---

## 📸 添加与替换截图（最简流程）

本 README 的截图都来自 **`docs/images/`**。新增或替换一张图只需三步——
不用写代码，也不用构建。

> ⚠️ 图片要放在 **`docs/images/`**。不要用 `photo/` 或 `public/photo/`——
> 这两个目录被 git 忽略，放进去 GitHub 上不会显示。

**第 1 步 —— 把图片放进 `docs/images/`**，用清晰的小写文件名
（不要空格、不要中文），例如 `notebook.png`。

```bash
# 在项目根目录执行
cp "C:/路径/你的截图.png" docs/images/notebook.png
```

**第 2 步 —— 把它插入 README**，按需选择写法：

```markdown
<!-- a) 整列宽度的图 -->
![Notebook 变体](docs/images/notebook.png)

<!-- b) 指定宽度（居中） -->
<p align="center">
  <img src="docs/images/notebook.png" alt="Notebook 变体" width="600" />
</p>

<!-- c) 并排两张（放进画廊表格里） -->
<td width="50%">
  <img src="docs/images/notebook.png" alt="Notebook" /><br/>
  <sub><b>06 · Notebook</b> — 安静的阅读布局</sub>
</td>
```

**第 3 步 —— 把图片和 README 一起提交**，这样 GitHub 上链接才解析得到：

```bash
git add docs/images/notebook.png README_zh.md
git commit -m "docs: 添加 notebook 截图"
```

**速查表**

| 我想要… | 写法 |
|---------|------|
| 快速整列宽度的图 | `![alt](docs/images/file.png)` |
| 指定宽度 | `<img src="docs/images/file.png" width="600">` |
| 居中 | 用 `<p align="center">…</p>` 包住 `<img>` |
| 并排两张 | 在画廊 `<table>` 里加一个 `<td>…</td>` |
| 可点击的缩略图 | `[![alt](docs/images/file.png)](docs/images/file.png)` |

就这样——粘贴片段、指向你的文件、把两者一起提交即可。✅

---

## 📝 备注

- 首页各变体按短间隔做 ISR 重新校验；博客浏览数通过 Postgres 的
  `increment_view` 函数原子自增。
- Server Actions 通过 `anon` key 写入，由 RLS 策略强制各项限制。
- 几何工作室在把图形交给 GeoGebra 之前，使用多轮 LLM 流水线
  （规划 → 生成 → 执行 → 修复）。

---

<div align="center">
<sub>用 Next.js、Supabase 和过量的咖啡构建。· 墨拉工坊</sub>
</div>
