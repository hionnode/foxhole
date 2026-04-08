// Foxhole Unified Schema
// Shared types across mobile app, Chrome extension, and backend API.
// All timestamps are Unix milliseconds. All dates are 'YYYY-MM-DD'.

// ============ Core Enums ============

export type SessionType = 'work' | 'short_break' | 'long_break';
export type HabitType = 'binary' | 'count';
export type DeviceType = 'mobile' | 'extension';

// ============ Preset ============

export interface Preset {
  id: string;
  name: string;
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  cyclesBeforeLongBreak: number;
}

export const DEFAULT_PRESET: Preset = {
  id: 'classic',
  name: 'classic',
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  cyclesBeforeLongBreak: 4,
};

// ============ Pomodoro Session ============

export interface PomodoroSession {
  id: string;
  sessionType: SessionType;
  presetName: string;
  plannedDurationMs: number;
  actualDurationMs: number;
  startedAt: number;       // Unix ms
  completedAt: number;     // Unix ms
  wasCompleted: boolean;
  wasSkipped: boolean;
  deviceType: DeviceType;
  deviceId: string;
}

// ============ Habit ============

export interface Habit {
  id: string;
  name: string;
  type: HabitType;
  target: number;
  createdAt: string;       // 'YYYY-MM-DD'
  deletedAt: string | null; // soft delete for sync
}

// ============ Habit Entry ============

export interface HabitEntry {
  habitId: string;
  date: string;            // 'YYYY-MM-DD'
  completed: boolean;
  value: number;
}

// ============ Streak Freeze ============

export interface StreakFreeze {
  habitId: string;
  date: string;            // 'YYYY-MM-DD'
}

// ============ Website Category ============

export interface WebsiteCategory {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
}

// ============ Website Setting ============

export interface WebsiteSetting {
  domain: string;
  dailyLimitSeconds: number | null;
  categoryId: string | null;
}

// ============ Website Usage (device-local, not synced) ============

export interface WebsiteUsageEntry {
  domain: string;
  date: string;            // 'YYYY-MM-DD'
  totalSeconds: number;
  favicon: string | null;
}

// ============ App Usage (device-local, not synced) ============

export interface AppUsageEntry {
  packageName: string;
  label: string;
  date: string;            // 'YYYY-MM-DD'
  foregroundTimeMs: number;
  openCount: number;
}

// ============ User Settings ============

export interface UserSettings {
  dailyGoal: number;
  vibrationEnabled: boolean;
  activePresetId: string;
  trackedApps: TrackedApp[];
}

export interface TrackedApp {
  packageName: string;
  label: string;
  enabled: boolean;
}

// ============ Streak Metadata (computed checkpoint) ============

export interface StreakMetadata {
  currentStreak: number;
  lastActiveDate: string;  // 'YYYY-MM-DD'
}

// ============ Sync Envelope ============

export interface SyncPayload {
  deviceId: string;
  deviceType: DeviceType;
  timestamp: number;       // Unix ms when sync was initiated
  presets: Preset[];
  sessions: PomodoroSession[];
  habits: Habit[];
  entries: HabitEntry[];
  streakFreezes: StreakFreeze[];
  categories: WebsiteCategory[];
  websiteSettings: WebsiteSetting[];
  settings: UserSettings;
}

export interface SyncResponse {
  serverTimestamp: number;
  presets: Preset[];
  sessions: PomodoroSession[];
  habits: Habit[];
  entries: HabitEntry[];
  streakFreezes: StreakFreeze[];
  categories: WebsiteCategory[];
  websiteSettings: WebsiteSetting[];
  settings: UserSettings;
  conflicts: SyncConflict[];
}

export interface SyncConflict {
  entity: string;
  entityId: string;
  field: string;
  localValue: unknown;
  serverValue: unknown;
  resolution: 'local_wins' | 'server_wins' | 'manual';
}
