-- Megaball Neo global leaderboard
CREATE TABLE IF NOT EXISTS scores (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  score      INTEGER NOT NULL,
  round      INTEGER NOT NULL,
  platform   TEXT    NOT NULL DEFAULT 'web',
  ip_hash    TEXT    NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scores_score ON scores (score DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_scores_ip ON scores (ip_hash, created_at);
