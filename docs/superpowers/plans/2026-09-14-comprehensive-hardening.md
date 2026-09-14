# cf2past Comprehensive Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden cf2past without changing its Cloudflare Workers + Durable Objects + D1 architecture, making realtime state deterministic, history persistence reliable, Markdown safe, authentication upgradeable, and CI verification mandatory before deployment.

**Architecture:** The Worker remains the HTTP/auth/routing boundary, one Durable Object remains the authoritative live state owner for each canonical room, and D1 remains durable storage for users/sessions/history. The implementation adds small testable helpers for room parsing, HTTP security, and password hashing; moves New/restore semantics into atomic DO operations; coalesces history writes with DO alarms; and keeps the frontend framework-free.

**Tech Stack:** TypeScript 5.9+, Cloudflare Workers, Durable Objects with WebSocket Hibernation and alarms, D1, Wrangler 4, Vitest 4.1+, `@cloudflare/vitest-plugin` 1.x, browser Marked 18.0.12 + DOMPurify 3.4.15 loaded from exact-version CDN URLs with SRI.

**Spec:** `docs/superpowers/specs/2026-09-14-comprehensive-hardening-design.md`

## Global Constraints

- Keep Cloudflare Workers, Durable Objects, D1, and the current framework-free frontend.
- Do not add React/Vue/Svelte, Redis/KV coordination, CRDT/OT, file transfer, room ACLs, or a new backend service.
- Do not add or modify the D1 schema unless implementation proves it unavoidable; if that happens, stop and treat it as a design change.
- A room is exactly one decoded URL path segment; `/` maps to `default`; nested room paths are rejected.
- Room names are limited to 64 Unicode code points.
- Clipboard content is limited to 1 MiB measured in UTF-8 bytes.
- Realtime synchronization remains last-write-wins.
- New password hashes are PBKDF2-SHA256 with 600,000 iterations; legacy unversioned 100,000-iteration hashes must remain valid and upgrade after successful login.
- New sessions use only `__Host-cf2past_session`; legacy `session` cookies are read only while their already-issued D1 sessions remain unexpired.
- Browser scripts must run under nonce-based CSP with no `unsafe-inline` in `script-src`; existing inline `onclick` handlers must be removed.
- Markdown rendering is `text -> Marked -> DOMPurify -> DOM`; unsanitized Marked output must never be assigned to `innerHTML`.
- Use exact-version Marked 18.0.12 and DOMPurify 3.4.15 browser dependencies with SRI unless local vendoring can be done without a frontend build subsystem.
- CI must run tests, TypeScript checking, and Wrangler dry-run before production deployment.
- Use Cloudflare's current `@cloudflare/vitest-plugin`, not deprecated `@cloudflare/vitest-pool-workers`.

---

## File Structure

### New files

- `src/rooms.ts` — canonical room parsing/validation and path-segment decoding.
- `src/http.ts` — nonce generation, security headers, HTML/JSON response helpers, same-origin enforcement, and UTF-8 byte-limit helper.
- `src/password.ts` — versioned PBKDF2 hashing, legacy parsing, constant-time comparison, and rehash decision.
- `vitest.config.ts` — Workers-runtime Vitest configuration using `@cloudflare/vitest-plugin`.
- `test/env.d.ts` — test binding types.
- `test/tsconfig.json` — test-only ambient types.
- `test/setup.ts` — initialize the isolated D1 database from `schema.sql` for each test file.
- `test/rooms.test.ts` — canonical room regression tests.
- `test/http.test.ts` — same-origin/security/size helper tests.
- `test/password.test.ts` — legacy and current hash tests.
- `test/db.test.ts` — stale entry ID, literal LIKE search, and mutation-result tests.
- `test/room.test.ts` — Durable Object state, New, restore, alarm, empty state, and oversized-message tests.
- `test/worker.test.ts` — authenticated HTTP routing, room errors, origin checks, cookie/logout, and API validation tests.
- `test/pages.test.ts` — CSP-compatible page-source and Markdown-sanitization wiring tests.
- `.github/dependabot.yml` — npm/GitHub Actions dependency updates.
- `SECURITY.md` — deployment/security assumptions and vulnerability reporting guidance.

### Modified files

- `src/index.ts` — compose canonical routing, authentication, same-origin checks, DO actions, history endpoints, logout, and response security headers.
- `src/room.ts` — authoritative room state, dirty persistence state, alarm-based coalescing, atomic New/restore, strict size checks, and always-send-initial-state behavior.
- `src/db.ts` — UPDATE-zero fallback INSERT, literal LIKE escaping, history item lookup, explicit mutation results.
- `src/auth.ts` — new cookie name, legacy-cookie read compatibility, password rehash, logout/session deletion, session cleanup, 8-character setup minimum.
- `src/pages.ts` — nonce-aware pages, safe room interpolation, exact-version Marked + DOMPurify, no inline event handlers, bounded reconnect, atomic New/restore calls, and error handling.
- `package.json` / `package-lock.json` — Wrangler 4, Vitest 4.1+, `@cloudflare/vitest-plugin`, TypeScript/current Workers types, test/check scripts.
- `tsconfig.json` — keep strict mode and include shared source only; test types stay isolated in `test/tsconfig.json`.
- `wrangler.example.toml` — tested 2026 compatibility date while preserving D1 and DO bindings/migration.
- `.github/workflows/deploy.yml` — verification job on PR/push and deploy job only on verified `main`.
- `README.md`, `README.zh-CN.md` — upgrade, security, synchronization, room semantics, limits, and local verification commands.

