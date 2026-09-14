import { env } from 'cloudflare:workers';
import { beforeEach } from 'vitest';

beforeEach(async () => {
  await env.DB.exec('DROP TABLE IF EXISTS history');
  await env.DB.exec('DROP TABLE IF EXISTS sessions');
  await env.DB.exec('DROP TABLE IF EXISTS users');

  const statements = env.TEST_SCHEMA
    .split(';')
    .map(statement => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await env.DB.prepare(statement).run();
  }
});
