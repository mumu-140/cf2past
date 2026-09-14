import { describe, expect, it } from 'vitest';
import {
  createNonce,
  isSameOrigin,
  MAX_CONTENT_BYTES,
  securityHeaders,
  utf8Size,
} from '../src/http';

describe('request security helpers', () => {
  it('accepts a matching Origin', () => {
    const request = new Request('https://clip.example/api/new/x', {
      headers: { Origin: 'https://clip.example' },
    });
    expect(isSameOrigin(request)).toBe(true);
  });

  it('rejects a different Origin', () => {
    const request = new Request('https://clip.example/api/new/x', {
      headers: { Origin: 'https://evil.example' },
    });
    expect(isSameOrigin(request)).toBe(false);
  });

  it('rejects a missing Origin for browser state changes', () => {
    const request = new Request('https://clip.example/api/new/x');
    expect(isSameOrigin(request)).toBe(false);
  });

  it('counts UTF-8 bytes rather than UTF-16 code units', () => {
    expect(utf8Size('杨')).toBe(3);
    expect(utf8Size('a'.repeat(MAX_CONTENT_BYTES))).toBe(MAX_CONTENT_BYTES);
  });

  it('defines the content limit as exactly 1 MiB', () => {
    expect(MAX_CONTENT_BYTES).toBe(1024 * 1024);
  });

  it('creates a fresh 18-byte base64 nonce', () => {
    const first = createNonce();
    const second = createNonce();
    expect(first).toMatch(/^[A-Za-z0-9+/]{24}$/);
    expect(second).toMatch(/^[A-Za-z0-9+/]{24}$/);
    expect(second).not.toBe(first);
  });

  it('builds a nonce-bound restrictive CSP and defensive headers', () => {
    const headers = securityHeaders('test-nonce');
    const csp = headers.get('Content-Security-Policy') ?? '';
    const scriptPolicy = csp.split(';').find(part => part.trim().startsWith('script-src')) ?? '';

    expect(scriptPolicy).toContain("'nonce-test-nonce'");
    expect(scriptPolicy).toContain('https://cdn.jsdelivr.net');
    expect(scriptPolicy).not.toContain("'unsafe-inline'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(headers.get('Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=()');
  });
});
