import { describe, it, expect } from 'vitest';
import {
  validatePreset,
  validateSession,
  validateHabit,
  validateHabitEntry,
  validateStreakFreeze,
  validateCategory,
  validateWebsiteSetting,
  validateUserSettings,
} from '../validation';
import { DEFAULT_PRESET } from '../schema';

describe('validation', () => {
  describe('validatePreset', () => {
    it('accepts valid preset', () => {
      expect(validatePreset(DEFAULT_PRESET)).toBe(true);
    });

    it('rejects preset with zero work minutes', () => {
      expect(validatePreset({ ...DEFAULT_PRESET, workMinutes: 0 })).toBe(false);
    });

    it('rejects preset with work > 120 minutes', () => {
      expect(validatePreset({ ...DEFAULT_PRESET, workMinutes: 121 })).toBe(false);
    });

    it('rejects null', () => {
      expect(validatePreset(null)).toBe(false);
    });

    it('rejects missing name', () => {
      expect(validatePreset({ ...DEFAULT_PRESET, name: '' })).toBe(false);
    });
  });

  describe('validateSession', () => {
    const validSession = {
      id: 'pomo-123',
      sessionType: 'work',
      presetName: 'classic',
      plannedDurationMs: 1500000,
      actualDurationMs: 1500000,
      startedAt: 1712592000000,
      completedAt: 1712593500000,
      wasCompleted: true,
      wasSkipped: false,
      deviceType: 'mobile',
      deviceId: 'device-1',
    };

    it('accepts valid session', () => {
      expect(validateSession(validSession)).toBe(true);
    });

    it('rejects session with completedAt before startedAt', () => {
      expect(validateSession({ ...validSession, completedAt: 1 })).toBe(false);
    });

    it('rejects invalid session type', () => {
      expect(validateSession({ ...validSession, sessionType: 'nap' })).toBe(false);
    });

    it('rejects missing deviceType', () => {
      expect(validateSession({ ...validSession, deviceType: 'watch' })).toBe(false);
    });
  });

  describe('validateHabit', () => {
    it('accepts valid binary habit', () => {
      expect(validateHabit({
        id: 'habit-123',
        name: 'exercise',
        type: 'binary',
        target: 1,
        createdAt: '2026-04-08',
        deletedAt: null,
      })).toBe(true);
    });

    it('accepts valid count habit', () => {
      expect(validateHabit({
        id: 'habit-456',
        name: 'water',
        type: 'count',
        target: 8,
        createdAt: '2026-04-08',
        deletedAt: null,
      })).toBe(true);
    });

    it('accepts soft-deleted habit', () => {
      expect(validateHabit({
        id: 'habit-789',
        name: 'old',
        type: 'binary',
        target: 1,
        createdAt: '2026-01-01',
        deletedAt: '2026-04-08',
      })).toBe(true);
    });

    it('rejects invalid date format', () => {
      expect(validateHabit({
        id: 'habit-123',
        name: 'bad',
        type: 'binary',
        target: 1,
        createdAt: 'April 8',
        deletedAt: null,
      })).toBe(false);
    });

    it('rejects name > 200 chars', () => {
      expect(validateHabit({
        id: 'habit-123',
        name: 'x'.repeat(201),
        type: 'binary',
        target: 1,
        createdAt: '2026-04-08',
        deletedAt: null,
      })).toBe(false);
    });
  });

  describe('validateHabitEntry', () => {
    it('accepts valid entry', () => {
      expect(validateHabitEntry({
        habitId: 'habit-123',
        date: '2026-04-08',
        completed: true,
        value: 1,
      })).toBe(true);
    });

    it('rejects negative value', () => {
      expect(validateHabitEntry({
        habitId: 'habit-123',
        date: '2026-04-08',
        completed: false,
        value: -1,
      })).toBe(false);
    });
  });

  describe('validateStreakFreeze', () => {
    it('accepts valid freeze', () => {
      expect(validateStreakFreeze({ habitId: 'habit-1', date: '2026-04-05' })).toBe(true);
    });

    it('rejects invalid date', () => {
      expect(validateStreakFreeze({ habitId: 'habit-1', date: 'yesterday' })).toBe(false);
    });
  });

  describe('validateCategory', () => {
    it('accepts valid category', () => {
      expect(validateCategory({
        id: 'cat-1',
        name: 'productivity',
        color: '#4a9eff',
        isDefault: true,
      })).toBe(true);
    });
  });

  describe('validateWebsiteSetting', () => {
    it('accepts setting with limit', () => {
      expect(validateWebsiteSetting({
        domain: 'twitter.com',
        dailyLimitSeconds: 1800,
        categoryId: 'cat-3',
      })).toBe(true);
    });

    it('accepts setting with null limit', () => {
      expect(validateWebsiteSetting({
        domain: 'github.com',
        dailyLimitSeconds: null,
        categoryId: 'cat-2',
      })).toBe(true);
    });

    it('rejects empty domain', () => {
      expect(validateWebsiteSetting({
        domain: '',
        dailyLimitSeconds: null,
        categoryId: null,
      })).toBe(false);
    });
  });

  describe('validateUserSettings', () => {
    it('accepts valid settings', () => {
      expect(validateUserSettings({
        dailyGoal: 4,
        vibrationEnabled: true,
        activePresetId: 'classic',
        trackedApps: [],
      })).toBe(true);
    });

    it('rejects dailyGoal > 12', () => {
      expect(validateUserSettings({
        dailyGoal: 13,
        vibrationEnabled: true,
        activePresetId: 'classic',
        trackedApps: [],
      })).toBe(false);
    });
  });
});
