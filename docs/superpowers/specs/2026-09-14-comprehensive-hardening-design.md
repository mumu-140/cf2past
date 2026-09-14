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

This removes the current mismatch where live state can use `lab/test` while history APIs treat only `lab` as the room.

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

This directly fixes the failure mode where deleting the active history record causes all subsequent edits to update a nonexistent row forever.

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

This keeps history records understandable: restore means “use this as the starting content now,” not “resume mutating the old record.”

## 9. Markdown security

Markdown preview treats clipboard content as untrusted input.

Rendering flow is:

`text -> Marked -> DOMPurify -> DOM`

The application must never assign unsanitized Marked output to `innerHTML`. Sanitization must remove executable elements, event-handler attributes, dangerous URL schemes, and other active content.

The page receives a Content Security Policy and standard defensive response headers. Third-party scripts must be version-pinned; bundling them locally is preferred if practical without materially increasing project complexity.

## 10. Request security

Authenticated state-changing endpoints require same-origin requests. Origin validation applies to New, history mutation, logout, and WebSocket upgrade where the browser supplies an Origin header.

Responses add appropriate headers including CSP, `X-Content-Type-Options: nosniff`, frame protection, a restrictive referrer policy, and a minimal permissions policy.

Clipboard content is capped at 1 MiB per room update to prevent accidental or abusive large-message amplification through WebSocket, Durable Object storage, D1, and browser rendering.

## 11. Authentication and sessions

New passwords require at least 8 characters.

Password hashes use a versioned PBKDF2 representation so iteration count is explicit. New hashes use PBKDF2-SHA256 with 600,000 iterations. Existing unversioned 100,000-iteration hashes remain valid; after a successful login they are transparently rehashed at the new strength.

Sessions use an HttpOnly, Secure, SameSite=Strict `__Host-` cookie. Existing session-cookie compatibility may be accepted temporarily during upgrade so currently logged-in deployments do not fail abruptly.

A logout route deletes or invalidates the current server-side session and expires relevant cookies. Opportunistic cleanup removes expired D1 session rows without making cleanup a critical-path failure.

## 12. History queries

History search remains D1 `LIKE`, but user query text escapes `%`, `_`, and the escape character so searches behave as literal substring searches rather than exposing accidental wildcard semantics.

Pinned and preserved behavior remains unchanged. Ordinary-history retention remains capped at the current configured limit.

## 13. Error handling

Invalid room paths return a deterministic 400 or 404 response rather than being silently normalized into a different room.

Oversized WebSocket messages are rejected and do not change live or persisted state. Invalid history IDs/actions return explicit client errors. D1 persistence failures must not corrupt DO session identity; a failed flush remains retryable on the next persistence opportunity.

Client reconnect logic must not create reconnect storms and must treat the server's first post-connect message as authoritative, including an empty string.

## 14. Engineering structure

Targeted extraction is allowed where it improves testability, especially for:

- room parsing/canonicalization,
- HTTP security headers and same-origin checks,
- password-hash parsing/versioning,
- history query escaping.

Large unrelated refactors are excluded. `pages.ts` may be reorganized only as needed to make frontend security and script logic auditable.

## 15. Toolchain and CI

Upgrade to Wrangler 4 and current compatible Cloudflare Workers types and TypeScript. Advance the Workers compatibility date to a tested 2026 date.

CI separates verification from deployment:

- Pull requests and pushes run `npm ci`, TypeScript checks, and `wrangler deploy --dry-run`.
- Deployment runs only for `main` after verification succeeds.

Dependency automation may be added for npm and GitHub Actions.

## 16. Database compatibility

The preferred implementation requires no D1 schema migration. Existing `users`, `sessions`, and `history` rows remain usable.

If implementation discovers a schema change is unavoidable, that is a design change and must be called out before merging rather than being hidden inside the hardening PR.

## 17. Testing strategy

The implementation must cover at least these regression cases:

1. Deleting the active history row, then typing again, creates a replacement row instead of losing history updates.
2. New clears every connected device and a newly connected device receives the empty state.
3. New cannot lose the final pre-New content because of HTTP/WebSocket ordering.
4. Restoring history starts a new session and does not mutate the restored row.
5. Empty state survives DO hibernation/reconnect semantics.
6. Markdown containing scripts, event handlers, unsafe links, and raw HTML cannot execute active content.
7. Unicode room names work consistently; nested path ambiguity is rejected.
8. `%` and `_` in history search are treated literally.
9. Legacy password hashes still authenticate and are upgraded after successful login.
10. Oversized content is rejected without changing current state.
11. TypeScript strict checks pass.
12. Wrangler dry-run passes under the upgraded toolchain.

## 18. Acceptance criteria

The hardening release is acceptable when:

- existing deployments can upgrade without a D1 migration,
- two-device realtime behavior is deterministic for edit, New, reconnect, and restore,
- stale history IDs no longer cause silent persistence loss,
- Markdown preview cannot execute unsanitized active content,
- room identity is consistent across all APIs,
- legacy accounts remain usable while new password hashing is stronger,
- PR verification runs before deployment,
- README and security documentation describe the actual behavior and upgrade path,
- no frontend framework or additional state service is introduced.

## 19. Deferred work

The following are intentionally deferred: room-level authorization, multi-user role management, end-to-end encryption, binary/file clipboard support, full-text-search infrastructure, CRDT/OT collaboration, offline-first editing, and a frontend framework migration.
