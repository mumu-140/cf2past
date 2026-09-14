import { describe, expect, it } from 'vitest';
import { parseApiRoom, parsePageRoom } from '../src/rooms';

describe('canonical room parsing', () => {
  it('maps the root page to the default room', () => {
    expect(parsePageRoom('/')).toBe('default');
  });

  it('accepts exactly one decoded Unicode segment', () => {
    expect(parsePageRoom('/%E6%9D%A8%E6%A0%91')).toBe('杨树');
  });

  it('rejects nested page paths', () => {
    expect(parsePageRoom('/lab/test')).toBeNull();
  });

  it('rejects malformed percent encoding', () => {
    expect(parsePageRoom('/%ZZ')).toBeNull();
  });

  it('rejects room names longer than 64 Unicode code points', () => {
    expect(parsePageRoom('/' + '树'.repeat(65))).toBeNull();
  });

  it('decodes API room segments exactly once', () => {
    expect(parseApiRoom('%E6%9D%A8%E6%A0%91')).toBe('杨树');
    expect(parseApiRoom('%252F')).toBe('%2F');
  });

  it('rejects decoded slashes and NULs', () => {
    expect(parseApiRoom('%2F')).toBeNull();
    expect(parseApiRoom('%00')).toBeNull();
  });
});
