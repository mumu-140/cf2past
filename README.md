# cf2paste

A lightweight self-hosted real-time clipboard built on Cloudflare Workers, Durable Objects, and D1.

[简体中文](README.zh-CN.md)

## What is it?

cf2paste lets you share text between your own devices in real time. Open the same room on two browsers and edits are synchronized automatically.

It also provides:

- Multiple rooms
- Searchable history
- Pin, preserve, delete, New, and restore
- Markdown preview
- Login protection

It is designed for personal use or a small trusted team.

## How to use

1. Open your deployed Worker URL.
2. On first use, create the first account at `/setup`.
3. `/` is the default room.
4. Add a room name to the URL to create or open another room, for example `/work` or `/notes`.
5. Open the same room on another device and start typing. Text will synchronize automatically.
6. Use **History** to search or restore previous content, and **New** to start a fresh entry.

## Deploy

### Recommended: browser-only deployment

This is the easiest option for most users. You only need GitHub and Cloudflare in the browser; no local terminal is required.

#### 1. Fork the repository

Open this repository on GitHub and click **Fork** to create your own copy.

If GitHub Actions is disabled in the fork, open **Actions** and enable workflows first.

#### 2. Create the D1 database in Cloudflare

1. Open the Cloudflare Dashboard.
2. Go to **Storage & databases → D1 SQL Database**.
3. Click **Create Database**.
4. Use `cf2past-db` as the database name.
5. Open the database after it is created.

#### 3. Initialize D1 from the browser

1. In your GitHub fork, open `schema.sql` and copy all of its contents.
2. In Cloudflare, open the D1 database and select **Console**.
3. Paste the contents of `schema.sql` and click **Execute**.

The database is now ready; no local `wrangler d1 execute` command is required.

#### 4. Get the three Cloudflare values

You need three values for GitHub Actions:

**`CLOUDFLARE_D1_DATABASE_ID`**

Open the D1 database you just created and copy its **Database ID / UUID**.

**`CLOUDFLARE_ACCOUNT_ID`**

In the Cloudflare Dashboard, press `Ctrl/Cmd + K`, search for **Copy account ID**, and copy it. You can also find it under **Workers & Pages → Account Details**.

**`CLOUDFLARE_API_TOKEN`**

1. In Cloudflare, go to **Manage Account → API Tokens**.
2. Click **Create Token**.
3. Choose the **Edit Cloudflare Workers** template.
4. Select the Cloudflare account you want to deploy to.
5. Create the token and copy the token value.

The token value is normally shown only once. Paste the token itself into GitHub; do not add `Bearer ` before it.

#### 5. Add the values to GitHub Secrets

In your fork, open:

**Settings → Secrets and variables → Actions → New repository secret**

Add these three secrets with the exact names below:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_D1_DATABASE_ID
```

#### 6. Choose the Worker name and trigger the first deployment

You do **not** need to create a Worker manually in Cloudflare first. The first successful GitHub Actions deployment will create it automatically.

In your GitHub fork:

1. Open `wrangler.example.toml`.
2. Click the pencil icon to edit it in the browser.
3. Change the first line, for example:

```toml
name = "cf2paste-yourname"
```

4. Click **Commit changes** and commit directly to `main`.

That commit triggers **Actions → CI and Deploy**. After the `verify` job passes, GitHub will run the Cloudflare deployment automatically.

If you already have an Actions run from an earlier attempt, you can also open that run and choose **Re-run all jobs** after fixing the Secrets.

#### 7. Find the Worker in Cloudflare

After GitHub Actions is green:

1. Open **Cloudflare Dashboard → Workers & Pages**.
2. Open the Worker name you set in `wrangler.example.toml`.
3. The Worker page shows its deployment status and `workers.dev` URL.
4. Open that URL and visit `/setup` to create the first account.

GitHub Actions will update the same Worker on later pushes to `main`.

### Local deployment

For users who prefer Wrangler locally, Node.js 24+ is required.

```bash
git clone https://github.com/mumu-140/cf2paste.git
cd cf2paste
npm install
npx wrangler login
npx wrangler d1 create cf2past-db
cp wrangler.example.toml wrangler.toml
```

Replace `YOUR_D1_DATABASE_ID` in `wrangler.toml` with the D1 database ID returned by Cloudflare. You may also change the `name` field to your preferred Worker name. Then initialize and deploy:

```bash
npx wrangler d1 execute cf2past-db --remote --file=schema.sql
npm run deploy
```

Open the Worker URL and create your account.

> cf2paste stores clipboard text on the server and in D1 history. It is not end-to-end encrypted.

## License

MIT

---

## Acknowledgments

Special thanks to the **[Linux.do](https://linux.do/)** community for your support and feedback.
