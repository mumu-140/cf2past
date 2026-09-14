import { env } from 'cloudflare:workers';
import { beforeEach } from 'vitest';

beforeEach(async () => {
  await env.DB.exec('DROP TABLE IF EXISTS sessions');
  await env.DB.exec('DROP TABLE IF EXISTS users');
  await env.DB.exec('DROP TABLE IF EXISTS history');
  await env.DB.exec(env.TEST_SCHEMA);
});
