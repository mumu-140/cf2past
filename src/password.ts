const CURRENT_SCHEME = 'pbkdf2-sha256';
const CURRENT_ITERATIONS = 100_000;
const LEGACY_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

export interface PasswordVerification {
  valid: boolean;
  needsRehash: boolean;
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(value: string, expectedBytes: number): Uint8Array | null {
  if (value.length !== expectedBytes * 2 || !/^[0-9a-f]+$/i.test(value)) return null;
  const bytes = new Uint8Array(expectedBytes);
  for (let index = 0; index < expectedBytes; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    HASH_BYTES * 8,
  );
  return new Uint8Array(bits);
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, CURRENT_ITERATIONS);
  return `${CURRENT_SCHEME}$${CURRENT_ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<PasswordVerification> {
  try {
    if (stored.startsWith(`${CURRENT_SCHEME}$`)) {
      const parts = stored.split('$');
      if (parts.length !== 4) return { valid: false, needsRehash: false };

      const iterations = Number(parts[1]);
      const salt = hexToBytes(parts[2], SALT_BYTES);
      const expected = hexToBytes(parts[3], HASH_BYTES);
      if (!Number.isSafeInteger(iterations) || iterations <= 0 || !salt || !expected) {
        return { valid: false, needsRehash: false };
      }

      const computed = await derive(password, salt, iterations);
      const valid = constantTimeEqual(computed, expected);
      return {
        valid,
        needsRehash: valid && iterations !== CURRENT_ITERATIONS,
      };
    }

    const legacyParts = stored.split(':');
    if (legacyParts.length !== 2) return { valid: false, needsRehash: false };
    const salt = hexToBytes(legacyParts[0], SALT_BYTES);
    const expected = hexToBytes(legacyParts[1], HASH_BYTES);
    if (!salt || !expected) return { valid: false, needsRehash: false };

    const computed = await derive(password, salt, LEGACY_ITERATIONS);
    const valid = constantTimeEqual(computed, expected);
    return { valid, needsRehash: valid };
  } catch {
    return { valid: false, needsRehash: false };
  }
}
