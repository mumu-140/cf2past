# cf2past Comprehensive Hardening Design

Date: 2026-09-14
Branch: `codex/comprehensive-hardening`
Status: Approved design direction (Option B)

## 1. Goal

Upgrade cf2past from a small personal utility into a safer and more reliable self-hosted clipboard while preserving its current architecture and low operational complexity.

The implementation must keep Cloudflare Workers, Durable Objects, D1, and the current lightweight frontend model. It must not introduce a frontend framework, a separate backend service, Redis/KV for coordination, or CRDT-style collaborative editing.

## 2. Non-goals

This work does not turn cf2past into a public pastebin, a multi-tenant SaaS service, or a collaborative document editor. It does not redesign the UI beyond changes needed for correctness, security, and basic usability. It does not add room ACLs, file transfer, end-to-end encryption, or a new database schema unless implementation proves one is strictly required.

## 3. Architecture

The system remains:

- Worker: authentication, HTTP routing, page responses, history APIs, and request validation.
- Durable Object: authoritative real-time state for one room, WebSocket fan-out, current editing-session identity, and coalesced persistence scheduling.
- D1: durable users, sessions, and history records.
- Browser: text editor, history panel, Markdown preview, reconnect handling, and user actions.

Each room maps to one Durable Object by canonical room name. The Durable Object is the single owner of the room's live content and current history-entry identity.

## 4. Room identity and routing

A room is exactly one decoded URL path segment. `/` maps to `default`; `/work` maps to `work`. Nested paths such as `/lab/test` are rejected rather than ambiguously interpreted.

Room names are normalized once at the Worker boundary, length-limited to 64 Unicode code points, and passed to frontend/API/DO paths using proper URL encoding. The same canonical room string must be used by WebSocket, new-session, history-list, history-mutation, and rendering code.

Invalid or nested page paths return 404. Malformed API room parameters return 400.

## 5. Durable Object state model

The Durable Object owns:

- `currentContent`: current room text, including the empty string.
- `currentEntryId`: D1 history row being updated for the active editing session, or null when a new row is needed.
- persistence scheduling state needed to coalesce history writes.

State is restored from Durable Object storage after hibernation. A newly connected WebSocket is always sent the current content, including `""`, so empty room state is authoritative and stale browser content is cleared.

Realtime synchronization remains last-write-wins. This is intentional for a clipboard and is not presented as collaborative text editing.

## 6. Editing and persistence semantics

Browser input updates the Durable Object immediately through WebSocket. The DO updates its live state and broadcasts the new content to other sockets.

D1 history writes are coalesced with a Durable Object alarm rather than executed on every short editing pause. The alarm persists the latest non-empty content for the current session. Operations that change session identity, especially New and history restore, first flush pending content when necessary.

`saveHistory` must not trust a stored entry ID blindly. If an UPDATE for `currentEntryId` affects zero rows, the record is considered stale or externally deleted; the function inserts a new history row and returns the new ID. The DO replaces its stored entry ID with that value.

A failed alarm persistence attempt keeps the room dirty and throws from the alarm handler so Durable Object alarm retry semantics can retry the flush. The failure must not advance or clear the active entry identity.

## 7. New-session semantics

New is an atomic Durable Object operation, not a browser sequence that relies on ordering between `ws.send()` and a separate HTTP request.

The operation performs, in order:

1. Persist the latest current content if it needs persistence.
2. Clear `currentEntryId`.
3. Set `currentContent` to the empty string.
4. Persist the new DO state.
5. Broadcast the empty string to every connected browser.

All devices therefore enter the same blank session immediately.

## 8. History restore semantics

Restoring an old history item loads its content into the live room but starts a new editing session. The restored historical row is not reused as the active row and is therefore not silently modified by later typing.

Restore is handled through the Durable Object so all connected devices converge on the restored text.

## 9. Markdown and browser security

Markdown preview treats clipboard content as untrusted input.

Rendering flow is:

`text -> Marked -> DOMPurify -> DOM`

The application must never assign unsanitized Marked output to `innerHTML`. Sanitization removes executable elements, event-handler attributes, dangerous URL schemes, and other active content.

Marked and DOMPurify are loaded as exact-version browser dependencies with Subresource Integrity. They are permitted explicitly by CSP rather than through a broad wildcard source. If implementation can bundle them locally without adding a frontend build subsystem, local bundling is preferred; otherwise exact-version CDN + SRI is the accepted design.

The current inline `onclick` handlers are removed. Browser behavior is wired with `addEventListener`. The application script receives a per-response CSP nonce; no `unsafe-inline` policy is permitted for scripts.

Responses include a nonce-based Content Security Policy plus `X-Content-Type-Options: nosniff`, frame protection, a restrictive referrer policy, and a minimal permissions policy.

## 10. Request security and limits

