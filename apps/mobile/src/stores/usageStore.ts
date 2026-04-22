import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { mmkvJSONStorage } from './mmkv';
import type { TrackedApp, AppUsageData } from '@/types';
import {
  isUsageAccessGranted,
  getUsageStats,
} from '@/native/UsageStats';
import { getStartOfDay, getEndOfDay } from '@/utils/date';

const DEFAULT_TRACKED_APPS: TrackedApp[] = [
  { packageName: 'com.instagram.android', label: 'instagram', enabled: true },
  { packageName: 'com.zhiliaoapp.musically', label: 'tiktok', enabled: true },
  { packageName: 'com.snapchat.android', label: 'snapchat', enabled: true },
  { packageName: 'com.google.android.youtube', label: 'youtube', enabled: true },
  { packageName: 'com.twitter.android', label: 'twitter', enabled: true },
  { packageName: 'com.reddit.frontpage', label: 'reddit', enabled: true },
  { packageName: 'com.facebook.katana', label: 'facebook', enabled: true },
];

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

        const todayStart = getStartOfDay();
        const now = Date.now();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStart = getStartOfDay(yesterday);
        const yesterdayEnd = getEndOfDay(yesterday);

        const [todayResult, yesterdayResult] = await Promise.allSettled([
          getUsageStats(enabledPackages, todayStart, now),
          getUsageStats(enabledPackages, yesterdayStart, yesterdayEnd),
        ]);

        if (todayResult.status === 'rejected') {
          if (__DEV__) console.warn('[foxhole] usage refresh failed:', todayResult.reason);
          return;
        }

        const appLabelMap = new Map(
          trackedApps.map((a) => [a.packageName, a.label]),
        );
        const todayUsage: AppUsageData[] = todayResult.value
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

        const yesterdayTotalMs =
          yesterdayResult.status === 'fulfilled'
            ? yesterdayResult.value.reduce(
                (sum, item) => sum + item.foregroundTimeMs,
                0,
              )
            : null;

        set({ todayUsage, yesterdayTotalMs, totalTimeMs, totalOpens });
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
      storage: mmkvJSONStorage,
      partialize: (state) => ({
        trackedApps: state.trackedApps,
        usageAccessGranted: state.usageAccessGranted,
      }),
    },
  ),
);
