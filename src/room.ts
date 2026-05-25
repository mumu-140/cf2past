import { Env } from './index';
import { saveHistory } from './db';

export class Room implements DurableObject {
  private connections: Map<WebSocket, { userId: number }> = new Map();
  private currentContent: string = '';

  constructor(private state: DurableObjectState, private env: Env) {}

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const url = new URL(request.url);
    const userId = parseInt(url.searchParams.get('uid') || '0');
    const room = url.searchParams.get('room') || 'default';

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.state.acceptWebSocket(server);
    this.connections.set(server, { userId });

    // 新连接时发送当前内容
    if (this.currentContent) {
      server.send(this.currentContent);
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return;

    this.currentContent = message;
    const meta = this.connections.get(ws);
    const room = this.getRoomName();

    // 广播给其他连接
    for (const [conn] of this.connections) {
      if (conn !== ws) {
        try { conn.send(message); } catch { this.connections.delete(conn); }
      }
    }

    // 异步写历史（不阻塞广播）
    if (meta) {
      this.state.waitUntil(saveHistory(this.env.DB, room, message, meta.userId));
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    this.connections.delete(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.connections.delete(ws);
  }

  private getRoomName(): string {
    return this.state.id.name || 'default';
  }
}
