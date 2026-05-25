DROP TABLE IF EXISTS history;

CREATE TABLE IF NOT EXISTS history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room TEXT NOT NULL,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  pinned INTEGER DEFAULT 0,
  preserved INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_history_room_hash ON history(room, content_hash);
CREATE INDEX IF NOT EXISTS idx_history_room_order ON history(room, pinned DESC, updated_at DESC);