Authenticated state-changing endpoints require same-origin requests. Origin validation applies to New, history restore/mutation, logout, and WebSocket upgrade when the browser supplies an Origin header.

Clipboard content is capped at 1 MiB per room update. Oversized messages are rejected before changing live state, Durable Object storage, D1, or broadcast state.

## 11. Authentication and sessions

New passwords require at least 8 characters.

Password hashes use a versioned PBKDF2 representation so iteration count is explicit. New hashes use PBKDF2-SHA256 with 600,000 iterations. Existing unversioned 100,000-iteration hashes remain valid; after a successful login they are transparently rehashed at the new strength.

New sessions use an HttpOnly, Secure, SameSite=Strict `__Host-` cookie. The server may read the legacy `session` cookie only for compatibility with sessions issued before this release. New logins never issue the legacy cookie. Because old sessions already expire after seven days, legacy-cookie compatibility naturally disappears as those sessions expire. Logout clears both cookie names and deletes the active server-side session where present.

Expired D1 session cleanup is opportunistic and non-fatal to request handling.

## 12. History queries

History search remains D1 `LIKE`, but user query text escapes `%`, `_`, and the escape character so searches behave as literal substring searches rather than wildcard expressions.

Pinned and preserved behavior remains unchanged. Ordinary-history retention remains capped at the current configured limit.

## 13. Client and error handling

Invalid room paths are not silently normalized. Invalid history IDs/actions return 400 or 404 according to whether input is malformed or the target does not exist.

D1 persistence failures do not corrupt Durable Object session identity. A failed flush remains retryable.

Client reconnect uses bounded exponential backoff with jitter and resets after a successful connection. The server's first post-connect message is authoritative, including an empty string.

## 14. Engineering structure

Targeted extraction is expected where it improves testability, especially for:

- room parsing/canonicalization,
- HTTP security headers and same-origin checks,
- password-hash parsing/versioning,
- history query escaping.

Large unrelated refactors are excluded. `pages.ts` may be reorganized only as needed to make frontend security and script logic auditable.

## 15. Toolchain, tests, and CI

Upgrade to Wrangler 4 and current compatible Cloudflare Workers types and TypeScript. Advance the Workers compatibility date to a tested 2026 date.

Use Vitest with Cloudflare's current `@cloudflare/vitest-plugin` so Worker, D1, and Durable Object behavior can be exercised inside the Workers runtime. Use Wrangler's integration test harness only where a full built-Worker HTTP flow provides material additional coverage.

CI separates verification from deployment:

- Pull requests and pushes run `npm ci`, tests, TypeScript checks, and `wrangler deploy --dry-run`.
- Deployment runs only for `main` after verification succeeds.

Dependency automation may be added for npm and GitHub Actions.

## 16. Database compatibility

The preferred implementation requires no D1 schema migration. Existing `users`, `sessions`, and `history` rows remain usable.

If implementation discovers a schema change is unavoidable, that is a design change and must be called out before merging rather than hidden inside the hardening PR.

## 17. Required regression coverage

The test suite must cover at least:

1. Deleting the active history row, then typing again, creates a replacement row instead of losing history updates.
2. New clears every connected device and a newly connected device receives the empty state.
3. New cannot lose the final pre-New content because of HTTP/WebSocket ordering.
4. Restoring history starts a new session and does not mutate the restored row.
5. Empty state survives DO hibernation/reconnect semantics.
6. Markdown containing scripts, event handlers, unsafe links, and raw HTML cannot execute active content.
7. Unicode room names work consistently; nested path ambiguity is rejected.
8. `%` and `_` in history search are treated literally.
9. Legacy password hashes still authenticate and are upgraded after successful login.
10. Legacy session cookies remain valid only for their existing lifetime; new sessions use only the new cookie.
11. Oversized content is rejected without changing current state.
12. Same-origin enforcement rejects cross-origin state changes.
13. TypeScript strict checks pass.
14. Wrangler dry-run passes under the upgraded toolchain.

## 18. Acceptance criteria

The hardening release is acceptable when:

- existing deployments can upgrade without a D1 migration,
- two-device realtime behavior is deterministic for edit, New, reconnect, and restore,
- stale history IDs no longer cause silent persistence loss,
- Markdown preview cannot execute unsanitized active content,
- CSP does not require `unsafe-inline` for scripts,
- room identity is consistent across all APIs,
- legacy accounts and still-valid legacy sessions remain usable during migration,
- PR verification runs before deployment,
- README and security documentation describe the actual behavior and upgrade path,
- no frontend framework or additional state service is introduced.

## 19. Deferred work

The following are intentionally deferred: room-level authorization, multi-user role management, end-to-end encryption, binary/file clipboard support, full-text-search infrastructure, CRDT/OT collaboration, offline-first editing, and a frontend framework migration.
