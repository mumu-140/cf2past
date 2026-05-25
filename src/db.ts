export interface HistoryItem {
  id: number;
  room: string;
  content: string;
  content_hash: string;
  user_id: number;
  pinned: number;
  preserved: number;
  created_at: string;
  updated_at: string;
}

const MAX_HISTORY = 50;

async function computeHash(content: string): Promise<string> {
  const data = new TextEncoder().encode(content);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buffer)].slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function saveHistory(db: D1Database, room: string, content: string, userId: number): Promise<void> {
  if (!content.trim()) return;

  const hash = await computeHash(content);

  const existing = await db.prepare(
    'SELECT id FROM history WHERE room = ? AND content_hash = ?'
  ).bind(room, hash).first<{ id: number }>();

  if (existing) {
    await db.prepare(
      "UPDATE history SET updated_at = datetime('now'), content = ? WHERE id = ?"
    ).bind(content, existing.id).run();
    return;
  }

  await db.prepare(
    'INSERT INTO history (room, content, content_hash, user_id) VALUES (?, ?, ?, ?)'
  ).bind(room, content, hash, userId).run();

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
