import type { Env } from './index';
import { saveHistory } from './db';
import { MAX_CONTENT_BYTES, utf8Size } from './http';

const PERSIST_DELAY_MS = 750;
const RETRY_DELAY_MS = 2_000;

interface ActionPayload {
  room: string;
  userId: number;
  content: string;
}

export class Room implements DurableObject {
  private currentContent = '';
  private currentEntryId: number | null = null;
  private dirty = false;
  private pendingUserId = 0;
  private room = 'default';

  constructor(private state: DurableObjectState, private env: Env) {
    this.state.blockConcurrencyWhile(async () => {
      const storedEntryId = (await this.state.storage.get<number>('entryId')) ?? 0;
      this.currentEntryId = storedEntryId || null;
      this.currentContent = (await this.state.storage.get<string>('content')) ?? '';
      this.dirty = (await this.state.storage.get<boolean>('dirty')) ?? false;
      this.pendingUserId = (await this.state.storage.get<number>('pendingUserId')) ?? 0;
      this.room = (await this.state.storage.get<string>('room')) ?? 'default';
    });
  }

  private async persistState(): Promise<void> {
    await this.state.storage.put({
      content: this.currentContent,
      entryId: this.currentEntryId ?? 0,
      dirty: this.dirty,
      pendingUserId: this.pendingUserId,
      room: this.room,
    });
  }

  private async schedulePersistence(delay = PERSIST_DELAY_MS): Promise<void> {
    await this.state.storage.setAlarm(Date.now() + delay);
  }

  private broadcast(content: string, exclude?: WebSocket): void {
    for (const socket of this.state.getWebSockets()) {
      if (socket === exclude) continue;
      try {
        socket.send(content);
      } catch {
        // A disconnected peer is cleaned up by the runtime.
      }
    }
  }

  private async readActionPayload(request: Request): Promise<ActionPayload | null> {
    if (request.method !== 'POST') return null;

    let value: unknown;
    try {
      value = await request.json();
    } catch {
      return null;
    }

    if (!value || typeof value !== 'object') return null;
    const payload = value as Partial<ActionPayload>;
    if (typeof payload.room !== 'string' || !payload.room) return null;
    if (!Number.isSafeInteger(payload.userId) || (payload.userId ?? 0) <= 0) return null;
    if (typeof payload.content !== 'string') return null;
    return payload as ActionPayload;
  }

  private async flushHistory(): Promise<void> {
    if (!this.dirty) return;

    if (!this.pendingUserId || !this.currentContent.trim()) {
      this.dirty = false;
      await this.state.storage.put('dirty', false);
      return;
    }

    const newId = await saveHistory(
      this.env.DB,
      this.room,
      this.currentContent,
      this.pendingUserId,
      this.currentEntryId,
    );

    this.currentEntryId = newId || null;
    this.dirty = false;
    await this.state.storage.put({
      entryId: newId || 0,
      dirty: false,
    });
  }

  public async applyEdit(userId: number, room: string, content: string): Promise<boolean> {
    if (!Number.isSafeInteger(userId) || userId <= 0 || !room) return false;
    if (utf8Size(content) > MAX_CONTENT_BYTES) return false;

    this.currentContent = content;
    this.pendingUserId = userId;
    this.room = room;
    this.dirty = true;
    await this.persistState();
    await this.schedulePersistence();
    return true;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    if (action === 'new' || action === 'restore') {
      const payload = await this.readActionPayload(request);
      if (!payload) {
        return Response.json({ error: 'invalid payload' }, { status: 400 });
      }
      if (utf8Size(payload.content) > MAX_CONTENT_BYTES) {
        return Response.json({ error: 'content too large' }, { status: 413 });
      }

      if (action === 'new') {
        const accepted = await this.applyEdit(payload.userId, payload.room, payload.content);
        if (!accepted) {
          return Response.json({ error: 'invalid payload' }, { status: 400 });
        }

        try {
          await this.flushHistory();
        } catch (error) {
          console.error('Failed to flush room history before New', error);
          await this.schedulePersistence(RETRY_DELAY_MS);
          return Response.json({ error: 'history persistence failed' }, { status: 503 });
        }

        this.currentEntryId = null;
        this.currentContent = '';
        this.dirty = false;
        this.pendingUserId = 0;
        this.room = payload.room;
        await this.persistState();
        await this.state.storage.deleteAlarm();
        this.broadcast('');
        return Response.json({ ok: true });
      }

      try {
        await this.flushHistory();
      } catch (error) {
        console.error('Failed to flush room history before restore', error);
        await this.schedulePersistence(RETRY_DELAY_MS);
        return Response.json({ error: 'history persistence failed' }, { status: 503 });
      }

      this.currentEntryId = null;
      this.currentContent = payload.content;
      this.pendingUserId = payload.userId;
      this.room = payload.room;
      this.dirty = true;
      await this.persistState();
      await this.schedulePersistence();
      this.broadcast(payload.content);
      return Response.json({ ok: true });
    }

    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader?.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const userId = url.searchParams.get('uid') || '0';
    const room = url.searchParams.get('room') || 'default';

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.state.acceptWebSocket(server, [`uid:${userId}`, `room:${room}`]);

    // The server is authoritative, including when its state is explicitly empty.
    server.send(this.currentContent);

    return new Response(null, { status: 101, webSocket: client });
  }

  async alarm(): Promise<void> {
    try {
      await this.flushHistory();
    } catch (error) {
      console.error('Failed to persist room history from alarm', error);
      await this.schedulePersistence(RETRY_DELAY_MS);
      throw error;
    }
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return;

    const tags = this.state.getTags(ws);
    const userId = Number.parseInt((tags.find(tag => tag.startsWith('uid:')) || 'uid:0').slice(4), 10);
    const room = (tags.find(tag => tag.startsWith('room:')) || 'room:default').slice(5);

    const accepted = await this.applyEdit(userId, room, message);
    if (!accepted) {
      try {
        ws.close(1009, 'Message too large or invalid');
      } catch {
        // Ignore close races.
      }
      return;
    }

    this.broadcast(message, ws);
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    try {
      ws.close();
    } catch {
      // Socket may already be closed.
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    try {
      ws.close();
    } catch {
      // Socket may already be closed.
    }
  }
}
