// Adapters to convert between platform-local formats and the unified sync schema.
// Each platform (mobile, extension) stores data differently — these normalize it.

import type {
  PomodoroSession,
  Habit,
  HabitEntry,
  StreakFreeze,
  WebsiteCategory,
  WebsiteSetting,
  SyncPayload,
  DeviceType,
  Preset,
  UserSettings,
} from './schema';

// ============ Mobile Adapter ============
// Converts mobile app's SQLite + MMKV formats to sync schema

export interface MobileSession {
  id: number;
  sessionType: string;
  presetName: string;
  plannedDurationMs: number;
  actualDurationMs: number;
  startedAt: number;
  completedAt: number;
  wasCompleted: boolean;
  wasSkipped: boolean;
}

export function mobileSessionToSync(s: MobileSession, deviceId: string): PomodoroSession {
  return {
    id: `mobile-${s.id}`,
    sessionType: s.sessionType as PomodoroSession['sessionType'],
    presetName: s.presetName,
    plannedDurationMs: s.plannedDurationMs,
    actualDurationMs: s.actualDurationMs,
    startedAt: s.startedAt,
    completedAt: s.completedAt,
    wasCompleted: s.wasCompleted,
    wasSkipped: s.wasSkipped,
    deviceType: 'mobile',
    deviceId,
  };
}

// ============ Extension Adapter ============
// Converts extension's chrome.storage.local formats to sync schema

export interface ExtensionSession {
  id: string;
  sessionType: string;
  presetName: string;
  durationSeconds: number;
  completedAt: number;
  wasCompleted: boolean;
  wasSkipped: boolean;
}

export function extensionSessionToSync(s: ExtensionSession, deviceId: string): PomodoroSession {
  return {
    id: s.id,
    sessionType: s.sessionType as PomodoroSession['sessionType'],
    presetName: s.presetName,
    plannedDurationMs: s.durationSeconds * 1000,
    actualDurationMs: s.durationSeconds * 1000,
    startedAt: s.completedAt - s.durationSeconds * 1000,
    completedAt: s.completedAt,
    wasCompleted: s.wasCompleted,
    wasSkipped: s.wasSkipped,
    deviceType: 'extension',
    deviceId,
  };
}

// Convert extension's date-keyed habit entries to flat array
export function extensionEntriesToSync(
  entries: Record<string, Record<string, { completed: boolean; value: number }>>,
): HabitEntry[] {
  const result: HabitEntry[] = [];
  for (const [date, habitEntries] of Object.entries(entries)) {
    for (const [habitId, entry] of Object.entries(habitEntries)) {
      result.push({
        habitId,
        date,
        completed: entry.completed,
        value: entry.value,
      });
    }
  }
  return result;
}

// Convert flat habit entries back to extension's date-keyed format
export function syncEntriesToExtension(
  entries: HabitEntry[],
): Record<string, Record<string, { completed: boolean; value: number }>> {
  const result: Record<string, Record<string, { completed: boolean; value: number }>> = {};
  for (const e of entries) {
    if (!result[e.date]) result[e.date] = {};
    result[e.date][e.habitId] = { completed: e.completed, value: e.value };
  }
  return result;
}

// Convert extension's habitId-keyed streak freezes to flat array
export function extensionFreezesToSync(
  freezes: Record<string, string[]>,
): StreakFreeze[] {
  const result: StreakFreeze[] = [];
  for (const [habitId, dates] of Object.entries(freezes)) {
    for (const date of dates) {
      result.push({ habitId, date });
    }
  }
  return result;
}

// Convert flat streak freezes back to extension's format
export function syncFreezesToExtension(
  freezes: StreakFreeze[],
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const f of freezes) {
    if (!result[f.habitId]) result[f.habitId] = [];
    if (!result[f.habitId].includes(f.date)) {
      result[f.habitId].push(f.date);
    }
  }
  return result;
}

// Convert extension's date-keyed sessions to flat array
export function extensionSessionsToSync(
  sessions: Record<string, ExtensionSession[]>,
  deviceId: string,
): PomodoroSession[] {
  const result: PomodoroSession[] = [];
  for (const daySessions of Object.values(sessions)) {
    for (const s of daySessions) {
      result.push(extensionSessionToSync(s, deviceId));
    }
  }
  return result;
}

// Convert extension's domain-keyed website settings to flat array
export function extensionWebsiteSettingsToSync(
  settings: Record<string, { dailyLimitSeconds?: number | null; categoryId?: string | null }>,
): WebsiteSetting[] {
  return Object.entries(settings).map(([domain, s]) => ({
    domain,
    dailyLimitSeconds: s.dailyLimitSeconds ?? null,
    categoryId: s.categoryId ?? null,
  }));
}

// Convert flat website settings back to extension's format
export function syncWebsiteSettingsToExtension(
  settings: WebsiteSetting[],
): Record<string, { dailyLimitSeconds: number | null; categoryId: string | null }> {
  const result: Record<string, { dailyLimitSeconds: number | null; categoryId: string | null }> = {};
  for (const s of settings) {
    result[s.domain] = {
      dailyLimitSeconds: s.dailyLimitSeconds,
      categoryId: s.categoryId,
    };
  }
  return result;
}

// Add soft-delete field to extension habits (extension doesn't have deletedAt)
export function extensionHabitToSync(h: { id: string; name: string; type: string; target: number; createdAt: string }): Habit {
  return {
    id: h.id,
    name: h.name,
    type: h.type as Habit['type'],
    target: h.target,
    createdAt: h.createdAt,
    deletedAt: null,
  };
}

// ============ Full Payload Builders ============

export interface ExtensionLocalData {
  habits: Array<{ id: string; name: string; type: string; target: number; createdAt: string }>;
  entries: Record<string, Record<string, { completed: boolean; value: number }>>;
  streakFreezes: Record<string, string[]>;
  pomodoroSessions: Record<string, ExtensionSession[]>;
  websiteCategories: WebsiteCategory[];
  websiteSettings: Record<string, { dailyLimitSeconds?: number | null; categoryId?: string | null }>;
  presets?: Preset[];
  settings?: UserSettings;
}

export function buildExtensionSyncPayload(
  data: ExtensionLocalData,
  deviceId: string,
): SyncPayload {
  return {
    deviceId,
    deviceType: 'extension',
    timestamp: Date.now(),
    presets: data.presets || [],
    sessions: extensionSessionsToSync(data.pomodoroSessions, deviceId),
    habits: data.habits.map(extensionHabitToSync),
    entries: extensionEntriesToSync(data.entries),
    streakFreezes: extensionFreezesToSync(data.streakFreezes),
    categories: data.websiteCategories,
    websiteSettings: extensionWebsiteSettingsToSync(data.websiteSettings),
    settings: data.settings || {
      dailyGoal: 4,
      vibrationEnabled: true,
      activePresetId: 'classic',
      trackedApps: [],
    },
  };
}

export interface MobileLocalData {
  presets: Preset[];
  sessions: MobileSession[];
  settings: UserSettings;
}

export function buildMobileSyncPayload(
  data: MobileLocalData,
  deviceId: string,
): Omit<SyncPayload, 'habits' | 'entries' | 'streakFreezes' | 'categories' | 'websiteSettings'> {
  return {
    deviceId,
    deviceType: 'mobile',
    timestamp: Date.now(),
    presets: data.presets,
    sessions: data.sessions.map(s => mobileSessionToSync(s, deviceId)),
    settings: data.settings,
  };
}
