import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import {
  deleteHistory,
  getHistory,
  getHistoryItem,
  saveHistory,
  togglePin,
  togglePreserve,
} from '../src/db';

async function createUser(name: string): Promise<number> {
  const result = await env.DB.prepare(
    'INSERT INTO users (username, password_hash) VALUES (?, ?)'
  ).bind(name, 'test-hash').run();
  return result.meta.last_row_id as number;
}

describe('history persistence', () => {
  it('inserts a replacement row when the active entry was deleted', async () => {
    const userId = await createUser('stale-entry');
    const firstId = await saveHistory(env.DB, 'room', 'first', userId, null);

    await env.DB.prepare('DELETE FROM history WHERE id = ?').bind(firstId).run();

    const replacementId = await saveHistory(env.DB, 'room', 'second', userId, firstId);
    expect(replacementId).not.toBe(firstId);

    const row = await env.DB.prepare(
      'SELECT content FROM history WHERE id = ?'
    ).bind(replacementId).first<{ content: string }>();
    expect(row?.content).toBe('second');
  });

  it('treats percent and underscore literally in search', async () => {
    const userId = await createUser('literal-search');
    await saveHistory(env.DB, 'room', '100%_done', userId, null);
    await saveHistory(env.DB, 'room', '100xxdone', userId, null);

    const items = await getHistory(env.DB, 'room', '%_');
    expect(items.map(item => item.content)).toEqual(['100%_done']);
  });

  it('reports whether delete changed a row', async () => {
    expect(await deleteHistory(env.DB, 999999, 'room')).toBe(false);
  });

  it('looks up a history item only inside its canonical room', async () => {
    const userId = await createUser('lookup-user');
    const id = await saveHistory(env.DB, 'room-a', 'snapshot', userId, null);

    expect((await getHistoryItem(env.DB, id, 'room-a'))?.content).toBe('snapshot');
    expect(await getHistoryItem(env.DB, id, 'room-b')).toBeNull();
  });

  it('reports whether pin and preserve mutations changed a row', async () => {
    const userId = await createUser('mutation-user');
    const id = await saveHistory(env.DB, 'room', 'snapshot', userId, null);

    expect(await togglePin(env.DB, id, 'room')).toBe(true);
    expect(await togglePreserve(env.DB, id, 'room')).toBe(true);
    expect(await togglePin(env.DB, 999999, 'room')).toBe(false);
    expect(await togglePreserve(env.DB, 999999, 'room')).toBe(false);
  });
});
