import { open } from '@op-engineering/op-sqlite';

const db = open({ name: 'foxhole.db' });

db.executeSync(`
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_type TEXT NOT NULL,
    preset_name TEXT NOT NULL,
    planned_duration_ms INTEGER NOT NULL,
    actual_duration_ms INTEGER NOT NULL,
    started_at INTEGER NOT NULL,
    completed_at INTEGER NOT NULL,
    was_completed INTEGER NOT NULL DEFAULT 0,
    was_skipped INTEGER NOT NULL DEFAULT 0
  )
`);

db.executeSync(
  'CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at)',
);

db.executeSync(
  'CREATE INDEX IF NOT EXISTS idx_sessions_was_completed ON sessions(was_completed)',
);

export { db };
