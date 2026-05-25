# cf2past

一个给自己设备用的轻量实时剪贴板。你可以在两台设备上打开同一个房间，在一台设备输入或粘贴文本，另一台设备会实时同步。

[English](README.md) | 简体中文

## 目录

- [简介](#简介)
- [功能](#功能)
- [工作原理](#工作原理)
- [快速开始：Cloudflare 手动部署](#快速开始cloudflare-手动部署)
- [快速开始：GitHub Actions 自动部署](#快速开始github-actions-自动部署)
- [首次登录](#首次登录)
- [使用说明](#使用说明)
- [配置参数详解](#配置参数详解)
- [数据库结构](#数据库结构)
- [本地开发](#本地开发)
- [迁移说明](#迁移说明)
- [安全说明](#安全说明)
- [常见问题](#常见问题)
- [许可证](#许可证)

## 简介

cf2past 是一个自托管跨设备剪贴板，基于 Cloudflare Workers、Durable Objects 和 D1 构建。

它适合个人或小范围可信用户使用，不是公开 pastebin。第一次访问会创建管理员账号，后续访问需要登录。

常见使用场景：

- 把手机上的文字发送到电脑。
- 在不同设备之间传命令、笔记、链接或 Markdown。
- 为每个房间保留一小段可搜索历史记录。
- 使用不同房间区分场景，例如 `/work`、`/personal`、`/temp`。

## 功能

- 基于 WebSocket 的实时同步。
- URL 路径即房间，房间之间相互隔离。
- 用户名 + 密码登录，使用 HttpOnly Cookie 保存会话。
- 首次启动自动进入初始化页面，创建第一个用户。
- 每个房间有独立历史记录，支持搜索。
- 历史记录支持置顶、保留、删除。
- 支持 Markdown 预览模式。
- 支持深色和浅色主题。
- 无前端框架，无需自管服务器。

## 工作原理

```text
浏览器 A ── WebSocket ──┐
                         ▼
                    Durable Object
                         ▲
浏览器 B ── WebSocket ──┘
                         │
                         ▼
                      D1 数据库
```

Worker 负责登录、路由、页面和历史记录 API。每个房间对应一个 Durable Object 实例。Durable Object 保存当前房间内容，并把变更广播给所有在线浏览器。D1 负责保存用户、会话和历史记录。

## 快速开始：Cloudflare 手动部署

如果你想从自己的电脑部署，推荐使用这一种方式。

### 1. 准备账号和工具

你需要：

- 一个 Cloudflare 账号。
- Node.js 20 或更新版本。
- npm。
- Wrangler。本项目会通过 `npm install` 安装本地 Wrangler。

克隆仓库并安装依赖：

```bash
git clone https://github.com/<your-name>/cf2past.git
cd cf2past
npm install
```

登录 Cloudflare：

```bash
npx wrangler login
```

### 2. 创建 D1 数据库

创建数据库：

```bash
npx wrangler d1 create cf2past-db
```

Wrangler 会输出类似内容：

```toml
[[d1_databases]]
binding = "DB"
database_name = "cf2past-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

复制其中的 `database_id`，下一步会用到。

### 3. 创建 `wrangler.toml`

复制示例配置：

```bash
cp wrangler.example.toml wrangler.toml
```

打开 `wrangler.toml`，把下面这个占位符：

```toml
database_id = "YOUR_D1_DATABASE_ID"
```

替换成上一步创建 D1 数据库时得到的真实 `database_id`。

注意：`wrangler.toml` 已加入 `.gitignore`，因为它可能包含你自己的 Cloudflare 资源 ID，不应该提交到开源仓库。

### 4. 初始化数据库表

初始化远程 Cloudflare D1 数据库：

```bash
npx wrangler d1 execute cf2past-db --remote --file=schema.sql
```

如果只是本地开发，使用 `--local`：

```bash
npx wrangler d1 execute cf2past-db --local --file=schema.sql
```

### 5. 部署

```bash
npx wrangler deploy
```

部署完成后，Wrangler 会输出 Worker 访问地址。用浏览器打开它，然后继续看 [首次登录](#首次登录)。

## 快速开始：GitHub Actions 自动部署

如果你想每次推送到 `main` 时自动部署，推荐使用这一种方式。

### 1. Fork 或导入仓库

把本仓库 Fork 到你自己的 GitHub 账号，或者导入为一个新仓库。

### 2. 创建 Cloudflare API Token

在 Cloudflare Dashboard 中：

1. 打开 `My Profile`。
2. 打开 `API Tokens`。
3. 创建一个用于部署 Workers 和访问 D1 的 API Token。

一个实用的自定义 Token 通常需要这些权限：

- Account: Cloudflare Workers Scripts: Edit
- Account: D1: Edit

请把权限范围限制在你的账号下。不要使用 Global API Key。

### 3. 获取 Cloudflare Account ID

进入 Cloudflare Dashboard 的账号页面。很多 Cloudflare 页面右侧边栏都会显示 Account ID。

### 4. 创建 D1 数据库

本地执行一次：

```bash
npm install
npx wrangler login
npx wrangler d1 create cf2past-db
```

复制输出中的 `database_id`。

初始化远程数据库：

```bash
npx wrangler d1 execute cf2past-db --remote --file=schema.sql
```

### 5. 添加 GitHub Secrets

在你的 GitHub 仓库中：

1. 打开 `Settings`。
2. 打开 `Secrets and variables`。
3. 打开 `Actions`。
4. 新增以下 repository secrets：

| Secret | 含义 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Wrangler 部署时使用的 Cloudflare API Token。 |
| `CLOUDFLARE_ACCOUNT_ID` | 你的 Cloudflare Account ID。 |
| `CLOUDFLARE_D1_DATABASE_ID` | `wrangler d1 create` 输出的 D1 database id。 |

GitHub Actions 会在 CI 中从 `wrangler.example.toml` 生成 `wrangler.toml`，所以真实 database id 不会被提交到仓库。

### 6. 推送到 `main`

```bash
git push origin main
```

GitHub Actions 会运行 `.github/workflows/deploy.yml` 并部署 Worker。

## 首次登录

打开 Worker 地址。第一次使用时，应用会跳转到 `/setup`。

创建第一个账号：

- Username：你想使用的用户名。
- Password：至少 4 位。

创建完成后，应用会写入会话 Cookie，并跳转到 `/`。

## 使用说明

### 房间

URL 路径就是房间名：

| URL | 房间 |
| --- | --- |
| `/` | `default` |
| `/work` | `work` |
| `/personal` | `personal` |

在多台设备上打开同一个房间，就可以同步文本。

### 编辑模式

| 模式 | 用途 |
| --- | --- |
| `MD` | 以纯文本方式编辑 Markdown。 |
| `TXT` | 编辑普通文本。 |
| `Preview` | 把当前内容渲染为 Markdown 预览。 |

### 历史记录

点击 `History` 打开历史记录面板。

每条历史记录支持：

| 按钮 | 含义 |
| --- | --- |
| `Top` / `顶` | 置顶该记录。 |
| `Keep` / `留` | 保留该记录，不参与自动清理。 |
| `Delete` / `删` | 删除该记录。 |

每个房间最多保留 50 条普通历史记录。置顶或保留的记录不会被自动清理。

### 新会话

点击 `New` 可以开始一条新的历史记录。如果不点击 `New`，在同一房间继续编辑会更新当前历史记录，而不是每次输入都创建新记录。

## 配置参数详解

### `wrangler.example.toml`

```toml
name = "cf2past"
main = "src/index.ts"
compatibility_date = "2024-12-01"

[[d1_databases]]
binding = "DB"
database_name = "cf2past-db"
database_id = "YOUR_D1_DATABASE_ID"

[durable_objects]
bindings = [
  { name = "ROOM", class_name = "Room" }
]

[[migrations]]
tag = "v1"
new_sqlite_classes = ["Room"]
```

字段说明：

| 字段 | 是否必需 | 说明 |
| --- | --- | --- |
| `name` | 是 | Cloudflare Worker 名称。如果你想改 Worker 名，可以修改这里。 |
| `main` | 是 | Worker 入口文件。除非你重构项目，否则保持 `src/index.ts`。 |
| `compatibility_date` | 是 | Cloudflare Workers 运行时兼容日期。建议有意识地更新，并在部署前测试。 |
| `binding = "DB"` | 是 | D1 binding 名称。代码使用 `env.DB`，如果改名，需要同步修改代码。 |
| `database_name` | 是 | D1 数据库名称。文档示例使用 `cf2past-db`。 |
| `database_id` | 部署必需 | Cloudflare D1 database id。真实值应放在本地 `wrangler.toml` 或 GitHub Secrets 中，不要提交到 Git。 |
| `ROOM` | 是 | Durable Object namespace binding。代码使用 `env.ROOM`。 |
| `class_name = "Room"` | 是 | 从 `src/room.ts` 导出的 Durable Object 类名。 |
| `new_sqlite_classes` | 免费套餐通常需要 | 注册基于 SQLite storage 的 Durable Object 类。 |

### GitHub Actions Secrets

| Secret | 是否必需 | 说明 |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | 是 | `npx wrangler deploy` 使用的 Token。 |
| `CLOUDFLARE_ACCOUNT_ID` | 是 | Wrangler 使用的 Cloudflare Account ID。 |
| `CLOUDFLARE_D1_DATABASE_ID` | 是 | CI 中注入到 `wrangler.toml` 的 D1 database id。 |

### 应用常量

这些常量在源码中定义：

| 文件 | 常量 | 默认值 | 含义 |
| --- | --- | --- | --- |
| `src/auth.ts` | `SESSION_DAYS` | `7` | 会话 Cookie 有效期，单位为天。 |
| `src/auth.ts` | `PBKDF2_ITERATIONS` | `100000` | 密码哈希 PBKDF2 迭代次数。 |
| `src/db.ts` | `MAX_HISTORY` | `50` | 每个房间保留的普通历史记录数量。 |

如果你修改这些常量，请运行类型检查并重新部署。

## 数据库结构

`schema.sql` 会创建三张表：

| 表 | 用途 |
| --- | --- |
| `users` | 保存用户名和密码哈希。 |
| `sessions` | 保存会话 token 和过期时间。 |
| `history` | 保存房间历史记录。 |

索引：

| 索引 | 用途 |
| --- | --- |
| `idx_history_room_order` | 加速按房间读取历史记录。 |
| `idx_sessions_expires` | 加速会话过期检查。 |

## 本地开发

先创建本地配置：

```bash
cp wrangler.example.toml wrangler.toml
```

你可以在 `wrangler.toml` 中填真实 D1 database id，也可以只使用本地 D1 模拟环境。

初始化本地数据库表：

```bash
npx wrangler d1 execute cf2past-db --local --file=schema.sql
```

启动开发服务器：

```bash
npm run dev
```

打开 Wrangler 输出的本地地址，通常是 `http://127.0.0.1:8787`。

常用检查命令：

```bash
npx tsc --noEmit
npx wrangler deploy --dry-run
```

## 迁移说明

仓库中包含旧迁移辅助文件：

| 文件 | 含义 |
| --- | --- |
| `migrate-v2.sql` | 旧版历史记录 schema，包含 `content_hash`。会 drop 并重建 `history`。 |
| `migrate-v3.sql` | 当前历史记录 schema，不包含 `content_hash`。同样会 drop 并重建 `history`。 |

警告：这两个迁移文件都会删除 `history` 表。如果数据库里有需要保留的数据，请先导出备份，不要直接执行。

全新安装只需要执行：

```bash
npx wrangler d1 execute cf2past-db --remote --file=schema.sql
```

## 安全说明

- 不要提交 `wrangler.toml`，它可能包含你的 Cloudflare 资源 ID。
- 不要提交 `.dev.vars`、`.env`、API Token、Cookie 或数据库导出文件。
- CI 部署参数使用 GitHub Secrets 保存。
- Cloudflare API Token 使用够用即可的最小权限，不要使用 Global API Key。
- 密码使用随机盐 + PBKDF2-SHA256 哈希后保存。
- 会话使用 HttpOnly、Secure、SameSite=Strict Cookie。
- 本项目适合个人或可信小团队使用，不适合作为匿名公开发帖服务。

## 常见问题

### `Binding DB is undefined`

检查 `wrangler.toml` 是否存在，并且包含：

```toml
[[d1_databases]]
binding = "DB"
```

### `Binding ROOM is undefined`

检查 `wrangler.toml` 是否包含：

```toml
[durable_objects]
bindings = [
  { name = "ROOM", class_name = "Room" }
]
```

### 第一次访问没有进入 `/setup`

数据库里可能已经有用户。如果你在本地测试，可以清理本地 Wrangler state，或者检查本地 D1 数据库。

### GitHub Actions 无法部署

检查这些 secrets 是否存在：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_D1_DATABASE_ID`

同时检查 Cloudflare API Token 是否有 Workers 和 D1 的编辑权限。

### 缺少 `wrangler.toml`

从示例文件复制：

```bash
cp wrangler.example.toml wrangler.toml
```

然后把 `YOUR_D1_DATABASE_ID` 替换成真实 D1 database id。

## 许可证

MIT
