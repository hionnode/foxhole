import { storage } from '@/stores/mmkv';

interface StreakData {
  currentStreak: number;
  lastActiveDate: string;
}

const STREAK_KEY = 'streak_data';

export const getLocalDateString = (timestamp?: number): string => {
  const date = timestamp ? new Date(timestamp) : new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getYesterdayString = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getLocalDateString(d.getTime());
};

export const getStreakData = (): StreakData => {
  const raw = storage.getString(STREAK_KEY);
  if (!raw) {
    return { currentStreak: 0, lastActiveDate: '' };
  }
  return JSON.parse(raw) as StreakData;
};

export const updateStreakOnCompletion = (): number => {
  const today = getLocalDateString();
  const yesterday = getYesterdayString();
  const data = getStreakData();

  if (data.lastActiveDate === today) {
    return data.currentStreak;
  }

  let newStreak: number;
  if (data.lastActiveDate === yesterday) {
    newStreak = data.currentStreak + 1;
  } else {
    newStreak = 1;
  }

  const newData: StreakData = { currentStreak: newStreak, lastActiveDate: today };
  storage.set(STREAK_KEY, JSON.stringify(newData));
  return newStreak;
};
