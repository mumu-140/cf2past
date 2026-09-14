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
  return new Headers({
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
}
