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
  getLocalDateString,
  updateStreakOnCompletion,
} from '@/utils/streakCalculator';

const getStartOfDay = (date?: Date): number => {
  const d = date ?? new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

const getEndOfDay = (date?: Date): number => {
  const d = date ?? new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
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

        // Refresh total count and all sessions
        getTotalSessionCount().then((count) => {
          set({ totalEver: count });
        });
        get().refreshAllSessions();
      })
      .catch(() => {});
  },

  refreshTodayCount: () => {
    const startOfDay = getStartOfDay();
    const endOfDay = getEndOfDay();

    getCompletedWorkSessionCountForDate(startOfDay, endOfDay)
      .then((count) => {
        set({ todayCompletedCount: count });
      })
      .catch(() => {});
  },

  refreshAllSessions: () => {
    getAllSessions()
      .then((sessions) => {
        set({ allSessions: sessions });
      })
      .catch(() => {});
  },

  recalculateStreak: () => {
    const data = getStreakData();
    const today = getLocalDateString();

    // If lastActiveDate is not today or yesterday, streak is broken
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getLocalDateString(yesterday.getTime());

    if (
      data.lastActiveDate !== today &&
      data.lastActiveDate !== yesterdayStr &&
      data.lastActiveDate !== ''
    ) {
      set({ currentStreak: 0, lastActiveDate: data.lastActiveDate });
    } else {
      set({
        currentStreak: data.currentStreak,
        lastActiveDate: data.lastActiveDate,
      });
    }
  },

  initialize: () => {
    if (get().isInitialized) {
      return;
    }

    // Load streak data from MMKV (synchronous)
    get().recalculateStreak();

    // Load today's count from DB (async)
    get().refreshTodayCount();

    // Load total session count
    getTotalSessionCount()
      .then((count) => {
        set({ totalEver: count });
      })
      .catch(() => {});

    // Load all sessions for history
    get().refreshAllSessions();

    set({ isInitialized: true });
  },
}));
