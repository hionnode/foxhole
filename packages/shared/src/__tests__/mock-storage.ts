// Mock storage adapters for both platforms — simulates local data stores

import type { SyncPayload, SyncResponse, Preset, PomodoroSession, Habit, HabitEntry, StreakFreeze, WebsiteCategory, WebsiteSetting, UserSettings, DeviceType } from '../schema';
import type { StorageAdapter } from '../sync-client';
import { mergeSessions, mergeHabits, mergeEntries, mergeStreakFreezes, mergePresets, mergeCategories, mergeWebsiteSettings, mergeUserSettings } from '../merge';
import { DEFAULT_PRESET } from '../schema';

export class MockStorageAdapter implements StorageAdapter {
  presets: Preset[] = [DEFAULT_PRESET];
  sessions: PomodoroSession[] = [];
  habits: Habit[] = [];
  entries: HabitEntry[] = [];
  streakFreezes: StreakFreeze[] = [];
  categories: WebsiteCategory[] = [];
  websiteSettings: WebsiteSetting[] = [];
  settings: UserSettings = {
    dailyGoal: 4,
    vibrationEnabled: true,
    activePresetId: 'classic',
    trackedApps: [],
  };
  lastSyncTimestamp = 0;

  constructor(
    private deviceId: string,
    private deviceType: DeviceType,
  ) {}

  async buildSyncPayload(): Promise<SyncPayload> {
    return {
      deviceId: this.deviceId,
      deviceType: this.deviceType,
      timestamp: Date.now(),
      presets: [...this.presets],
      sessions: [...this.sessions],
      habits: [...this.habits],
      entries: [...this.entries],
      streakFreezes: [...this.streakFreezes],
      categories: [...this.categories],
      websiteSettings: [...this.websiteSettings],
      settings: { ...this.settings },
    };
  }

  async applySyncResponse(response: SyncResponse): Promise<void> {
    // Server response is authoritative — replace local with merged server state
    this.presets = response.presets;
    this.sessions = mergeSessions(this.sessions, response.sessions);
    this.habits = mergeHabits(this.habits, response.habits);
    this.entries = mergeEntries(this.entries, response.entries);
    this.streakFreezes = mergeStreakFreezes(this.streakFreezes, response.streakFreezes);
    this.categories = mergeCategories(this.categories, response.categories);
    this.websiteSettings = mergeWebsiteSettings(this.websiteSettings, response.websiteSettings);
    this.settings = response.settings;
  }

  async getLastSyncTimestamp(): Promise<number> {
    return this.lastSyncTimestamp;
  }

  async setLastSyncTimestamp(ts: number): Promise<void> {
    this.lastSyncTimestamp = ts;
  }

  // ============ Test Helpers ============

  addHabit(name: string, type: 'binary' | 'count' = 'binary', target = 1): Habit {
    const habit: Habit = {
      id: `habit-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name,
      type,
      target,
      createdAt: formatDate(new Date()),
      deletedAt: null,
    };
    this.habits.push(habit);
    return habit;
  }

  completeHabit(habitId: string, date?: string): void {
    const d = date || formatDate(new Date());
    this.entries.push({ habitId, date: d, completed: true, value: 1 });
  }

  logWorkSession(presetName = 'classic', durationMs = 25 * 60 * 1000): PomodoroSession {
    const now = Date.now();
    const session: PomodoroSession = {
      id: `${this.deviceType}-${now}-${Math.random().toString(36).substr(2, 6)}`,
      sessionType: 'work',
      presetName,
      plannedDurationMs: durationMs,
      actualDurationMs: durationMs,
      startedAt: now - durationMs,
      completedAt: now,
      wasCompleted: true,
      wasSkipped: false,
      deviceType: this.deviceType,
      deviceId: this.deviceId,
    };
    this.sessions.push(session);
    return session;
  }

  addFreeze(habitId: string, date: string): void {
    this.streakFreezes.push({ habitId, date });
  }
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
