import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { storage } from './mmkv';
import type { Preset, TimerDisplayMode } from '@/types';

const MAX_PRESETS = 5;
const CLASSIC_ID = 'classic';

const CLASSIC_PRESET: Preset = {
  id: CLASSIC_ID,
  name: 'classic',
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  cyclesBeforeLongBreak: 4,
};

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

interface PresetStore {
  presets: Preset[];
  activePresetId: string;
  dailyGoal: number;
  vibrationEnabled: boolean;
  timerDisplayMode: TimerDisplayMode;

  addPreset: (preset: Omit<Preset, 'id'>) => void;
  updatePreset: (id: string, updates: Partial<Omit<Preset, 'id'>>) => void;
  deletePreset: (id: string) => void;
  setActivePreset: (id: string) => void;
  setDailyGoal: (goal: number) => void;
  setVibrationEnabled: (enabled: boolean) => void;
  setTimerDisplayMode: (mode: TimerDisplayMode) => void;
  getActivePreset: () => Preset;
}

const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
};

export const usePresetStore = create<PresetStore>()(
  persist(
    (set, get) => ({
      presets: [CLASSIC_PRESET],
      activePresetId: CLASSIC_ID,
      dailyGoal: 4,
      vibrationEnabled: true,
      timerDisplayMode: 'digital' as TimerDisplayMode,

      addPreset: (preset) => {
        const { presets } = get();
        if (presets.length >= MAX_PRESETS) {
          return;
        }
        const newPreset: Preset = {
          ...preset,
          id: generateId(),
        };
        set({ presets: [...presets, newPreset] });
      },

      updatePreset: (id, updates) => {
        const { presets } = get();
        set({
          presets: presets.map((p) =>
            p.id === id ? { ...p, ...updates } : p,
          ),
        });
      },

      deletePreset: (id) => {
        if (id === CLASSIC_ID) {
          return;
        }
        const { presets, activePresetId } = get();
        const filtered = presets.filter((p) => p.id !== id);
        set({
          presets: filtered,
          activePresetId: activePresetId === id ? CLASSIC_ID : activePresetId,
        });
      },

      setActivePreset: (id) => {
        const { presets } = get();
        const exists = presets.some((p) => p.id === id);
        if (exists) {
          set({ activePresetId: id });
        }
      },

      setDailyGoal: (goal) => {
        const clamped = Math.min(12, Math.max(1, goal));
        set({ dailyGoal: clamped });
      },

      setVibrationEnabled: (enabled) => {
        set({ vibrationEnabled: enabled });
      },

      setTimerDisplayMode: (mode) => {
        set({ timerDisplayMode: mode });
      },

      getActivePreset: () => {
        const { presets, activePresetId } = get();
        return presets.find((p) => p.id === activePresetId) ?? CLASSIC_PRESET;
      },
    }),
    {
      name: 'preset-store',
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);