---

### Task 1: Upgrade the toolchain and establish the Workers-runtime test harness

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `wrangler.example.toml`
- Create: `vitest.config.ts`
- Create: `test/env.d.ts`
- Create: `test/tsconfig.json`
- Create: `test/setup.ts`
- Test: `test/rooms.test.ts` initially serves as the smoke test

**Interfaces:**
- Consumes: existing `Env` bindings `DB` and `ROOM` from `src/index.ts`.
- Produces: `npm test`, `npm run check`, and a Workers-runtime test environment where `env.DB` and `env.ROOM` are available.

- [ ] **Step 1: Update dev dependencies and scripts**

Run:

```bash
npm install -D wrangler@^4 @cloudflare/workers-types@latest typescript@^5.9 vitest@^4.1.0 @cloudflare/vitest-plugin@^1.0.0
```

Set scripts in `package.json` to:

```json
{
  "scripts": {
    "dev": "wrangler dev",
    "test": "vitest run",
    "test:watch": "vitest",
    "check": "tsc --noEmit && vitest run",
    "dry-run": "wrangler deploy --dry-run",
    "deploy": "wrangler deploy",
    "db:init": "wrangler d1 execute cf2past-db --file=schema.sql"
  }
}
```

Expected: `package-lock.json` is regenerated by npm and Wrangler resolves to v4.

- [ ] **Step 2: Advance the compatibility date without changing bindings**

Change only:

```toml
compatibility_date = "2026-09-01"
```

Keep the existing `DB`, `ROOM`, and `[[migrations]] tag = "v1"` configuration unchanged.

- [ ] **Step 3: Create the Vitest Workers configuration**

Create `vitest.config.ts`:

```ts
import { readFileSync } from 'node:fs';
import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.example.toml' },
      miniflare: {
        d1Databases: { DB: '00000000-0000-0000-0000-000000000001' },
        bindings: { TEST_SCHEMA: schema },
      },
    }),
  ],
  test: {
    setupFiles: ['./test/setup.ts'],
  },
});
```

- [ ] **Step 4: Add test ambient types**

Create `test/env.d.ts`:

```ts
import type { Env } from '../src/index';

declare module 'cloudflare:workers' {
  interface ProvidedEnv extends Env {
    TEST_SCHEMA: string;
  }
}
```

Create `test/tsconfig.json`:

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "types": ["@cloudflare/workers-types", "@cloudflare/vitest-plugin/types"]
  },
  "include": ["./**/*.ts", "../src/**/*.ts"]
}
```

- [ ] **Step 5: Initialize isolated D1 storage for tests**

Create `test/setup.ts`:

```ts
import { env } from 'cloudflare:workers';
import { beforeEach } from 'vitest';

beforeEach(async () => {
  await env.DB.exec('DROP TABLE IF EXISTS sessions; DROP TABLE IF EXISTS users; DROP TABLE IF EXISTS history;');
  await env.DB.exec(env.TEST_SCHEMA);
});
```

If D1 rejects multi-statement DROP in one `exec`, split the three DROP statements into three `exec()` calls; do not change production schema.

- [ ] **Step 6: Add a failing smoke test proving the harness is active**

Create `test/rooms.test.ts` temporarily with:

```ts
import { env } from 'cloudflare:workers';
import { expect, it } from 'vitest';

it('provides D1 and Durable Object bindings', async () => {
  const row = await env.DB.prepare('SELECT COUNT(*) AS c FROM users').first<{ c: number }>();
  expect(row?.c).toBe(0);
  expect(env.ROOM.idFromName('smoke').toString()).toBeTruthy();
});
```

- [ ] **Step 7: Run the harness**

Run:

```bash
npm test
npm run check
npm run dry-run
```

Expected: smoke test PASS, TypeScript PASS, Wrangler v4 dry-run PASS.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json wrangler.example.toml vitest.config.ts test/env.d.ts test/tsconfig.json test/setup.ts test/rooms.test.ts
git commit -m "test: add Workers runtime harness"
```

---

### Task 2: Canonical room parsing, same-origin enforcement, and response security helpers

**Files:**
- Create: `src/rooms.ts`
- Create: `src/http.ts`
- Replace smoke test with: `test/rooms.test.ts`
- Create: `test/http.test.ts`

**Interfaces:**
- Produces: `parsePageRoom(pathname: string): string | null`, `parseApiRoom(rawSegment: string): string | null`, `MAX_ROOM_CODE_POINTS`, `MAX_CONTENT_BYTES`, `utf8Size(value: string): number`, `isSameOrigin(request: Request): boolean`, `createNonce(): string`, `securityHeaders(nonce: string): Headers`.
- Later tasks consume these helpers from `src/index.ts`, `src/auth.ts`, and `src/pages.ts`.

- [ ] **Step 1: Write failing room tests**

Use:

