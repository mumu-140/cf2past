# cf2past

A lightweight self-hosted real-time clipboard built on Cloudflare Workers, Durable Objects, and D1.

[简体中文](README.zh-CN.md)

## What is it?

cf2past lets you share text between your own devices in real time. Open the same room on two browsers and edits are synchronized automatically.

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

## Self-host

Requirements: a Cloudflare account and Node.js 24+.

```bash
git clone https://github.com/mumu-140/cf2past.git
cd cf2past
npm install
npx wrangler login
npx wrangler d1 create cf2past-db
cp wrangler.example.toml wrangler.toml
```

Replace `YOUR_D1_DATABASE_ID` in `wrangler.toml` with the D1 database ID returned by Cloudflare, then initialize and deploy:

```bash
npx wrangler d1 execute cf2past-db --remote --file=schema.sql
npm run deploy
```

Open the Worker URL and create your account.

> cf2past stores clipboard text on the server and in D1 history. It is not end-to-end encrypted.

## License

MIT
---
## Acknowledgments

Special thanks to the **[Linux.do](https://linux.do/)** community for your support and feedback.

