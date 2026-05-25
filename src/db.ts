export interface HistoryItem {
  id: number;
  room: string;
  content: string;
  user_id: number;
  created_at: string;
}

const MAX_HISTORY = 50;
const MIN_SAVE_INTERVAL_MS = 3000;
const lastSaveTime: Map<string, number> = new Map();

export async function saveHistory(db: D1Database, room: string, content: string, userId: number): Promise<void> {
  if (!content.trim()) return;

  // 防抖：同一房间 3 秒内不重复写入
  const key = room;
  const now = Date.now();
  const last = lastSaveTime.get(key) || 0;
  if (now - last < MIN_SAVE_INTERVAL_MS) return;
  lastSaveTime.set(key, now);

  await db.prepare(
    'INSERT INTO history (room, content, user_id) VALUES (?, ?, ?)'
  ).bind(room, content, userId).run();

  // 超出上限时清理旧记录
  const count = await db.prepare(
    'SELECT COUNT(*) as c FROM history WHERE room = ?'
  ).bind(room).first<{ c: number }>();

  if (count && count.c > MAX_HISTORY) {
    await db.prepare(
      `DELETE FROM history WHERE id IN (
        SELECT id FROM history WHERE room = ? ORDER BY created_at ASC LIMIT ?
      )`
    ).bind(room, count.c - MAX_HISTORY).run();
  }
}

export async function getHistory(db: D1Database, room: string, query: string): Promise<HistoryItem[]> {
  if (query) {
    return (await db.prepare(
      `SELECT id, room, content, user_id, created_at FROM history
       WHERE room = ? AND content LIKE ? ORDER BY created_at DESC LIMIT ?`
    ).bind(room, `%${query}%`, MAX_HISTORY).all<HistoryItem>()).results;
  }

  return (await db.prepare(
    `SELECT id, room, content, user_id, created_at FROM history
     WHERE room = ? ORDER BY created_at DESC LIMIT ?`
  ).bind(room, MAX_HISTORY).all<HistoryItem>()).results;
}