```ts
import { describe, expect, it } from 'vitest';
import { parseApiRoom, parsePageRoom } from '../src/rooms';

describe('room parsing', () => {
  it('maps root to default', () => expect(parsePageRoom('/')).toBe('default'));
  it('accepts one decoded unicode segment', () => expect(parsePageRoom('/%E6%9D%A8%E6%A0%91')).toBe('杨树'));
  it('rejects nested paths', () => expect(parsePageRoom('/lab/test')).toBeNull());
  it('rejects malformed escapes', () => expect(parsePageRoom('/%ZZ')).toBeNull());
  it('rejects more than 64 code points', () => expect(parsePageRoom('/' + 'a'.repeat(65))).toBeNull());
  it('decodes API path segments exactly once', () => expect(parseApiRoom('%E6%9D%A8%E6%A0%91')).toBe('杨树'));
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npx vitest run test/rooms.test.ts
```

Expected: FAIL because `src/rooms.ts` does not exist.

- [ ] **Step 3: Implement room parsing**

Create `src/rooms.ts` with these semantics:

```ts
export const MAX_ROOM_CODE_POINTS = 64;

function validRoom(room: string): string | null {
  if (!room || room === '.' || room === '..') return null;
  if ([...room].length > MAX_ROOM_CODE_POINTS) return null;
  if (room.includes('/') || room.includes('\0')) return null;
  return room;
}

export function parseApiRoom(rawSegment: string): string | null {
  try {
    return validRoom(decodeURIComponent(rawSegment));
  } catch {
    return null;
  }
}

export function parsePageRoom(pathname: string): string | null {
  if (pathname === '/') return 'default';
  if (!pathname.startsWith('/')) return null;
  const raw = pathname.slice(1);
  if (!raw || raw.includes('/')) return null;
  return parseApiRoom(raw);
}
```

- [ ] **Step 4: Write failing HTTP helper tests**

Create `test/http.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isSameOrigin, MAX_CONTENT_BYTES, utf8Size } from '../src/http';

describe('request security helpers', () => {
  it('accepts a matching Origin', () => {
    const req = new Request('https://clip.example/api/new/x', { headers: { Origin: 'https://clip.example' } });
    expect(isSameOrigin(req)).toBe(true);
  });

  it('rejects a different Origin', () => {
    const req = new Request('https://clip.example/api/new/x', { headers: { Origin: 'https://evil.example' } });
    expect(isSameOrigin(req)).toBe(false);
  });

  it('counts UTF-8 bytes rather than UTF-16 code units', () => {
    expect(utf8Size('杨')).toBe(3);
    expect(utf8Size('a'.repeat(MAX_CONTENT_BYTES))).toBe(MAX_CONTENT_BYTES);
  });
});
```

- [ ] **Step 5: Implement HTTP helpers**

Create `src/http.ts`:

```ts
export const MAX_CONTENT_BYTES = 1024 * 1024;

export function utf8Size(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin');
  if (!origin) return false;
  return origin === new URL(request.url).origin;
}

export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes));
}

export function securityHeaders(nonce: string): Headers {
  const headers = new Headers({
    'Content-Security-Policy': [
      "default-src 'none'",
      `script-src 'nonce-${nonce}' https://cdn.jsdelivr.net`,
      "style-src 'unsafe-inline'",
      "img-src 'self' data: https:",
      "connect-src 'self' ws: wss:",
      "form-action 'self'",
      "base-uri 'none'",
      "object-src 'none'",
      "frame-ancestors 'none'",
    ].join('; '),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  });
  return headers;
}
```

`isSameOrigin()` is intentionally strict for browser state changes; GET navigation is not passed through it.

- [ ] **Step 6: Run tests**

```bash
npx vitest run test/rooms.test.ts test/http.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/rooms.ts src/http.ts test/rooms.test.ts test/http.test.ts
git commit -m "feat: canonicalize rooms and request security"
```

---

### Task 3: Make D1 history operations recoverable and searches literal

**Files:**
- Modify: `src/db.ts`
- Create: `test/db.test.ts`

**Interfaces:**
- Produces: `saveHistory(...): Promise<number>`, `escapeLike(value: string): string`, `getHistoryItem(db, id, room): Promise<HistoryItem | null>`, `deleteHistory(...): Promise<boolean>`, `togglePin(...): Promise<boolean>`, `togglePreserve(...): Promise<boolean>`.
- `saveHistory` returns a replacement row ID when an UPDATE targets a stale/deleted row.

- [ ] **Step 1: Write the stale-entry and literal-search regression tests**

Create tests that insert a user and a history row, delete that row, then call `saveHistory` using the deleted ID:

```ts
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { getHistory, saveHistory } from '../src/db';

async function createUser(): Promise<number> {
  const result = await env.DB.prepare(
    "INSERT INTO users (username, password_hash) VALUES ('u', 'x')"
  ).run();
  return result.meta.last_row_id as number;
}

it('falls back to INSERT when current entry id is stale', async () => {
  const userId = await createUser();
  const first = await saveHistory(env.DB, 'r', 'first', userId, null);
  await env.DB.prepare('DELETE FROM history WHERE id = ?').bind(first).run();
  const replacement = await saveHistory(env.DB, 'r', 'second', userId, first);
  expect(replacement).not.toBe(first);
  const row = await env.DB.prepare('SELECT content FROM history WHERE id = ?').bind(replacement).first<{ content: string }>();
  expect(row?.content).toBe('second');
});

