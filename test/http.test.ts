import { describe, expect, it } from 'vitest';
import { isSameOrigin, MAX_CONTENT_BYTES, utf8Size } from '../src/http';

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
});
