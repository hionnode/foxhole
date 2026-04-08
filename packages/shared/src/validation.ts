// Validation functions for sync payloads

import type {
  Preset,
  PomodoroSession,
  Habit,
  HabitEntry,
  StreakFreeze,
  WebsiteCategory,
  WebsiteSetting,
  UserSettings,
  SyncPayload,
} from './schema';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SESSION_TYPES = ['work', 'short_break', 'long_break'];
const HABIT_TYPES = ['binary', 'count'];
const DEVICE_TYPES = ['mobile', 'extension'];

export function validatePreset(p: unknown): p is Preset {
  if (!p || typeof p !== 'object') return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o.id === 'string' && o.id.length > 0 &&
    typeof o.name === 'string' && o.name.length > 0 &&
    typeof o.workMinutes === 'number' && o.workMinutes > 0 && o.workMinutes <= 120 &&
    typeof o.shortBreakMinutes === 'number' && o.shortBreakMinutes > 0 && o.shortBreakMinutes <= 60 &&
    typeof o.longBreakMinutes === 'number' && o.longBreakMinutes > 0 && o.longBreakMinutes <= 60 &&
    typeof o.cyclesBeforeLongBreak === 'number' && o.cyclesBeforeLongBreak >= 1 && o.cyclesBeforeLongBreak <= 12
  );
}

export function validateSession(s: unknown): s is PomodoroSession {
  if (!s || typeof s !== 'object') return false;
  const o = s as Record<string, unknown>;
  return (
    typeof o.id === 'string' && o.id.length > 0 &&
    SESSION_TYPES.includes(o.sessionType as string) &&
    typeof o.presetName === 'string' &&
    typeof o.plannedDurationMs === 'number' && o.plannedDurationMs > 0 &&
    typeof o.actualDurationMs === 'number' && o.actualDurationMs >= 0 &&
    typeof o.startedAt === 'number' && o.startedAt > 0 &&
    typeof o.completedAt === 'number' && o.completedAt >= o.startedAt &&
    typeof o.wasCompleted === 'boolean' &&
    typeof o.wasSkipped === 'boolean' &&
    DEVICE_TYPES.includes(o.deviceType as string) &&
    typeof o.deviceId === 'string'
  );
}

export function validateHabit(h: unknown): h is Habit {
  if (!h || typeof h !== 'object') return false;
  const o = h as Record<string, unknown>;
  return (
    typeof o.id === 'string' && o.id.length > 0 &&
    typeof o.name === 'string' && o.name.length > 0 && o.name.length <= 200 &&
    HABIT_TYPES.includes(o.type as string) &&
    typeof o.target === 'number' && o.target >= 1 &&
    typeof o.createdAt === 'string' && DATE_RE.test(o.createdAt) &&
    (o.deletedAt === null || (typeof o.deletedAt === 'string' && DATE_RE.test(o.deletedAt)))
  );
}

export function validateHabitEntry(e: unknown): e is HabitEntry {
  if (!e || typeof e !== 'object') return false;
  const o = e as Record<string, unknown>;
  return (
    typeof o.habitId === 'string' &&
    typeof o.date === 'string' && DATE_RE.test(o.date) &&
    typeof o.completed === 'boolean' &&
    typeof o.value === 'number' && o.value >= 0
  );
}

export function validateStreakFreeze(f: unknown): f is StreakFreeze {
  if (!f || typeof f !== 'object') return false;
  const o = f as Record<string, unknown>;
  return (
    typeof o.habitId === 'string' &&
    typeof o.date === 'string' && DATE_RE.test(o.date)
  );
}

export function validateCategory(c: unknown): c is WebsiteCategory {
  if (!c || typeof c !== 'object') return false;
  const o = c as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.color === 'string' &&
    typeof o.isDefault === 'boolean'
  );
}

export function validateWebsiteSetting(w: unknown): w is WebsiteSetting {
  if (!w || typeof w !== 'object') return false;
  const o = w as Record<string, unknown>;
  return (
    typeof o.domain === 'string' && o.domain.length > 0 &&
    (o.dailyLimitSeconds === null || (typeof o.dailyLimitSeconds === 'number' && o.dailyLimitSeconds > 0)) &&
    (o.categoryId === null || typeof o.categoryId === 'string')
  );
}

export function validateUserSettings(s: unknown): s is UserSettings {
  if (!s || typeof s !== 'object') return false;
  const o = s as Record<string, unknown>;
  return (
    typeof o.dailyGoal === 'number' && o.dailyGoal >= 1 && o.dailyGoal <= 12 &&
    typeof o.vibrationEnabled === 'boolean' &&
    typeof o.activePresetId === 'string' &&
    Array.isArray(o.trackedApps)
  );
}

export function validateSyncPayload(payload: unknown): payload is SyncPayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p.deviceId === 'string' &&
    DEVICE_TYPES.includes(p.deviceType as string) &&
    typeof p.timestamp === 'number' &&
    Array.isArray(p.presets) && (p.presets as unknown[]).every(validatePreset) &&
    Array.isArray(p.sessions) && (p.sessions as unknown[]).every(validateSession) &&
    Array.isArray(p.habits) && (p.habits as unknown[]).every(validateHabit) &&
    Array.isArray(p.entries) && (p.entries as unknown[]).every(validateHabitEntry) &&
    Array.isArray(p.streakFreezes) && (p.streakFreezes as unknown[]).every(validateStreakFreeze) &&
    Array.isArray(p.categories) && (p.categories as unknown[]).every(validateCategory) &&
    Array.isArray(p.websiteSettings) && (p.websiteSettings as unknown[]).every(validateWebsiteSetting) &&
    validateUserSettings(p.settings)
  );
}
