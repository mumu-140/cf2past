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

## 通过 GitHub Actions 部署

1. Fork 本仓库到自己的 GitHub 账号。
2. 在 Cloudflare 中创建 D1 数据库 `cf2past-db`，复制它的 **Database ID**。
3. 在 Cloudflare 创建 API Token，使用 **Edit Cloudflare Workers** 模板，并复制你的 **Account ID**。
4. 在 GitHub 仓库进入 **Settings → Secrets and variables → Actions**，添加：

   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_D1_DATABASE_ID`

5. 第一次部署前，在本地初始化一次 D1：

```bash
git clone https://github.com/<your-name>/cf2paste.git
cd cf2paste
npm install
npx wrangler login
npx wrangler d1 execute cf2past-db --remote --file=schema.sql
```

6. Push 或合并到 `main`。GitHub Actions 会先运行测试，通过后自动部署到 Cloudflare。

## 手动部署到 Cloudflare

需要 Cloudflare 账号和 Node.js 24+。

```bash
git clone https://github.com/mumu-140/cf2paste.git
cd cf2paste
npm install
npx wrangler login
npx wrangler d1 create cf2past-db
cp wrangler.example.toml wrangler.toml
```

把 `wrangler.toml` 中的 `YOUR_D1_DATABASE_ID` 替换为 Cloudflare 返回的 D1 Database ID，然后初始化数据库并部署：

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
