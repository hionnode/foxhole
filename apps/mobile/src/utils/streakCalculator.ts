import { storage } from '@/stores/mmkv';
import { getLocalDateString, getYesterdayString } from '@/utils/date';

export { getLocalDateString } from '@/utils/date';

interface StreakData {
  currentStreak: number;
  lastActiveDate: string;
}

const STREAK_KEY = 'streak_data';

export const getStreakData = (): StreakData => {
  const raw = storage.getString(STREAK_KEY);
  if (!raw) {
    return { currentStreak: 0, lastActiveDate: '' };
  }
  try {
    return JSON.parse(raw) as StreakData;
  } catch {
    return { currentStreak: 0, lastActiveDate: '' };
  }
};

export const updateStreakOnCompletion = (): number => {
  const today = getLocalDateString();
  const yesterday = getYesterdayString();
  const data = getStreakData();

  if (data.lastActiveDate === today) {
    return data.currentStreak;
  }

  const newStreak =
    data.lastActiveDate === yesterday ? data.currentStreak + 1 : 1;

  const newData: StreakData = { currentStreak: newStreak, lastActiveDate: today };
  storage.set(STREAK_KEY, JSON.stringify(newData));
  return newStreak;
};
