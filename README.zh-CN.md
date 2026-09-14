# cf2past

一个面向个人设备或小范围可信团队的轻量自托管实时剪贴板，基于 Cloudflare Workers、Durable Objects 和 D1。

[English](README.md) | 简体中文

## 功能

- 通过 WebSocket 在多个浏览器之间实时同步房间文本。
- 使用 D1 保存每个房间的可搜索历史记录。
- 支持置顶、保留、删除、新建和恢复历史记录。
- Markdown 预览使用 Marked，并通过 DOMPurify 净化。
- 无前端框架，浏览器端保持轻量。
- 首次初始化后，后续访问需要登录。

## 架构

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

Worker 负责 HTTP、认证和路由。每个规范化房间对应一个 Durable Object，该 Durable Object 是该房间实时状态的唯一权威来源。D1 保存用户、会话和历史记录。

实时同步明确采用 last-write-wins（最后写入获胜）语义；cf2past 不是 CRDT，也不是多人协同编辑器。

## 房间语义

一个房间严格对应一个解码后的 URL path segment：

| URL | 房间 |
| --- | --- |
| `/` | `default` |
| `/work` | `work` |
| `/%E6%9D%A8%E6%A0%91` | `杨树` |

`/lab/test` 这类嵌套路径会被拒绝。房间名支持 Unicode，最长 64 个 Unicode code point。

房间名只是标识符，不是权限边界。除非你在 Worker 前额外增加访问控制，否则任意已登录用户都可以访问任意合法房间名。

## 编辑与历史记录语义

剪贴板内容上限严格为 1 MiB，即 1,048,576 个 UTF-8 字节。超过限制的更新会在修改实时状态、广播状态或 D1 历史之前被拒绝。

普通输入会更新当前实时房间，并合并历史记录写入。Durable Object 始终是实时状态的权威来源；即使权威内容是空字符串，重新连接后也会用服务器状态覆盖客户端旧内容。

`New` 是 Durable Object 内的原子操作：必要时先持久化浏览器最后内容，然后清除当前 history identity、把实时房间置空，并向在线客户端广播空状态。它不再依赖“先发 WebSocket、再单独 HTTP reset”这种跨通道无序流程。

恢复历史记录时，服务端按 history ID 从 D1 读取可信快照，将其加载到实时房间，并开始一个新的编辑会话；被恢复的历史行本身不会被修改。

每个房间最多保留 50 条普通历史记录。置顶或保留的记录不参与普通历史自动清理。

## 认证与会话

首次访问 `/setup` 创建第一个账号。新密码至少 8 位。

新密码哈希使用带版本标记的 PBKDF2-SHA256，迭代 600,000 次并使用随机 salt。旧版无版本标记的 100,000 次 PBKDF2 哈希仍可登录；旧账号成功登录后会自动升级为新哈希格式。

新会话只签发 `__Host-cf2past_session` Cookie，并使用 `HttpOnly`、`Secure`、`SameSite=Strict`。迁移期间，仍未过期的旧 `session` Cookie 可以继续读取，但不会再签发新的旧 Cookie。会话有效期为 7 天。

## 浏览器安全

Markdown 预览链路为：

```text
文本 -> Marked -> DOMPurify -> DOM
```

未经净化的 Marked 输出不会直接写入预览 HTML。Marked 和 DOMPurify 使用精确版本 CDN URL，并带 Subresource Integrity（SRI）。

应用脚本使用每个响应独立生成的 nonce，并受 Content Security Policy 约束；脚本执行不依赖 `unsafe-inline`，HTML 中也不使用 `onclick` 等内联事件属性。浏览器发起的状态修改请求会进行 same-origin 校验。

安全边界和漏洞报告方式见 [SECURITY.md](SECURITY.md)。

## 快速部署

需要：

- Cloudflare 账号
- Node.js 22 或更新版本
- npm
- 项目依赖中的 Wrangler 4

克隆并安装：

```bash
git clone https://github.com/<your-name>/cf2past.git
cd cf2past
npm install
```

登录 Cloudflare 并创建 D1：

```bash
npx wrangler login
npx wrangler d1 create cf2past-db
```

复制示例配置，并把 `YOUR_D1_DATABASE_ID` 替换成实际 D1 database id：

```bash
cp wrangler.example.toml wrangler.toml
```

初始化新的远程数据库：

```bash
npx wrangler d1 execute cf2past-db --remote --file=schema.sql
```

部署：

```bash
npm run deploy
```

打开 Worker 地址。全新数据库会跳转到 `/setup`，用于创建第一个账号。

## GitHub Actions 自动部署

`.github/workflows/deploy.yml` 将验证和生产部署分开。

Pull Request 会运行 verify job。推送到 `main` 也会先运行 verify，只有 verify 成功后才会执行生产部署。

自动部署前需要添加以下 repository secrets：

| Secret | 用途 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Wrangler 部署使用的 Cloudflare API Token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |
| `CLOUDFLARE_D1_DATABASE_ID` | CI 生成 `wrangler.toml` 时注入的真实 D1 database id |

真实 D1 ID 和 Cloudflare 凭据不会写入仓库。

Dependabot 已配置为每周检查 npm 和 GitHub Actions 依赖更新。

## 本地开发与验证

先创建本地 Wrangler 配置：

```bash
cp wrangler.example.toml wrangler.toml
```

本地 D1 开发：

```bash
npx wrangler d1 execute cf2past-db --local --file=schema.sql
npm run dev
```

合并或部署前运行：

```bash
npm ci
npm test
npm run typecheck
npm run dry-run
```

测试运行在 Cloudflare Workers 测试环境中，覆盖 Worker 路由、D1、Durable Object 状态、认证迁移、房间解析、请求大小限制、Markdown/CSP 接线和实时状态回归问题。

## 数据库与迁移

`schema.sql` 是当前三张表的 schema：`users`、`sessions` 和 `history`。

本轮 hardening 不需要 D1 schema migration；当前分支的 `schema.sql` 与 `main` 完全一致。

仓库中仍保留历史迁移辅助文件 `migrate-v2.sql` 和 `migrate-v3.sql`。它们会删除并重建 history 表。如果数据库中的历史记录需要保留，不要直接运行这些脚本，除非你已经做好备份并明确需要执行相应迁移。

全新安装只需要使用 `schema.sql` 初始化数据库。

## 运维与安全注意事项

- 不要提交 `wrangler.toml`、`.dev.vars`、`.env`、API Token、Cookie、数据库导出或其他凭据。
- 剪贴板文本对服务端可见，并会持久化到 D1 history；cf2past 不提供端到端加密。
- Cloudflare API Token 使用满足部署需求的最小权限。
- 定期更新 npm 和浏览器依赖，并在合并 Dependabot PR 前审查变更。
- 如果修改 Workers compatibility date、bindings 或运行时依赖，需要重新执行完整验证后再部署。

## 许可证

MIT
