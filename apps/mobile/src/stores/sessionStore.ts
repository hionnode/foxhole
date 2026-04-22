import { create } from 'zustand';
import type { Session } from '@/types';
import {
  insertSession,
  getCompletedWorkSessionCountForDate,
  getAllSessions,
  getTotalSessionCount,
} from '@/db/queries';
import {
  getStreakData,
  updateStreakOnCompletion,
} from '@/utils/streakCalculator';
import {
  getStartOfDay,
  getEndOfDay,
  getLocalDateString,
} from '@/utils/date';
import { storage } from './mmkv';

const LAST_REFRESH_DATE_KEY = 'last_refresh_date';

const warnDev = (e: unknown): void => {
  if (__DEV__) console.warn('[foxhole]', e);
};

interface SessionStore {
  todayCompletedCount: number;
  currentStreak: number;
  lastActiveDate: string;
  totalEver: number;
  allSessions: Session[];
  isInitialized: boolean;

  logSession: (session: Omit<Session, 'id'>) => void;
  refreshTodayCount: () => void;
  refreshAllSessions: () => void;
  recalculateStreak: () => void;
  initialize: () => void;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  todayCompletedCount: 0,
  currentStreak: 0,
  lastActiveDate: '',
  totalEver: 0,
  allSessions: [],
  isInitialized: false,

  logSession: (session) => {
    insertSession(session)
      .then(() => {
        const isCompletedWork =
          session.wasCompleted && session.sessionType === 'work';

        if (isCompletedWork) {
          const newStreak = updateStreakOnCompletion();
          set((state) => ({
            todayCompletedCount: state.todayCompletedCount + 1,
            currentStreak: newStreak,
            lastActiveDate: getLocalDateString(),
          }));
        }

        getTotalSessionCount().then((count) => {
          set({ totalEver: count });
        });
        get().refreshAllSessions();
      })
      .catch(warnDev);
  },

  refreshTodayCount: () => {
    const startOfDay = getStartOfDay();
    const endOfDay = getEndOfDay();
    storage.set(LAST_REFRESH_DATE_KEY, getLocalDateString());

    getCompletedWorkSessionCountForDate(startOfDay, endOfDay)
      .then((count) => {
        set({ todayCompletedCount: count });
      })
      .catch(warnDev);
  },

  refreshAllSessions: () => {
    getAllSessions()
      .then((sessions) => {
        set({ allSessions: sessions });
      })
      .catch(warnDev);
  },

  recalculateStreak: () => {
    const data = getStreakData();
    const today = getLocalDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getLocalDateString(yesterday.getTime());

    const isStale =
      data.lastActiveDate !== today &&
      data.lastActiveDate !== yesterdayStr &&
      data.lastActiveDate !== '';

    set({
      currentStreak: isStale ? 0 : data.currentStreak,
      lastActiveDate: data.lastActiveDate,
    });
  },

  initialize: () => {
    if (get().isInitialized) {
      return;
    }

    const today = getLocalDateString();
    const lastRefresh = storage.getString(LAST_REFRESH_DATE_KEY);
    if (lastRefresh !== today) {
      storage.set(LAST_REFRESH_DATE_KEY, today);
    }

    get().recalculateStreak();
    get().refreshTodayCount();
    get().refreshAllSessions();

    getTotalSessionCount()
      .then((count) => {
        set({ totalEver: count });
      })
      .catch(warnDev);

    set({ isInitialized: true });
  },
}));
