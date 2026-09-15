# cf2paste

一个基于 Cloudflare Workers、Durable Objects 和 D1 的轻量自托管实时剪贴板。

[English](README.md)

## 是什么？

cf2paste 用来在自己的多台设备之间实时同步文本。两个浏览器打开同一个房间后，一边输入，另一边会自动同步。

主要功能：

- 多房间
- 可搜索的历史记录
- 置顶、保留、删除、新建和恢复
- Markdown 预览
- 登录保护

适合个人使用或小范围可信团队。

## 怎么用？

1. 打开部署后的 Worker 地址。
2. 第一次使用时，在 `/setup` 创建第一个账号。
3. `/` 是默认房间。
4. 在地址后加房间名即可创建或进入其他房间，例如 `/work`、`/notes`。
5. 在另一台设备打开同一个房间，直接输入文字即可实时同步。
6. 点击 **历史** 可以搜索或恢复以前的内容；点击 **新建** 开始一条新的记录。

## 部署

### 推荐：纯网页部署

这是大多数用户最方便的方式。全程只需要 GitHub 和 Cloudflare 网页，不需要本地终端。

#### 1. Fork 仓库

在 GitHub 打开本仓库，点击 **Fork**，复制一份到自己的 GitHub 账号。

如果 Fork 后 GitHub Actions 默认未启用，进入 **Actions** 页面先启用 workflows。

#### 2. 在 Cloudflare 创建 D1 数据库

1. 打开 Cloudflare Dashboard。
2. 进入 **Storage & databases → D1 SQL Database**。
3. 点击 **Create Database**。
4. 数据库名称填写 `cf2past-db`。
5. 创建完成后打开这个数据库。

#### 3. 直接在网页初始化 D1

1. 回到你的 GitHub Fork，打开 `schema.sql`，复制其中全部 SQL 内容。
2. 在 Cloudflare 打开刚创建的 D1 数据库，进入 **Console**。
3. 粘贴 `schema.sql` 的全部内容，点击 **Execute**。

这样数据库就初始化完成了，不需要在本地执行 `wrangler d1 execute`。

#### 4. 获取 3 个 Cloudflare 参数

GitHub Actions 部署需要以下 3 个值：

**`CLOUDFLARE_D1_DATABASE_ID`**

打开刚创建的 D1 数据库，在数据库页面复制它的 **Database ID / UUID**。

**`CLOUDFLARE_ACCOUNT_ID`**

在 Cloudflare Dashboard 中按 `Ctrl/Cmd + K`，搜索 **Copy account ID** 并复制。也可以进入 **Workers & Pages → Account Details** 查看 Account ID。

**`CLOUDFLARE_API_TOKEN`**

1. Cloudflare 进入 **Manage Account → API Tokens**。
2. 点击 **Create Token**。
3. 选择 **Edit Cloudflare Workers** 模板。
4. Account Resources 选择你准备部署 cf2paste 的 Cloudflare 账号。
5. 创建 Token，并复制最终显示的 Token 值。

Token 通常只完整显示一次。GitHub Secret 中直接粘贴 Token 本体，不要在前面添加 `Bearer `。

#### 5. 把参数加入 GitHub Secrets

进入你的 Fork：

**Settings → Secrets and variables → Actions → New repository secret**

依次添加以下 3 个 Secret，名称必须完全一致：

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_D1_DATABASE_ID
```

#### 6. 设置 Worker 名称并触发第一次部署

**不需要先在 Cloudflare 手动创建 Worker。** 第一次 GitHub Actions 部署成功时，Wrangler 会自动创建 Worker；以后部署则更新同一个 Worker。

在你的 GitHub Fork 中：

1. 打开 `wrangler.example.toml`。
2. 点击右上角铅笔图标，直接在网页编辑。
3. 修改第一行 Worker 名称，例如：

```toml
name = "cf2paste-yourname"
```

4. 点击 **Commit changes**，直接提交到 `main`。

这次网页提交会自动触发 **Actions → CI and Deploy**。`verify` 测试通过后，GitHub 会继续执行 Cloudflare 部署。

如果之前已经有一条 Actions 运行记录，只是因为 Secret 缺失或配置错误而失败，那么修好后也可以打开那条运行记录，点击 **Re-run all jobs**。

#### 7. 在 Cloudflare 查看 Worker

GitHub Actions 全部变绿后：

1. 打开 **Cloudflare Dashboard → Workers & Pages**。
2. 找到你在 `wrangler.example.toml` 中设置的 Worker 名称。
3. 打开 Worker，即可看到部署状态和它的 `workers.dev` 地址。
4. 打开这个地址，第一次使用访问 `/setup` 创建账号。

以后只要有新的代码推送到 `main`，GitHub Actions 就会自动更新这个 Worker。

### 本地部署

少部分希望直接使用 Wrangler 的用户，可以按下面方式部署。需要 Cloudflare 账号和 Node.js 24+。

```bash
git clone https://github.com/mumu-140/cf2paste.git
cd cf2paste
npm install
npx wrangler login
npx wrangler d1 create cf2past-db
cp wrangler.example.toml wrangler.toml
```

把 `wrangler.toml` 中的 `YOUR_D1_DATABASE_ID` 替换为 Cloudflare 返回的 D1 Database ID；如有需要，也可以修改其中的 `name` 为自己的 Worker 名称。然后初始化数据库并部署：

```bash
npx wrangler d1 execute cf2past-db --remote --file=schema.sql
npm run deploy
```

打开 Worker 地址，创建账号即可使用。

> cf2paste 的剪贴板文本会保存在服务端和 D1 历史记录中，不提供端到端加密。

## License

MIT

---

## Acknowledgments

Special thanks to the **[Linux.do](https://linux.do/)** community for your support and feedback.
