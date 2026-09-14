import { describe, expect, it } from 'vitest';
import { loginPage, mainPage, setupPage } from '../src/pages';

const renderLogin = loginPage as (error: string | undefined, nonce: string) => string;
const renderSetup = setupPage as (error: string | undefined, nonce: string) => string;
const renderMain = mainPage as (room: string, nonce: string) => string;

function inlineScripts(html: string): string[] {
  return [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/gi)].map(match => match[1] ?? '');
}

describe('page security', () => {
  it('has no inline DOM event handler attributes', () => {
    const html = renderMain('default', 'test-nonce');
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
  });

  it('puts the response nonce on every inline application script', () => {
    for (const html of [
      renderLogin(undefined, 'test-nonce'),
      renderSetup(undefined, 'test-nonce'),
      renderMain('default', 'test-nonce'),
    ]) {
      const scripts = inlineScripts(html);
      expect(scripts.length).toBeGreaterThan(0);
      for (const attrs of scripts) {
        expect(attrs).toContain('nonce="test-nonce"');
      }
    }
  });

  it('pins Marked and DOMPurify and requires SRI', () => {
    const html = renderMain('default', 'test-nonce');
    expect(html).toContain('https://cdn.jsdelivr.net/npm/marked@18.0.12/lib/marked.umd.js');
    expect(html).toContain('https://cdn.jsdelivr.net/npm/dompurify@3.4.15/dist/purify.min.js');

    const externalScripts = [...html.matchAll(/<script\s+([^>]*\bsrc="[^"]+"[^>]*)><\/script>/gi)];
    expect(externalScripts).toHaveLength(2);
    for (const match of externalScripts) {
      const attrs = match[1] ?? '';
      expect(attrs).toMatch(/\bintegrity="sha384-[A-Za-z0-9+/]+={0,2}"/);
      expect(attrs).toContain('crossorigin="anonymous"');
    }
  });

  it('sanitizes Marked output before assigning it to preview HTML', () => {
    const html = renderMain('default', 'test-nonce');
    expect(html).toContain('DOMPurify.sanitize');
    expect(html).toContain('marked.parse');
    expect(html).not.toMatch(/preview\.innerHTML\s*=\s*marked\.parse/);
  });

  it('serializes hostile room names as data rather than executable markup', () => {
    const hostile = "x'</script><script>alert(1)</script>";
    const html = renderMain(hostile, 'test-nonce');
    expect(html).not.toContain(hostile);
    expect(html).not.toContain("const room='x'</script>");
    expect(html).toContain('\\u003c/script>');
  });

  it('escapes auth errors and requires at least 8 characters at setup', () => {
    const hostileError = '<img src=x onerror=alert(1)>';
    const login = renderLogin(hostileError, 'test-nonce');
    const setup = renderSetup(hostileError, 'test-nonce');

    expect(login).not.toContain(hostileError);
    expect(setup).not.toContain(hostileError);
    expect(setup).toContain('minlength="8"');
    expect(setup).toContain('至少8位');
  });
});
