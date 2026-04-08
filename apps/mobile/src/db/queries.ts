import { db } from './index';
import type { QueryResult } from '@op-engineering/op-sqlite';
import type { Session, SessionType } from '@/types';

const mapRow = (row: Record<string, unknown>): Session => ({
  id: row.id as number,
  sessionType: row.session_type as SessionType,
  presetName: row.preset_name as string,
  plannedDurationMs: row.planned_duration_ms as number,
  actualDurationMs: row.actual_duration_ms as number,
  startedAt: row.started_at as number,
  completedAt: row.completed_at as number,
  wasCompleted: (row.was_completed as number) === 1,
  wasSkipped: (row.was_skipped as number) === 1,
});

const mapResultRows = (result: QueryResult): Session[] =>
  (result.rows as unknown as Record<string, unknown>[]).map(mapRow);

export const insertSession = async (
  session: Omit<Session, 'id'>,
): Promise<void> => {
  await db.execute(
    `INSERT INTO sessions (session_type, preset_name, planned_duration_ms, actual_duration_ms, started_at, completed_at, was_completed, was_skipped)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      session.sessionType,
      session.presetName,
      session.plannedDurationMs,
      session.actualDurationMs,
      session.startedAt,
      session.completedAt,
      session.wasCompleted ? 1 : 0,
      session.wasSkipped ? 1 : 0,
    ],
  );
};

export const getSessionsByDateRange = async (
  startOfDayMs: number,
  endOfDayMs: number,
): Promise<Session[]> => {
  const result = await db.execute(
    'SELECT * FROM sessions WHERE started_at >= ? AND started_at < ? ORDER BY started_at DESC',
    [startOfDayMs, endOfDayMs],
  );
  return mapResultRows(result);
};

export const getCompletedWorkSessionCountForDate = async (
  startOfDayMs: number,
  endOfDayMs: number,
): Promise<number> => {
  const result = await db.execute(
    "SELECT COUNT(*) as count FROM sessions WHERE started_at >= ? AND started_at < ? AND was_completed = 1 AND session_type = 'work'",
    [startOfDayMs, endOfDayMs],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return (row?.count as number) ?? 0;
};

export const getAllSessions = async (): Promise<Session[]> => {
  const result = await db.execute(
    'SELECT * FROM sessions ORDER BY started_at DESC',
  );
  return mapResultRows(result);
};

export const getTotalSessionCount = async (): Promise<number> => {
  const result = await db.execute('SELECT COUNT(*) as count FROM sessions');
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return (row?.count as number) ?? 0;
};
