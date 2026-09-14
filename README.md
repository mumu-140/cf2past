# cf2past

A small self-hosted real-time clipboard for your own devices or a small trusted team, built on Cloudflare Workers, Durable Objects, and D1.

English | [简体中文](README.zh-CN.md)

## What it does

- Synchronizes room text between browsers over WebSocket.
- Keeps per-room searchable history in D1.
- Supports pin, preserve, delete, New, and restore operations.
- Provides Markdown preview with Marked + DOMPurify sanitization.
- Uses a framework-free browser UI.
- Requires authentication after first-run setup.

## Architecture

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

The Worker is the HTTP/auth/routing boundary. Each canonical room maps to one Durable Object, which is the authoritative live state owner for that room. D1 stores users, sessions, and history.

Realtime synchronization intentionally uses last-write-wins semantics; cf2past is not a CRDT or collaborative editor.

## Room semantics

A room is exactly one decoded URL path segment:

| URL | Room |
| --- | --- |
| `/` | `default` |
| `/work` | `work` |
| `/%E6%9D%A8%E6%A0%91` | `杨树` |

Nested paths such as `/lab/test` are rejected. Room names may contain Unicode and are limited to 64 Unicode code points.

Room names are identifiers, not authorization boundaries. Any authenticated user can open any valid room name unless you add external access controls.

## Editing and history semantics

Clipboard content is limited to exactly 1 MiB (1,048,576 UTF-8 bytes). Oversized updates are rejected before live state, broadcast state, or D1 history is changed.

Ordinary typing updates the current live room and coalesces history persistence. The room Durable Object remains authoritative across reconnects, including when the authoritative content is the empty string.

`New` is an atomic room operation: the final browser value is persisted as needed, the current history identity is cleared, the live room becomes empty, and connected clients receive the empty state. It does not rely on an unordered WebSocket-send plus separate HTTP reset.

Restoring a history item loads the server-side D1 snapshot into the live room and starts a new editing session. The restored historical row itself is not modified.

Each room retains up to 50 ordinary history rows. Pinned or preserved rows are excluded from automatic ordinary-history cleanup.

## Authentication and sessions

First-run setup creates the first account. New passwords must contain at least 8 characters.

New password hashes use versioned PBKDF2-SHA256 with 600,000 iterations and a random salt. Legacy unversioned 100,000-iteration hashes remain valid; after a successful legacy login, the password hash is transparently upgraded.

New sessions use only the `__Host-cf2past_session` cookie with `HttpOnly`, `Secure`, and `SameSite=Strict`. Existing unexpired legacy `session` cookies remain readable during the migration window, but new legacy cookies are never issued. Sessions expire after 7 days.

## Browser security

Markdown preview follows this path:

```text
text -> Marked -> DOMPurify -> DOM
```

Unsanitized Marked output is never assigned directly to preview HTML. Marked and DOMPurify are loaded from exact-version CDN URLs with Subresource Integrity metadata.

Application scripts run under a per-response nonce-based Content Security Policy. Script execution does not require `unsafe-inline`; DOM event attributes such as `onclick` are not used. State-changing browser requests are same-origin checked.

See [SECURITY.md](SECURITY.md) for the trust model and vulnerability-reporting guidance.

## Quick start

Requirements:

- Cloudflare account
- Node.js 22 or newer
- npm
- Wrangler 4 from this project's dependencies

Clone and install:

```bash
git clone https://github.com/<your-name>/cf2past.git
cd cf2past
npm install
```

Authenticate Wrangler and create D1:

```bash
npx wrangler login
npx wrangler d1 create cf2past-db
```

Copy the example configuration and replace `YOUR_D1_DATABASE_ID` with the generated D1 database id:

```bash
cp wrangler.example.toml wrangler.toml
```

Initialize a new remote database:

```bash
npx wrangler d1 execute cf2past-db --remote --file=schema.sql
```

Deploy:

```bash
npm run deploy
```

Open the Worker URL. A fresh database redirects to `/setup` so you can create the first account.

## GitHub Actions deployment

`.github/workflows/deploy.yml` separates verification from production deployment.

Pull requests run the verification job. Pushes to `main` also run verification, and production deployment runs only after that job succeeds.

Add these repository secrets before using automatic deployment:

| Secret | Purpose |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token used by Wrangler |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account id |
| `CLOUDFLARE_D1_DATABASE_ID` | Real D1 database id injected into `wrangler.toml` |

The deploy job keeps the real database id and Cloudflare credentials out of the repository.

Dependabot is configured for weekly npm and GitHub Actions update checks.

## Local development and verification

Create a local Wrangler config first:

```bash
cp wrangler.example.toml wrangler.toml
```

For local D1 development:

```bash
npx wrangler d1 execute cf2past-db --local --file=schema.sql
npm run dev
```

Before merging or deploying, run:

```bash
npm ci
npm test
npm run typecheck
npm run dry-run
```

The test suite runs in the Cloudflare Workers test environment and covers Worker routing, D1, Durable Object state, authentication migration, room parsing, request limits, Markdown/CSP wiring, and realtime state regressions.

## Database and migrations

`schema.sql` contains the current three-table schema: `users`, `sessions`, and `history`.

This hardening release does not require a D1 schema migration; `schema.sql` is unchanged from `main`.

The repository also contains historical migration helper files `migrate-v2.sql` and `migrate-v3.sql`. They drop and recreate the history table. Do not run them against a database whose history you need to preserve unless you have an appropriate backup and explicitly intend that migration.

For a fresh installation, initialize from `schema.sql` only.

## Operational notes

- Do not commit `wrangler.toml`, `.dev.vars`, `.env`, credentials, cookies, or database exports.
- Clipboard text is server-readable and persisted in D1 history; cf2past does not provide end-to-end encryption.
- Use the smallest practical Cloudflare API-token permissions.
- Keep npm and browser dependencies current and review Dependabot changes before merging.
- If you change the Workers compatibility date, bindings, or runtime dependencies, rerun the full verification commands before deployment.

## License

MIT
