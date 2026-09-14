import { env } from 'cloudflare:workers';
import { runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { MAX_CONTENT_BYTES } from '../src/http';
import { Room } from '../src/room';

async function createUser(name: string): Promise<number> {
  const result = await env.DB.prepare(
    'INSERT INTO users (username, password_hash) VALUES (?, ?)'
  ).bind(name, 'test-hash').run();
  return result.meta.last_row_id as number;
}

function roomStub(name: string): DurableObjectStub {
  return env.ROOM.get(env.ROOM.idFromName(`${name}-${crypto.randomUUID()}`));
}

async function edit(stub: DurableObjectStub, userId: number, room: string, content: string): Promise<boolean> {
  return runInDurableObject(stub, async (instance: Room) => instance.applyEdit(userId, room, content));
}

async function storedState(stub: DurableObjectStub): Promise<{
  content: string;
  entryId: number;
  dirty: boolean;
  pendingUserId: number;
  room: string;
}> {
  return runInDurableObject(stub, async (_instance: Room, state) => ({
    content: (await state.storage.get<string>('content')) ?? '',
    entryId: (await state.storage.get<number>('entryId')) ?? 0,
    dirty: (await state.storage.get<boolean>('dirty')) ?? false,
    pendingUserId: (await state.storage.get<number>('pendingUserId')) ?? 0,
    room: (await state.storage.get<string>('room')) ?? '',
  }));
}

describe('Room Durable Object', () => {
  it('coalesces edits into an alarm instead of writing D1 immediately', async () => {
    const userId = await createUser('alarm-user');
    const stub = roomStub('alarm');

    expect(await edit(stub, userId, 'work', 'draft')).toBe(true);

    const before = await env.DB.prepare('SELECT COUNT(*) AS c FROM history').first<{ c: number }>();
    expect(before?.c).toBe(0);
    expect((await storedState(stub)).dirty).toBe(true);

    expect(await runDurableObjectAlarm(stub)).toBe(true);

    const row = await env.DB.prepare('SELECT id, content FROM history').first<{ id: number; content: string }>();
    const state = await storedState(stub);
    expect(row?.content).toBe('draft');
    expect(state.entryId).toBe(row?.id);
    expect(state.dirty).toBe(false);
  });

  it('recovers a stale active history id on the next alarm', async () => {
    const userId = await createUser('stale-do-user');
    const stub = roomStub('stale');

    await edit(stub, userId, 'work', 'first');
    await runDurableObjectAlarm(stub);
    const firstId = (await storedState(stub)).entryId;
    await env.DB.prepare('DELETE FROM history WHERE id = ?').bind(firstId).run();

    await edit(stub, userId, 'work', 'second');
    await runDurableObjectAlarm(stub);

    const state = await storedState(stub);
    const row = await env.DB.prepare('SELECT id, content FROM history').first<{ id: number; content: string }>();
    expect(row?.content).toBe('second');
    expect(state.entryId).toBe(row?.id);
    expect(state.entryId).not.toBe(firstId);
  });

  it('New persists the final HTTP content and atomically clears the room', async () => {
    const userId = await createUser('new-user');
    const stub = roomStub('new');
    await edit(stub, userId, 'shared', 'older websocket value');

    const response = await stub.fetch(new Request('https://room.internal/?action=new', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room: 'shared', userId, content: 'final local value' }),
    }));

    expect(response.status).toBe(200);
    const row = await env.DB.prepare('SELECT content FROM history ORDER BY id DESC LIMIT 1').first<{ content: string }>();
    const state = await storedState(stub);
    expect(row?.content).toBe('final local value');
    expect(state.content).toBe('');
    expect(state.entryId).toBe(0);
    expect(state.dirty).toBe(false);
    expect(await runDurableObjectAlarm(stub)).toBe(false);
  });

  it('restore flushes current content and starts a new history session', async () => {
    const userId = await createUser('restore-user');
    const stub = roomStub('restore');
    const original = await env.DB.prepare(
      'INSERT INTO history (room, content, user_id) VALUES (?, ?, ?)'
    ).bind('shared', 'old snapshot', userId).run();
    const originalId = original.meta.last_row_id as number;

    await edit(stub, userId, 'shared', 'current unsaved');
    const response = await stub.fetch(new Request('https://room.internal/?action=restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room: 'shared', userId, content: 'old snapshot' }),
    }));

    expect(response.status).toBe(200);
    let state = await storedState(stub);
    expect(state.content).toBe('old snapshot');
    expect(state.entryId).toBe(0);
    expect(state.dirty).toBe(true);

    expect(await runDurableObjectAlarm(stub)).toBe(true);
    state = await storedState(stub);
    const rows = (await env.DB.prepare(
      'SELECT id, content FROM history WHERE room = ? ORDER BY id ASC'
    ).bind('shared').all<{ id: number; content: string }>()).results;

    expect(rows.find(row => row.id === originalId)?.content).toBe('old snapshot');
    expect(rows.map(row => row.content)).toContain('current unsaved');
    expect(rows.filter(row => row.content === 'old snapshot')).toHaveLength(2);
    expect(state.entryId).not.toBe(originalId);
  });

  it('rejects oversized content without changing room state', async () => {
    const userId = await createUser('oversized-user');
    const stub = roomStub('oversized');

    expect(await edit(stub, userId, 'shared', 'a'.repeat(MAX_CONTENT_BYTES + 1))).toBe(false);

    const state = await storedState(stub);
    const count = await env.DB.prepare('SELECT COUNT(*) AS c FROM history').first<{ c: number }>();
    expect(state.content).toBe('');
    expect(state.dirty).toBe(false);
    expect(count?.c).toBe(0);
  });

  it('sends an explicit empty state to a newly connected websocket', async () => {
    const stub = roomStub('empty');
    const response = await stub.fetch(new Request('https://room.internal/?uid=1&room=shared', {
      headers: { Upgrade: 'websocket' },
    }));
    expect(response.status).toBe(101);
    const socket = response.webSocket;
    expect(socket).not.toBeNull();
    if (!socket) throw new Error('missing websocket');

    const message = new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('server did not send initial state')), 500);
      socket.addEventListener('message', event => {
        clearTimeout(timeout);
        resolve(String(event.data));
      }, { once: true });
    });
    socket.accept();

    try {
      await expect(message).resolves.toBe('');
    } finally {
      socket.close();
    }
  });
});
