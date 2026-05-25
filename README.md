# cf2past

Real-time cross-device clipboard. Type on one device, see it instantly on another.

Built on Cloudflare Workers + Durable Objects + D1.

## Features

- **Real-time sync** — WebSocket push, no refresh needed
- **Room isolation** — URL path as room (`/work`, `/personal`)
- **History** — Last 50 entries with search
- **Auth** — Username + password, cookie-based session (7 days)
- **Minimal** — No framework, no build step, single deploy

## Deploy

Requirements: [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works)

```bash
# Install dependencies
npm install

# Create D1 database
npx wrangler d1 create cf2past-db
# Copy the database_id from output into wrangler.toml

# Initialize tables
npx wrangler d1 execute cf2past-db --file=schema.sql

# Deploy
npx wrangler deploy
```

First visit redirects to `/setup` to create your account.

## Local Development

```bash
npx wrangler dev
```

## Usage

- Open `https://your-worker.workers.dev/` — default room
- Open `https://your-worker.workers.dev/myroom` — custom room
- Type in the textarea — syncs to all connected devices in the same room
- Click "历史" to browse and search past entries

## Architecture

```
Browser A ──WebSocket──┐     ┌──WebSocket── Browser B
                       ▼     ▼
                  Durable Object (Room)
                       │
                  Worker (auth + routing)
                       │
                   D1 (SQLite)
```

## Tech Stack

- Cloudflare Workers — edge compute
- Durable Objects — WebSocket room management
- D1 — SQLite database (users, sessions, history)
- Vanilla HTML/JS — zero dependencies frontend

## License

MIT
