import { readFileSync } from 'node:fs';
import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.example.toml' },
      miniflare: {
        d1Databases: { DB: '00000000-0000-0000-0000-000000000001' },
        bindings: { TEST_SCHEMA: schema },
      },
    }),
  ],
  test: {
    setupFiles: ['./test/setup.ts'],
  },
});
