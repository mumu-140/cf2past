import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/password';

function toHex(bytes: Uint8Array): string {
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function legacyHash(password: string): Promise<string> {
  const salt = Uint8Array.from({ length: 16 }, (_, index) => index + 1);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    key,
    256,
  );
  return `${toHex(salt)}:${toHex(new Uint8Array(bits))}`;
}

describe('password hashing', () => {
  it('creates a versioned 600k PBKDF2-SHA256 hash', async () => {
    const stored = await hashPassword('correct horse battery staple');
    expect(stored).toMatch(/^pbkdf2-sha256\$600000\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    expect(await verifyPassword('correct horse battery staple', stored)).toEqual({
      valid: true,
      needsRehash: false,
    });
  });

  it('rejects a wrong password', async () => {
    const stored = await hashPassword('right password');
    expect(await verifyPassword('wrong password', stored)).toEqual({
      valid: false,
      needsRehash: false,
    });
  });

  it('accepts the legacy 100k format and requests a rehash', async () => {
    const stored = await legacyHash('legacy password');
    expect(await verifyPassword('legacy password', stored)).toEqual({
      valid: true,
      needsRehash: true,
    });
  });

  it('rejects malformed stored hashes without throwing', async () => {
    await expect(verifyPassword('anything', 'not-a-valid-hash')).resolves.toEqual({
      valid: false,
      needsRehash: false,
    });
  });
});
