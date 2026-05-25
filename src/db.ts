export interface HistoryItem {
  id: number;
  room: string;
  content: string;
  user_id: number;
  pinned: number;
  preserved: number;
  created_at: string;
  updated_at: string;
}

const MAX_HISTORY = 50;

export async function saveHistory(db: D1Database, room: string, content: string, userId: number, entryId: number | null): Promise<number> {
  if (!content.trim()) return entryId || 0;

  // 有 entryId → UPDATE 当前条目
  if (entryId) {
    await db.prepare(
      "UPDATE history SET content = ?, updated_at = datetime('now') WHERE id = ? AND room = ?"
    ).bind(content, entryId, room).run();
    return entryId;
  }

  // 无 entryId → INSERT 新条目
  const result = await db.prepare(
    'INSERT INTO history (room, content, user_id) VALUES (?, ?, ?)'
  ).bind(room, content, userId).run();

  const newId = result.meta.last_row_id as number;

  // 清理超出上限的旧记录（不清理 pinned/preserved）
  const count = await db.prepare(
    'SELECT COUNT(*) as c FROM history WHERE room = ? AND preserved = 0 AND pinned = 0'
  ).bind(room).first<{ c: number }>();

  if (count && count.c > MAX_HISTORY) {
    await db.prepare(
      `DELETE FROM history WHERE id IN (
        SELECT id FROM history WHERE room = ? AND preserved = 0 AND pinned = 0
        ORDER BY updated_at ASC LIMIT ?
      )`
    ).bind(room, count.c - MAX_HISTORY).run();
  }

  return newId;
}

export async function getHistory(db: D1Database, room: string, query: string): Promise<HistoryItem[]> {
  if (query) {
    return (await db.prepare(
      `SELECT * FROM history WHERE room = ? AND content LIKE ?
       ORDER BY pinned DESC, updated_at DESC LIMIT 100`
    ).bind(room, `%${query}%`).all<HistoryItem>()).results;
  }

  return (await db.prepare(
    `SELECT * FROM history WHERE room = ?
     ORDER BY pinned DESC, updated_at DESC LIMIT 100`
  ).bind(room).all<HistoryItem>()).results;
}

export async function deleteHistory(db: D1Database, id: number, room: string): Promise<void> {
  await db.prepare('DELETE FROM history WHERE id = ? AND room = ?').bind(id, room).run();
}

export async function togglePin(db: D1Database, id: number, room: string): Promise<void> {
  await db.prepare(
    "UPDATE history SET pinned = CASE WHEN pinned = 0 THEN 1 ELSE 0 END, updated_at = datetime('now') WHERE id = ? AND room = ?"
  ).bind(id, room).run();
}

export async function togglePreserve(db: D1Database, id: number, room: string): Promise<void> {
  await db.prepare(
    "UPDATE history SET preserved = CASE WHEN preserved = 0 THEN 1 ELSE 0 END WHERE id = ? AND room = ?"
  ).bind(id, room).run();
}
