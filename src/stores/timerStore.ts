import { create } from 'zustand';
import { PomodoroState, Preset } from '@/types';
import {
  createInitialState,
  tick,
  complete,
  skip as skipEngine,
  abandon as abandonEngine,
  pause as pauseEngine,
  resume as resumeEngine,
  getSessionDurationMs,
} from '@/utils/pomodoroEngine';

interface TimerStore {
  state: PomodoroState | null;
  activePreset: Preset | null;
  intervalId: ReturnType<typeof setInterval> | null;
  lastTickTime: number | null;
  showingTransition: boolean;
  transitionTimeoutId: ReturnType<typeof setTimeout> | null;

  startSession: (preset: Preset) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  abandonSession: () => void;
  skipSession: () => void;
  completeSession: () => void;
  tickTimer: () => void;
  startNextSession: () => void;
  reset: () => void;
}

export const useTimerStore = create<TimerStore>((set, get) => ({
  state: null,
  activePreset: null,
  intervalId: null,
  lastTickTime: null,
  showingTransition: false,
  transitionTimeoutId: null,

  startSession: (preset: Preset) => {
    const { intervalId, transitionTimeoutId } = get();
    if (intervalId) {
      clearInterval(intervalId);
    }
    if (transitionTimeoutId) {
      clearTimeout(transitionTimeoutId);
    }

    const initialState = createInitialState(preset);
    const now = Date.now();
    const newIntervalId = setInterval(() => get().tickTimer(), 100);

    set({
      state: initialState,
      activePreset: preset,
      intervalId: newIntervalId,
      lastTickTime: now,
      showingTransition: false,
      transitionTimeoutId: null,
    });
  },

  pauseSession: () => {
    const { state, intervalId } = get();
    if (!state || !state.isRunning || state.isPaused) {
      return;
    }
    if (intervalId) {
      clearInterval(intervalId);
    }
    set({
      state: pauseEngine(state),
      intervalId: null,
      lastTickTime: null,
    });
  },

  resumeSession: () => {
    const { state } = get();
    if (!state || !state.isPaused) {
      return;
    }
    const now = Date.now();
    const newIntervalId = setInterval(() => get().tickTimer(), 100);

    set({
      state: resumeEngine(state),
      intervalId: newIntervalId,
      lastTickTime: now,
    });
  },

  abandonSession: () => {
    const { state, intervalId, transitionTimeoutId } = get();
    if (!state) {
      return;
    }
    if (intervalId) {
      clearInterval(intervalId);
    }
    if (transitionTimeoutId) {
      clearTimeout(transitionTimeoutId);
    }
    set({
      state: abandonEngine(state),
      intervalId: null,
      lastTickTime: null,
      showingTransition: false,
      transitionTimeoutId: null,
    });
  },

  skipSession: () => {
    const { state, activePreset, intervalId } = get();
    if (!state || !activePreset) {
      return;
    }
    if (intervalId) {
      clearInterval(intervalId);
    }

    const nextState = skipEngine(state, activePreset);
    const now = Date.now();
    const newIntervalId = setInterval(() => get().tickTimer(), 100);

    set({
      state: nextState,
      intervalId: newIntervalId,
      lastTickTime: now,
      showingTransition: false,
      transitionTimeoutId: null,
    });
  },

  completeSession: () => {
    const { state, activePreset, intervalId } = get();
    if (!state || !activePreset) {
      return;
    }
    if (intervalId) {
      clearInterval(intervalId);
    }

    // TODO: trigger completion sound here when FocusService is implemented (Phase 2)

    const nextState = complete(state, activePreset);

    const timeoutId = setTimeout(() => {
      get().startNextSession();
    }, 3000);

    set({
      state: nextState,
      intervalId: null,
      lastTickTime: null,
      showingTransition: true,
      transitionTimeoutId: timeoutId,
    });
  },

  startNextSession: () => {
    const { state, activePreset } = get();
    if (!state || !activePreset) {
      return;
    }

    const now = Date.now();
    const newIntervalId = setInterval(() => get().tickTimer(), 100);

    set({
      state: {
        ...state,
        isRunning: true,
        isPaused: false,
      },
      intervalId: newIntervalId,
      lastTickTime: now,
      showingTransition: false,
      transitionTimeoutId: null,
    });
  },

  tickTimer: () => {
    const { state, lastTickTime } = get();
    if (!state || !state.isRunning || state.isPaused || !lastTickTime) {
      return;
    }

    const now = Date.now();
    const elapsed = now - lastTickTime;
    const newState = tick(state, elapsed);

    if (newState.remainingMs <= 0) {
      set({ lastTickTime: now });
      get().completeSession();
      return;
    }

    set({
      state: newState,
      lastTickTime: now,
    });
  },

  reset: () => {
    const { intervalId, transitionTimeoutId } = get();
    if (intervalId) {
      clearInterval(intervalId);
    }
    if (transitionTimeoutId) {
      clearTimeout(transitionTimeoutId);
    }
    set({
      state: null,
      activePreset: null,
      intervalId: null,
      lastTickTime: null,
      showingTransition: false,
      transitionTimeoutId: null,
    });
  },
}));
