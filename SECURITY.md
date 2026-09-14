# Security Policy

## Scope

cf2past is intended for personal use or a small trusted team. It is not designed as a public pastebin or as a multi-tenant service with per-room authorization.

Any authenticated user can open any valid room name unless you add external access controls in front of the Worker. Room names are identifiers, not access-control boundaries.

Clipboard text is processed by the Worker, held by the room Durable Object, and persisted in D1 history. It is therefore server-readable and is not end-to-end encrypted.

## Security controls

- New passwords require at least 8 characters.
- New password hashes use PBKDF2-SHA256 with 600,000 iterations and a random salt.
- Legacy unversioned PBKDF2 hashes remain valid during migration and are transparently rehashed after a successful login.
- New sessions use the `__Host-cf2past_session` cookie with `HttpOnly`, `Secure`, and `SameSite=Strict` attributes.
- Existing unexpired legacy `session` cookies are accepted only for migration compatibility; new legacy cookies are never issued.
- State-changing browser requests enforce same-origin checks.
- Clipboard content is limited to 1 MiB measured as UTF-8 bytes.
- Markdown preview output is sanitized with DOMPurify before it is inserted into the page.
- Browser scripts run under nonce-based Content Security Policy; application scripts do not require `unsafe-inline`.
- Marked and DOMPurify are loaded from exact-version CDN URLs with Subresource Integrity metadata.

These controls reduce common web risks but do not change the trusted-user model. Keep dependencies current and place additional authentication or network controls in front of cf2past if you need stronger isolation.

## Secrets and deployment

Do not commit `wrangler.toml`, `.dev.vars`, `.env`, API tokens, session cookies, database exports, or other credentials. Store deployment credentials in GitHub Secrets or another appropriate secret manager, and use the smallest practical Cloudflare API-token scope.

## Reporting a vulnerability

Prefer GitHub's private security-reporting feature for this repository if it is enabled. Otherwise, contact the repository owner privately through an appropriate private channel.

Do not publish working exploits, credentials, session tokens, database contents, or other sensitive material in a public issue.