it('treats percent and underscore literally in search', async () => {
  const userId = await createUser();
  await saveHistory(env.DB, 'r', '100%_done', userId, null);
  await saveHistory(env.DB, 'r', '100xxdone', userId, null);
  expect((await getHistory(env.DB, 'r', '%_')).map(x => x.content)).toEqual(['100%_done']);
});
```

- [ ] **Step 2: Verify the stale-entry test fails against current code**

```bash
npx vitest run test/db.test.ts
```

Expected: FAIL because current `saveHistory` returns the deleted ID after a zero-row UPDATE and current LIKE search treats `%`/`_` as wildcards.

- [ ] **Step 3: Implement UPDATE-zero fallback**

Change the UPDATE branch to inspect D1 metadata:

```ts
const result = await db.prepare(
  "UPDATE history SET content = ?, updated_at = datetime('now') WHERE id = ? AND room = ?"
).bind(content, entryId, room).run();

if ((result.meta.changes ?? 0) > 0) return entryId;
```

Then fall through to the existing INSERT path rather than returning the stale ID.

- [ ] **Step 4: Implement literal LIKE escaping**

Add:

```ts
export function escapeLike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}
```

Use:

```sql
content LIKE ? ESCAPE '\'
```

with `bind(room, `%${escapeLike(query)}%`)`.

- [ ] **Step 5: Add explicit lookup/mutation results**

Implement:

```ts
export async function getHistoryItem(db: D1Database, id: number, room: string): Promise<HistoryItem | null> {
  return await db.prepare('SELECT * FROM history WHERE id = ? AND room = ?').bind(id, room).first<HistoryItem>();
}
```

For delete/pin/preserve, return `(result.meta.changes ?? 0) > 0` instead of `void`. Add tests proving nonexistent IDs return `false`.

- [ ] **Step 6: Run DB tests**

```bash
npx vitest run test/db.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/db.ts test/db.test.ts
git commit -m "fix: recover stale history entries"
```

---

### Task 4: Version password hashes and migrate sessions without breaking existing users

**Files:**
- Create: `src/password.ts`
- Modify: `src/auth.ts`
- Create: `test/password.test.ts`
- Extend: `test/worker.test.ts` later for full login/logout behavior

**Interfaces:**
- Produces: `hashPassword(password): Promise<string>`, `verifyPassword(password, stored): Promise<{ valid: boolean; needsRehash: boolean }>`.
- `auth.ts` continues to produce `validateSession`, `handleAuth`, and adds `logout(request, env): Promise<Response>`.

- [ ] **Step 1: Write password-format tests**

Create `test/password.test.ts`:

```ts
import { expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/password';

it('creates versioned 600k PBKDF2 hashes', async () => {
  const stored = await hashPassword('correct horse battery staple');
  expect(stored).toMatch(/^pbkdf2-sha256\$600000\$[0-9a-f]+\$[0-9a-f]+$/);
  expect(await verifyPassword('correct horse battery staple', stored)).toEqual({ valid: true, needsRehash: false });
});

it('rejects a wrong password', async () => {
  const stored = await hashPassword('right password');
  expect((await verifyPassword('wrong password', stored)).valid).toBe(false);
});
```

Add a deterministic legacy fixture generated with 100,000 PBKDF2-SHA256 iterations and assert `valid: true, needsRehash: true`.

- [ ] **Step 2: Verify tests fail before implementation**

```bash
npx vitest run test/password.test.ts
```

Expected: FAIL because `src/password.ts` does not exist.

- [ ] **Step 3: Implement versioned hashing and constant-time comparison**

Use format:

```text
pbkdf2-sha256$600000$<saltHex>$<hashHex>
```

Legacy format remains:

```text
<saltHex>:<hashHex>
```

Implement parsing without non-null assertions; malformed stored hashes must return `{ valid: false, needsRehash: false }`. Compare computed and expected bytes using a full-length XOR accumulator rather than early-return string comparison.

- [ ] **Step 4: Update setup/login to use the password module**

In `src/auth.ts`:

- Remove the in-file PBKDF2 implementation.
- Require `password.length >= 8` during setup.
- On login, call `verifyPassword`.
- If `valid && needsRehash`, update `users.password_hash` with `await hashPassword(password)` before issuing the session.

- [ ] **Step 5: Migrate cookie handling**

Use constants:

```ts
const SESSION_COOKIE = '__Host-cf2past_session';
const LEGACY_SESSION_COOKIE = 'session';
```

`validateSession` checks the new cookie first and then the legacy cookie. New sessions set only:

```text
__Host-cf2past_session=<token>; Path=/; HttpOnly; Secure; SameSite=Strict; Expires=<...>
```

No Domain attribute is allowed on a `__Host-` cookie.

- [ ] **Step 6: Add logout and cleanup helpers**

Implement `deleteSession(token)` and opportunistic cleanup:

```sql
DELETE FROM sessions WHERE expires_at <= datetime('now')
```

Cleanup failure must be caught and ignored after logging; authentication success/failure must not depend on cleanup.

`logout` deletes the active session token if present and returns a response that expires both cookie names:

```text
__Host-cf2past_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0
session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0
```

- [ ] **Step 7: Run password tests and TypeScript**

```bash
npx vitest run test/password.test.ts
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/password.ts src/auth.ts test/password.test.ts
git commit -m "feat: migrate password and session security"
```

---

### Task 5: Make the Durable Object the authoritative realtime state machine

**Files:**
- Modify: `src/room.ts`
- Create: `test/room.test.ts`

**Interfaces:**
- Consumes: `saveHistory`, `MAX_CONTENT_BYTES`, `utf8Size`.
- Produces DO HTTP actions:
  - `POST ?action=new` with JSON `{ room: string; userId: number; content: string }`.
  - `POST ?action=restore` with JSON `{ room: string; userId: number; content: string }`.
  - WebSocket upgrade with tags `uid:<id>` and `room:<canonical-room>`.
- Produces `alarm(): Promise<void>` for coalesced D1 persistence.

- [ ] **Step 1: Write DO tests for empty initial state and New**

Use the real `env.ROOM` binding plus `runInDurableObject` / `runDurableObjectAlarm` from `cloudflare:test`.

Test storage after initialization:

```ts
import { env } from 'cloudflare:workers';
import { runInDurableObject, runDurableObjectAlarm } from 'cloudflare:test';
import { expect, it } from 'vitest';
import { Room } from '../src/room';

it('stores an explicit empty current state', async () => {
  const stub = env.ROOM.get(env.ROOM.idFromName('empty-state'));
  await runInDurableObject(stub, async (_instance: Room, state) => {
    expect((await state.storage.get<string>('content')) ?? '').toBe('');
  });
});
```

Add a New test that seeds `content='final text'`, `entryId=null`, dirty metadata, invokes `action=new`, then asserts history contains `final text`, DO content is `''`, entryId is absent/null, and dirty is false.

- [ ] **Step 2: Write restore and alarm tests**

Regression assertions:

- `restore` first flushes the current dirty content.
- restored content becomes live state.
- `currentEntryId` is cleared before restored content becomes dirty, so the restored historical row is never reused.
- `runDurableObjectAlarm(stub)` persists restored content as a new row.

- [ ] **Step 3: Write stale-entry and retry tests through the DO**

Seed `entryId` to a real row, delete it from D1, edit again, run the alarm, and assert DO storage now contains the replacement row ID returned by `saveHistory`.

For retry semantics, make `flushHistory` leave `dirty=true` until the D1 operation succeeds. The unit boundary can be tested through a small internal method invoked via `runInDurableObject`; do not clear dirty state in a `finally` block.

- [ ] **Step 4: Implement persisted DO fields**

Persist these keys:

```ts
content: string
entryId: number | null (store 0 or delete key for null, but normalize on load)
dirty: boolean
pendingUserId: number
room: string
```

Use `blockConcurrencyWhile` to restore all five fields. Empty string is valid state; use `??`, not `||`, when restoring.

- [ ] **Step 5: Implement `flushHistory()`**

Semantics:

```ts
private async flushHistory(): Promise<void> {
  if (!this.dirty) return;
  if (!this.currentContent.trim() || !this.pendingUserId) {
    this.dirty = false;
    await this.state.storage.put('dirty', false);
    return;
  }

  const newId = await saveHistory(
    this.env.DB,
    this.room,
    this.currentContent,
    this.pendingUserId,
    this.currentEntryId,
  );

  this.currentEntryId = newId || null;
  this.dirty = false;
  await this.state.storage.put({ entryId: newId || 0, dirty: false });
}
```

On thrown D1 error, do not mutate `entryId` or `dirty`; schedule another alarm before rethrowing or returning.

- [ ] **Step 6: Implement coalesced persistence**

On valid string WebSocket edits:

1. Reject if `utf8Size(message) > MAX_CONTENT_BYTES`; close the sender with code `1009` and do not mutate state.
2. Update `currentContent`, `dirty`, `pendingUserId`, and `room`.
3. Persist those values to DO storage.
4. Broadcast to every other socket.
5. Set/reset an alarm roughly 750 ms in the future.

Implement:

```ts
async alarm(): Promise<void> {
  try {
    await this.flushHistory();
  } catch {
    await this.state.storage.setAlarm(Date.now() + 2000);
  }
}
```

- [ ] **Step 7: Implement atomic New**

`action=new` reads `{ room, userId, content }` and validates content size again inside the DO. It sets live content to the supplied final browser value, marks it dirty with the supplied user/room, flushes it, then atomically resets:

```ts
this.currentEntryId = null;
this.currentContent = '';
this.dirty = false;
```

Persist the reset and broadcast `''` to **all** connected sockets, including the initiator.

This is what removes reliance on ordering between `ws.send(finalText)` and a separate HTTP request.

- [ ] **Step 8: Implement atomic restore**

`action=restore` first calls `flushHistory()`, then sets `currentEntryId=null`, loads supplied content as the live state, marks it dirty under the authenticated user, persists it, broadcasts it, and schedules an alarm. It must not point `currentEntryId` at the row being restored.

- [ ] **Step 9: Always send current state on WebSocket connect**

Replace the truthy check with unconditional send:

```ts
server.send(this.currentContent);
```

This makes an empty server state authoritative after reconnect.

- [ ] **Step 10: Run DO tests**

```bash
npx vitest run test/room.test.ts test/db.test.ts
```

Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add src/room.ts test/room.test.ts
git commit -m "feat: make room state atomic and durable"
```

---

### Task 6: Harden Worker routing and authenticated APIs

**Files:**
- Modify: `src/index.ts`
- Modify: `src/auth.ts` only if response composition requires exported cookie/session helpers
- Create: `test/worker.test.ts`

**Interfaces:**
- Consumes: `parsePageRoom`, `parseApiRoom`, `isSameOrigin`, `securityHeaders`, `createNonce`, `MAX_CONTENT_BYTES`, `utf8Size`, `getHistoryItem`, explicit DB mutation booleans, `logout`.
- Produces stable HTTP status behavior and passes only canonical/authenticated data into the DO.

- [ ] **Step 1: Write routing/origin failure tests**

Tests must prove:

- `/lab/test` returns 404 or 400 and never renders a room.
- malformed room encoding is rejected.
- POST `/api/new/<room>` with a cross-origin `Origin` returns 403.
- PATCH/DELETE history and POST restore/logout reject cross-origin requests.
- WebSocket upgrade with a mismatched Origin returns 403 before reaching the DO.
- malformed history ID returns 400; missing valid ID returns 404.

- [ ] **Step 2: Write authenticated New/restore tests**

Seed a user/session directly in D1, send the new cookie, and POST:

```json
{ "content": "final local text" }
```

to `/api/new/<encoded-room>`. Assert 200 and later history contains the final content.

For restore, create a history item and POST `/api/restore/<room>/<id>`; assert the DO live content becomes that row's content.

- [ ] **Step 3: Add deterministic API parsers in `index.ts`**

Do not route APIs with broad `startsWith` + arbitrary slicing. Match explicit prefixes and ensure exactly the expected number of path segments. Decode the room with `parseApiRoom()` once.

For page routes use `parsePageRoom(path)` and reject null before calling `mainPage`.

- [ ] **Step 4: Enforce same-origin state changes**

Before New, restore, history DELETE/PATCH, logout, and WebSocket forwarding:

```ts
if (!isSameOrigin(request)) {
  return Response.json({ error: 'forbidden' }, { status: 403 });
}
```

Do not apply this check to ordinary GET page navigation or GET history.

- [ ] **Step 5: Forward atomic New data to the DO**

Read JSON `{ content }`, require `typeof content === 'string'`, enforce the 1 MiB limit, then forward a server-created JSON body containing canonical `room`, authenticated `user.id`, and content. The browser must not choose `userId`.

- [ ] **Step 6: Implement restore-by-history-ID**

Worker flow:

1. Validate room/id/origin/session.
2. `getHistoryItem(env.DB, id, room)`.
3. Return 404 if absent.
4. Send its `content`, canonical room, and authenticated user ID to DO `action=restore`.

This prevents client tampering with restored history content.

- [ ] **Step 7: Return explicit history mutation errors**

`deleteHistory`, `togglePin`, and `togglePreserve` returning `false` maps to 404. Unknown PATCH action maps to 400.

- [ ] **Step 8: Add logout route**

`POST /logout` validates same-origin, calls `logout`, and returns/redirects to `/login` after clearing both cookie names.

- [ ] **Step 9: Apply security headers to HTML responses**

Generate one nonce per HTML response. Call:

```ts
mainPage(room, nonce)
loginPage(error, nonce)
setupPage(error, nonce)
```

Merge `securityHeaders(nonce)` with `Content-Type: text/html; charset=utf-8`.

JSON APIs may use a smaller fixed defensive-header set; they do not need a script nonce.

- [ ] **Step 10: Run worker tests**

```bash
npx vitest run test/worker.test.ts test/rooms.test.ts test/http.test.ts
```

Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add src/index.ts src/auth.ts test/worker.test.ts
git commit -m "feat: harden worker API boundaries"
```

---

### Task 7: Make the browser CSP-compatible and sanitize Markdown

**Files:**
- Modify: `src/pages.ts`
- Create: `test/pages.test.ts`

**Interfaces:**
- Consumes nonce and canonical room from `index.ts`.
- Page functions become `loginPage(error: string | undefined, nonce: string)`, `setupPage(error: string | undefined, nonce: string)`, `mainPage(room: string, nonce: string)`.
- Browser calls New/restore/history APIs with `encodeURIComponent(room)` and treats server WebSocket state as authoritative.

- [ ] **Step 1: Write page-source security tests**

Create assertions that generated HTML:

- contains no `onclick=` / `oninput=` / other inline handler attributes;
- places `nonce="<nonce>"` on every inline application script;
- loads exact-version `marked@18.0.12` and `dompurify@3.4.15` URLs;
- contains SRI `integrity="sha384-..."` values copied from the exact fetched artifacts during implementation;
- does not contain `preview.innerHTML=marked.parse` or equivalent unsanitized assignment;
- serializes a hostile room such as `'</script><script>alert(1)</script>` as data rather than executable markup.

Example:

```ts
const html = mainPage("x'</script><script>alert(1)</script>", 'test-nonce');
expect(html).not.toContain('onclick=');
expect(html).toContain('nonce="test-nonce"');
expect(html).not.toContain('preview.innerHTML=marked.parse');
expect(html).not.toContain("const room='x'</script>");
```

- [ ] **Step 2: Verify tests fail against current `pages.ts`**

```bash
npx vitest run test/pages.test.ts
```

Expected: FAIL because current code has inline `onclick`, unpinned Marked, direct unsanitized `innerHTML`, and unsafe room interpolation.

- [ ] **Step 3: Make login/setup scripts nonce-aware**

Change page signatures to accept nonce. Add `nonce="${nonce}"` to the theme bootstrap script. Update setup text and `minlength` from 4 to 8.

Escape any rendered error text using a server-side HTML escape helper inside `pages.ts`.

- [ ] **Step 4: Pin Marked and DOMPurify with SRI**

Use exact CDN artifact URLs, for example:

```html
<script src="https://cdn.jsdelivr.net/npm/marked@18.0.12/lib/marked.umd.js" integrity="sha384-<computed>" crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/dompurify@3.4.15/dist/purify.min.js" integrity="sha384-<computed>" crossorigin="anonymous"></script>
```

During implementation, download these two exact files once, compute SHA-384 locally (`openssl dgst -sha384 -binary | openssl base64 -A`), and paste the resulting values. Do not guess the integrity strings.

- [ ] **Step 5: Add one safe Markdown render function**

All preview updates call exactly one function:

```js
function renderPreview(text) {
  const parsed = marked.parse(text || '');
  preview.innerHTML = DOMPurify.sanitize(parsed, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['style'],
  });
}
```

There must be no other assignment of Marked output to `innerHTML`.

- [ ] **Step 6: Remove inline event handlers**

Give toolbar/buttons stable IDs or `data-action` attributes and attach behavior from the nonce-bearing application script with `addEventListener`. History item actions use event delegation on `#list` with `data-action` / `data-id`; content remains HTML-escaped.

- [ ] **Step 7: Serialize room safely**

For text HTML positions use HTML escaping. For JavaScript data use:

```ts
const roomJson = JSON.stringify(room).replace(/</g, '\\u003c');
```

Then emit:

```js
const room = ${roomJson};
const roomPath = encodeURIComponent(room);
```

- [ ] **Step 8: Fix realtime client semantics**

Remove the `remote` / `remoteTimer` suppression flag. Programmatically assigning `textarea.value` does not fire an `input` event, so suppressing input is unnecessary and can swallow real local typing near a remote update.

Input remains debounced before WebSocket send, but New no longer sends over WebSocket first. New posts the current editor content directly:

```js
await fetch('/api/new/' + roomPath, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ content: editor.value }),
});
```

Wait for the server/DO broadcast to clear the editor; do not locally pretend success before a successful HTTP response.

- [ ] **Step 9: Move restore to the atomic HTTP endpoint**

History DOM elements carry only row IDs for restoration. `restore(id)` POSTs `/api/restore/<room>/<id>`; the Worker loads trusted history content and the DO broadcasts the restored state. Do not send restored content over WebSocket directly.

- [ ] **Step 10: Bound reconnect attempts**

Use exponential backoff with jitter, reset on successful open:

```js
let reconnectAttempt = 0;
function scheduleReconnect() {
  const base = Math.min(10000, 500 * 2 ** reconnectAttempt++);
  const jitter = Math.floor(Math.random() * 250);
  setTimeout(connect, base + jitter);
}
```

On `open`, set `reconnectAttempt = 0`. Avoid creating more than one outstanding reconnect timer.

- [ ] **Step 11: Treat first server message as authoritative**

Every WebSocket message, including `''`, updates editor state and preview. Preserve selection only within the new string length. Do not ignore empty messages.

- [ ] **Step 12: Add logout UI without expanding the redesign**

Add one small header button that POSTs `/logout` then redirects to `/login` on success. Keep existing visual structure otherwise.

- [ ] **Step 13: Run page tests**

```bash
npx vitest run test/pages.test.ts
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 14: Commit**

```bash
git add src/pages.ts test/pages.test.ts
git commit -m "fix: sanitize preview and harden client sync"
```

---

### Task 8: Add CI gates, dependency automation, and operational documentation

**Files:**
- Modify: `.github/workflows/deploy.yml`
- Create: `.github/dependabot.yml`
- Create: `SECURITY.md`
- Modify: `README.md`
- Modify: `README.zh-CN.md`

**Interfaces:**
- Produces a required verification workflow shape: verify on PR/push; deploy only on `main` after verify.

- [ ] **Step 1: Split verification and deployment jobs**

Change workflow triggers to:

```yaml
on:
  pull_request:
  push:
    branches: [main]
```

Create `verify` job:

```yaml
verify:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: npm
    - run: npm ci
    - run: npm test
    - run: npm run check
    - name: Generate Wrangler config
      run: sed 's/YOUR_D1_DATABASE_ID/00000000-0000-0000-0000-000000000001/' wrangler.example.toml > wrangler.toml
    - run: npm run dry-run
```

The dry-run must not require production Cloudflare secrets.

- [ ] **Step 2: Gate production deployment on verification**

Use:

```yaml
deploy:
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  needs: verify
  runs-on: ubuntu-latest
```

Then retain the existing secret validation, real database-ID substitution, and `wrangler deploy` steps.

- [ ] **Step 3: Add Dependabot**

Create `.github/dependabot.yml` with weekly npm and GitHub Actions checks and a small open-PR limit, e.g. 5 per ecosystem.

- [ ] **Step 4: Add `SECURITY.md`**

Document the actual security model:

- intended for personal/small trusted-team self-hosting;
- authenticated users can access any room by name unless external access controls are added;
- clipboard text is server-readable and stored in D1 history;
- Markdown is sanitized but users should keep dependencies current;
- report vulnerabilities privately through GitHub's security-reporting channel if enabled, otherwise repository contact guidance without publishing secrets.

- [ ] **Step 5: Update both READMEs**

Document exactly:

- one-segment room semantics and Unicode support;
- 1 MiB text limit;
- last-write-wins behavior;
- atomic New and restore semantics;
- history retention and pin/preserve behavior;
- 8-character password minimum and transparent legacy hash upgrade;
- new `__Host-cf2past_session` cookie with temporary legacy-cookie read compatibility;
- Markdown sanitization and CSP;
- no new D1 migration required for this hardening release;
- local verification commands `npm test`, `npm run check`, `npm run dry-run`;
- Wrangler 4 requirement.

- [ ] **Step 6: Run YAML and project verification**

Run:

```bash
npm test
npm run check
npm run dry-run
```

Also parse workflow/dependabot YAML with an available YAML parser if present; otherwise rely on GitHub Actions validation after push and inspect the run.

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/deploy.yml .github/dependabot.yml SECURITY.md README.md README.zh-CN.md
git commit -m "ci: gate deploy behind hardening checks"
```

---

### Task 9: Full regression verification, PR review, and merge readiness

**Files:**
- No planned production-code additions.
- Modify only files required by failures discovered during verification.

**Interfaces:**
- Validates every acceptance criterion from the approved spec.

- [ ] **Step 1: Run the full local suite from a clean install**

```bash
rm -rf node_modules
npm ci
npm test
npm run check
npm run dry-run
```

Expected: all commands exit 0.

- [ ] **Step 2: Run targeted security/source assertions**

```bash
npm test -- test/pages.test.ts test/http.test.ts test/password.test.ts
```

Expected: no inline event handlers, nonce scripts present, exact pinned dependencies present, unsafe Marked assignment absent, origin and cookie/hash tests PASS.

- [ ] **Step 3: Run targeted persistence/realtime regressions**

```bash
npm test -- test/db.test.ts test/room.test.ts test/worker.test.ts
```

Expected: stale-entry recovery, New final-content preservation, restore-new-session semantics, empty-state authority, alarm persistence/retry, oversized-content rejection, and API routing tests PASS.

- [ ] **Step 4: Verify no accidental schema change**

Run:

```bash
git diff main...HEAD -- schema.sql migrate-v2.sql migrate-v3.sql
```

Expected: no diff.

- [ ] **Step 5: Verify dependency and architecture boundaries**

Run:

```bash
npm ls --depth=0
git diff --name-only main...HEAD
```

Confirm there is no frontend framework, external state service, new DB migration, deployment script outside GitHub Actions, or unrelated refactor.

- [ ] **Step 6: Push and inspect GitHub Actions**

Push `codex/comprehensive-hardening`, open/update the PR, and wait for the `verify` job. Inspect failing job logs rather than guessing if anything is red.

- [ ] **Step 7: Review the final diff against the spec**

Check each approved requirement explicitly:

1. stale entry fallback;
2. cross-device New clear;
3. final pre-New content preserved;
4. restore creates a new session;
5. empty-state reconnect;
6. sanitized Markdown;
7. Unicode single-segment rooms;
8. literal `%`/`_` history search;
9. legacy password authentication + rehash;
10. legacy cookie lifetime compatibility + new cookie only for new sessions;
11. 1 MiB rejection;
12. same-origin state changes;
13. strict TypeScript;
14. Wrangler dry-run.

- [ ] **Step 8: Commit only if verification required fixes**

If no fixes were needed, do not create an empty commit. If fixes were needed:

```bash
git add <only-the-files-fixed>
git commit -m "fix: address hardening verification"
```

- [ ] **Step 9: Final PR metadata**

PR title:

```text
Harden realtime state, history persistence, and security
```

PR body must include:

- architecture remains Workers + DO + D1;
- no D1 migration;
- main correctness fixes;
- security changes;
- auth/session compatibility notes;
- exact verification commands and CI result;
- deferred features explicitly out of scope.

---

## Plan Self-Review

### Spec coverage

- Architecture/non-goals: Tasks 1, 5, 8, 9.
- Canonical room identity: Tasks 2 and 6.
- DO ownership/live state: Task 5.
- Alarm/coalesced history persistence: Tasks 3 and 5.
- Atomic New: Tasks 5, 6, 7.
- Restore-as-new-session: Tasks 3, 5, 6, 7.
- Markdown sanitation/CSP/no inline handlers: Tasks 2, 6, 7.
- Same-origin/limits: Tasks 2, 5, 6.
- Password/session migration/logout: Tasks 4 and 6.
- Literal history search: Task 3.
- Bounded reconnect/error behavior: Task 7.
- Wrangler 4/current Workers testing: Task 1.
- CI/dependency automation/docs: Task 8.
- No D1 migration/full acceptance verification: Task 9.

### Placeholder scan

No implementation step uses TBD/TODO or defers an unspecified behavior. SRI values are intentionally computed from the exact downloaded artifacts during Task 7 rather than guessed; the command and source versions are fixed.

### Type/interface consistency

The plan uses one canonical helper set across later tasks: `parsePageRoom`, `parseApiRoom`, `isSameOrigin`, `utf8Size`, `MAX_CONTENT_BYTES`, `hashPassword`, `verifyPassword`, `getHistoryItem`, and boolean mutation results. DO actions consistently receive server-created `{ room, userId, content }` payloads, while browser requests provide only user-controlled content or history ID.
