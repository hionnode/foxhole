// Merge logic for syncing data between devices.
// Sessions are append-only (no conflicts). Habits/presets use last-write-wins.

import type {
  PomodoroSession,
  Habit,
  HabitEntry,
  StreakFreeze,
  Preset,
  WebsiteCategory,
  WebsiteSetting,
  UserSettings,
  SyncConflict,
} from './schema';

// Merge sessions: union by id (sessions are immutable logs)
export function mergeSessions(local: PomodoroSession[], remote: PomodoroSession[]): PomodoroSession[] {
  const map = new Map<string, PomodoroSession>();
  for (const s of local) map.set(s.id, s);
  for (const s of remote) {
    if (!map.has(s.id)) map.set(s.id, s);
  }
  return Array.from(map.values()).sort((a, b) => b.startedAt - a.startedAt);
}

// Merge habits: union by id, prefer non-deleted, later createdAt wins on conflict
export function mergeHabits(local: Habit[], remote: Habit[]): Habit[] {
  const map = new Map<string, Habit>();
  for (const h of local) map.set(h.id, h);
  for (const h of remote) {
    const existing = map.get(h.id);
    if (!existing) {
      map.set(h.id, h);
    } else {
      // If one is deleted and the other isn't, keep the deleted state
      // (soft delete propagates)
      if (h.deletedAt && !existing.deletedAt) {
        map.set(h.id, h);
      }
    }
  }
  return Array.from(map.values());
}

// Merge habit entries: union by habitId+date, last value wins
export function mergeEntries(local: HabitEntry[], remote: HabitEntry[]): HabitEntry[] {
  const map = new Map<string, HabitEntry>();
  for (const e of local) map.set(`${e.habitId}:${e.date}`, e);
  for (const e of remote) {
    const key = `${e.habitId}:${e.date}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, e);
    } else {
      // Prefer completed=true over false (optimistic merge)
      if (e.completed && !existing.completed) {
        map.set(key, e);
      } else if (e.value > existing.value) {
        map.set(key, e);
      }
    }
  }
  return Array.from(map.values());
}

// Merge streak freezes: union (freezes are additive)
export function mergeStreakFreezes(local: StreakFreeze[], remote: StreakFreeze[]): StreakFreeze[] {
  const set = new Set<string>();
  const result: StreakFreeze[] = [];
  for (const f of [...local, ...remote]) {
    const key = `${f.habitId}:${f.date}`;
    if (!set.has(key)) {
      set.add(key);
      result.push(f);
    }
  }
  return result;
}

// Merge presets: union by id, remote wins on field conflicts
export function mergePresets(local: Preset[], remote: Preset[]): { merged: Preset[]; conflicts: SyncConflict[] } {
  const conflicts: SyncConflict[] = [];
  const map = new Map<string, Preset>();

  for (const p of local) map.set(p.id, p);

  for (const p of remote) {
    const existing = map.get(p.id);
    if (!existing) {
      map.set(p.id, p);
    } else {
      // Check for field-level conflicts
      if (existing.name !== p.name || existing.workMinutes !== p.workMinutes) {
        conflicts.push({
          entity: 'preset',
          entityId: p.id,
          field: 'all',
          localValue: existing,
          serverValue: p,
          resolution: 'server_wins',
        });
      }
      // Server wins
      map.set(p.id, p);
    }
  }

  return { merged: Array.from(map.values()), conflicts };
}

// Merge categories: union by id, remote wins
export function mergeCategories(local: WebsiteCategory[], remote: WebsiteCategory[]): WebsiteCategory[] {
  const map = new Map<string, WebsiteCategory>();
  for (const c of local) map.set(c.id, c);
  for (const c of remote) map.set(c.id, c);
  return Array.from(map.values());
}

// Merge website settings: union by domain, remote wins
export function mergeWebsiteSettings(local: WebsiteSetting[], remote: WebsiteSetting[]): WebsiteSetting[] {
  const map = new Map<string, WebsiteSetting>();
  for (const s of local) map.set(s.domain, s);
  for (const s of remote) map.set(s.domain, s);
  return Array.from(map.values());
}

// Merge user settings: remote wins (last-write-wins)
export function mergeUserSettings(local: UserSettings, remote: UserSettings): UserSettings {
  return { ...remote };
}
