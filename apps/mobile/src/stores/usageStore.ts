import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { storage } from './mmkv';
import type { TrackedApp, AppUsageData } from '@/types';
import {
  isUsageAccessGranted,
  getUsageStats,
} from '@/native/UsageStats';

const DEFAULT_TRACKED_APPS: TrackedApp[] = [
  { packageName: 'com.instagram.android', label: 'instagram', enabled: true },
  { packageName: 'com.zhiliaoapp.musically', label: 'tiktok', enabled: true },
  { packageName: 'com.snapchat.android', label: 'snapchat', enabled: true },
  { packageName: 'com.google.android.youtube', label: 'youtube', enabled: true },
  { packageName: 'com.twitter.android', label: 'twitter', enabled: true },
  { packageName: 'com.reddit.frontpage', label: 'reddit', enabled: true },
  { packageName: 'com.facebook.katana', label: 'facebook', enabled: true },
];

const mmkvStorage = {
  getItem: (name: string) => {
    const value = storage.getString(name);
    return value ?? null;
  },
  setItem: (name: string, value: string) => {
    storage.set(name, value);
  },
  removeItem: (name: string) => {
    storage.remove(name);
  },
};

const getStartOfDay = (date?: Date): number => {
  const d = date ?? new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

const getEndOfDay = (date?: Date): number => {
  const d = date ?? new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
};

interface UsageStore {
  // Persisted
  trackedApps: TrackedApp[];
  usageAccessGranted: boolean;

  // Ephemeral
  todayUsage: AppUsageData[];
  yesterdayTotalMs: number | null;
  totalTimeMs: number;
  totalOpens: number;

  // Actions
  checkPermission: () => Promise<void>;
  refreshUsage: () => Promise<void>;
  toggleApp: (packageName: string) => void;
}

export const useUsageStore = create<UsageStore>()(
  persist(
    (set, get) => ({
      trackedApps: DEFAULT_TRACKED_APPS,
      usageAccessGranted: false,

      todayUsage: [],
      yesterdayTotalMs: null,
      totalTimeMs: 0,
      totalOpens: 0,

      checkPermission: async () => {
        try {
          const granted = await isUsageAccessGranted();
          set({ usageAccessGranted: granted });
        } catch (e: unknown) {
          if (__DEV__) console.warn('[foxhole] usage permission check failed:', e);
        }
      },

      refreshUsage: async () => {
        const { trackedApps, usageAccessGranted } = get();
        if (!usageAccessGranted) {
          return;
        }

        const enabledPackages = trackedApps
          .filter((a) => a.enabled)
          .map((a) => a.packageName);

        if (enabledPackages.length === 0) {
          set({ todayUsage: [], yesterdayTotalMs: null, totalTimeMs: 0, totalOpens: 0 });
          return;
        }

        try {
          // Fetch today's usage
          const todayStart = getStartOfDay();
          const now = Date.now();
          const rawToday = await getUsageStats(enabledPackages, todayStart, now);

          // Map package names to labels
          const appLabelMap = new Map(
            trackedApps.map((a) => [a.packageName, a.label]),
          );
          const todayUsage: AppUsageData[] = rawToday
            .map((item) => ({
              ...item,
              label: appLabelMap.get(item.packageName) ?? item.packageName,
            }))
            .sort((a, b) => b.foregroundTimeMs - a.foregroundTimeMs);

          const totalTimeMs = todayUsage.reduce(
            (sum, item) => sum + item.foregroundTimeMs,
            0,
          );
          const totalOpens = todayUsage.reduce(
            (sum, item) => sum + item.openCount,
            0,
          );

          // Fetch yesterday's total for comparison
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStart = getStartOfDay(yesterday);
          const yesterdayEnd = getEndOfDay(yesterday);

          let yesterdayTotalMs: number | null = null;
          try {
            const rawYesterday = await getUsageStats(
              enabledPackages,
              yesterdayStart,
              yesterdayEnd,
            );
            yesterdayTotalMs = rawYesterday.reduce(
              (sum, item) => sum + item.foregroundTimeMs,
              0,
            );
          } catch {
            // Yesterday data is optional
          }

          set({ todayUsage, yesterdayTotalMs, totalTimeMs, totalOpens });
        } catch (e: unknown) {
          if (__DEV__) console.warn('[foxhole] usage refresh failed:', e);
        }
      },

      toggleApp: (packageName) => {
        const { trackedApps } = get();
        set({
          trackedApps: trackedApps.map((a) =>
            a.packageName === packageName ? { ...a, enabled: !a.enabled } : a,
          ),
        });
      },
    }),
    {
      name: 'usage-store',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        trackedApps: state.trackedApps,
        usageAccessGranted: state.usageAccessGranted,
      }),
    },
  ),
);
