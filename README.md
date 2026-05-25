# cf2past

A tiny real-time clipboard for your own devices. Open the same room on two devices, type or paste text on one device, and see it update on the other device instantly.

English | [简体中文](README.zh-CN.md)

## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [How It Works](#how-it-works)
- [Quick Start: Cloudflare Deployment](#quick-start-cloudflare-deployment)
- [Quick Start: GitHub Actions Deployment](#quick-start-github-actions-deployment)
- [First Login](#first-login)
- [Usage](#usage)
- [Configuration Reference](#configuration-reference)
- [Database Schema](#database-schema)
- [Local Development](#local-development)
- [Migration Notes](#migration-notes)
- [Security Notes](#security-notes)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Introduction

cf2past is a self-hosted cross-device clipboard built on Cloudflare Workers, Durable Objects, and D1.

It is designed for one person or a small trusted group. It is not a public pastebin. The first visit creates an admin account, and later visits require login.

Typical use cases:

- Send text from a phone to a computer.
- Move commands, notes, links, or Markdown between devices.
- Keep a small searchable history for each room.
- Use separate rooms such as `/work`, `/personal`, or `/temp`.

## Features

- Real-time sync over WebSocket.
- Room isolation using the URL path.
- Username/password login with HttpOnly cookie sessions.
- First-run setup page for creating the first user.
- Per-room history with search.
- Pin and preserve important history items.
- Markdown preview mode.
- Dark and light themes.
- No frontend framework and no server to manage.

## How It Works

```text
Browser A ── WebSocket ──┐
                         ▼
                    Durable Object
                         ▲
Browser B ── WebSocket ──┘
                         │
                         ▼
                    D1 database
```

The Worker handles authentication, routing, pages, and history APIs. Each room maps to one Durable Object instance. The Durable Object keeps the current room content and broadcasts updates to connected browsers. D1 stores users, sessions, and history.

## Quick Start: Cloudflare Deployment

This path is best if you want to deploy from your own computer.

### 1. Prepare Accounts and Tools

You need:

- A Cloudflare account.
- Node.js 20 or newer.
- npm.
- Wrangler, installed through this project with `npm install`.

Clone the repository and install dependencies:

```bash
git clone https://github.com/<your-name>/cf2past.git
cd cf2past
npm install
```

Log in to Cloudflare:

```bash
npx wrangler login
```

### 2. Create a D1 Database

Create the database:

```bash
npx wrangler d1 create cf2past-db
```

Wrangler prints output similar to this:

```toml
[[d1_databases]]
binding = "DB"
database_name = "cf2past-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Copy the `database_id`. You will use it in the next step.

### 3. Create `wrangler.toml`

Copy the example config:

```bash
cp wrangler.example.toml wrangler.toml
```

Open `wrangler.toml` and replace this placeholder:

```toml
database_id = "YOUR_D1_DATABASE_ID"
```

with the real D1 database id from the previous step.

Important: `wrangler.toml` is ignored by Git because it may contain account-specific resource IDs.

### 4. Initialize Database Tables

For the remote Cloudflare D1 database, run:

```bash
npx wrangler d1 execute cf2past-db --remote --file=schema.sql
```

For local development only, use `--local` instead:

```bash
npx wrangler d1 execute cf2past-db --local --file=schema.sql
```

### 5. Deploy

```bash
npx wrangler deploy
```

After deployment, Wrangler prints your Worker URL. Open it in a browser and continue with [First Login](#first-login).

## Quick Start: GitHub Actions Deployment

This path is best if you want GitHub to deploy automatically whenever you push to `main`.

### 1. Fork or Import the Repository

Fork this repository to your own GitHub account, or import it as a new repository.

### 2. Create a Cloudflare API Token

In Cloudflare Dashboard:

1. Open `My Profile`.
2. Open `API Tokens`.
3. Create a token with permission to deploy Workers and access the D1 database.

A practical custom token should include permissions for:

- Account: Cloudflare Workers Scripts: Edit
- Account: D1: Edit

Scope it to your account. Avoid using a global API key.

### 3. Get Your Cloudflare Account ID

In the Cloudflare Dashboard, open the account. The Account ID is shown in the right sidebar on many Cloudflare pages.

### 4. Create the D1 Database

Run this locally once:

```bash
npm install
npx wrangler login
npx wrangler d1 create cf2past-db
```

Copy the generated `database_id`.

Initialize the remote database:

```bash
npx wrangler d1 execute cf2past-db --remote --file=schema.sql
```

### 5. Add GitHub Secrets

In your GitHub repository:

1. Open `Settings`.
2. Open `Secrets and variables`.
3. Open `Actions`.
4. Add these repository secrets:

| Secret | Meaning |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token used by Wrangler. |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID. |
| `CLOUDFLARE_D1_DATABASE_ID` | The D1 database id printed by `wrangler d1 create`. |

The workflow generates `wrangler.toml` from `wrangler.example.toml` during CI, so no real database id is committed.

### 6. Push to `main`

```bash
git push origin main
```

GitHub Actions will run `.github/workflows/deploy.yml` and deploy the Worker.

## First Login

Open your Worker URL. On first use, the app redirects to `/setup`.

Create the first account:

- Username: any name you want.
- Password: at least 4 characters.

After setup, the app creates a session cookie and redirects to `/`.

## Usage

### Rooms

The URL path is the room name:

| URL | Room |
| --- | --- |
| `/` | `default` |
| `/work` | `work` |
| `/personal` | `personal` |

Open the same room on multiple devices to sync text between them.

### Editor Modes

| Mode | Purpose |
| --- | --- |
| `MD` | Write Markdown as plain text. |
| `TXT` | Write plain text. |
| `Preview` | Render the current content as Markdown. |

### History

Click `History` to open the history panel.

Each history item supports:

| Button | Meaning |
| --- | --- |
| `Top` / `顶` | Pin the item to the top. |
| `Keep` / `留` | Preserve the item from automatic cleanup. |
| `Delete` / `删` | Delete the item. |

The app keeps up to 50 normal history records per room. Pinned or preserved records are not removed by automatic cleanup.

### New Session

Click `New` to start a new history entry. Without this, editing in the same room updates the current history entry instead of creating a new one for every keystroke.

## Configuration Reference

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

Fields:

| Field | Required | Description |
| --- | --- | --- |
| `name` | Yes | Cloudflare Worker name. Change it if you want a different Worker name. |
| `main` | Yes | Worker entry file. Keep `src/index.ts` unless you restructure the project. |
| `compatibility_date` | Yes | Cloudflare Workers runtime compatibility date. Update deliberately and test before deploying. |
| `binding = "DB"` | Yes | The D1 binding name used by the code. If you change it, update `Env.DB` usage in `src/index.ts`. |
| `database_name` | Yes | D1 database name. The README examples use `cf2past-db`. |
| `database_id` | Yes for deploy | Cloudflare D1 database id. Keep real values in local `wrangler.toml` or GitHub Secrets, not in Git. |
| `ROOM` | Yes | Durable Object namespace binding. The code expects `env.ROOM`. |
| `class_name = "Room"` | Yes | Durable Object class exported from `src/room.ts`. |
| `new_sqlite_classes` | Yes on free plan | Registers the Durable Object class with SQLite-backed storage. |

### GitHub Actions Secrets

| Secret | Required | Description |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Yes | Token used by `npx wrangler deploy`. |
| `CLOUDFLARE_ACCOUNT_ID` | Yes | Cloudflare account id for Wrangler. |
| `CLOUDFLARE_D1_DATABASE_ID` | Yes | Injected into `wrangler.toml` during CI. |

### Application Constants

These are defined in source code:

| File | Constant | Default | Meaning |
| --- | --- | --- | --- |
| `src/auth.ts` | `SESSION_DAYS` | `7` | Session cookie lifetime in days. |
| `src/auth.ts` | `PBKDF2_ITERATIONS` | `100000` | Password hashing iteration count. |
| `src/db.ts` | `MAX_HISTORY` | `50` | Number of normal history records kept per room. |

If you change these constants, run type checks and redeploy.

## Database Schema

`schema.sql` creates three tables:

| Table | Purpose |
| --- | --- |
| `users` | Stores usernames and password hashes. |
| `sessions` | Stores session tokens and expiration timestamps. |
| `history` | Stores room history records. |

Indexes:

| Index | Purpose |
| --- | --- |
| `idx_history_room_order` | Fast per-room history ordering. |
| `idx_sessions_expires` | Fast session expiration checks. |

## Local Development

Create a local config first:

```bash
cp wrangler.example.toml wrangler.toml
```

You can use a real D1 database id in `wrangler.toml`, or use local D1 simulation for development.

Initialize local tables:

```bash
npx wrangler d1 execute cf2past-db --local --file=schema.sql
```

Start the development server:

```bash
npm run dev
```

Open the local URL printed by Wrangler, usually `http://127.0.0.1:8787`.

Useful checks:

```bash
npx tsc --noEmit
npx wrangler deploy --dry-run
```

## Migration Notes

This repository includes old migration helper files:

| File | Meaning |
| --- | --- |
| `migrate-v2.sql` | Old history schema with `content_hash`. It drops and recreates `history`. |
| `migrate-v3.sql` | Current history schema without `content_hash`. It also drops and recreates `history`. |

Warning: both migration files drop the `history` table. Do not run them on a database with data you need unless you have exported a backup.

For a fresh install, use only:

```bash
npx wrangler d1 execute cf2past-db --remote --file=schema.sql
```

## Security Notes

- Do not commit `wrangler.toml`; it can contain account-specific resource IDs.
- Do not commit `.dev.vars`, `.env`, API tokens, cookies, or database exports.
- Use GitHub Secrets for CI deployment values.
- Use a Cloudflare API token with the smallest practical permissions.
- Passwords are stored as PBKDF2-SHA256 hashes with random salts.
- Sessions use HttpOnly, Secure, SameSite=Strict cookies.
- This app is intended for personal or trusted-group use, not anonymous public posting.

## Troubleshooting

### `Binding DB is undefined`

Check that `wrangler.toml` exists and contains:

```toml
[[d1_databases]]
binding = "DB"
```

### `Binding ROOM is undefined`

Check that `wrangler.toml` contains:

```toml
[durable_objects]
bindings = [
  { name = "ROOM", class_name = "Room" }
]
```

### First visit does not show `/setup`

Your database may already contain a user. If you are testing locally, remove local Wrangler state or inspect the local D1 database.

### GitHub Actions cannot deploy

Check these secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_D1_DATABASE_ID`

Also check that your Cloudflare API token has permission to edit Workers and D1.

### `wrangler.toml` is missing

Create it from the example:

```bash
cp wrangler.example.toml wrangler.toml
```

Then replace `YOUR_D1_DATABASE_ID` with your real D1 database id.

## License

MIT
