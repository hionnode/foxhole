import { create } from 'zustand';
import { PomodoroState, Preset, SessionType } from '@/types';
import {
  createInitialState,
  complete,
  skip as skipEngine,
  abandon as abandonEngine,
  pause as pauseEngine,
  resume as resumeEngine,
  getSessionDurationMs,
} from '@/utils/pomodoroEngine';
import {
  startFocusService,
  stopFocusService,
  getRemainingTime,
} from '@/native/FocusService';
import { enableDnd, disableDnd } from '@/native/DndManager';
import { useSessionStore } from './sessionStore';

const warnDev = (e: unknown): void => {
  if (__DEV__) console.warn('[foxhole]', e);
};

const logSessionToDb = (
  sessionType: SessionType,
  presetName: string,
  plannedDurationMs: number,
  startedAt: number,
  wasCompleted: boolean,
  wasSkipped: boolean,
): void => {
  const now = Date.now();
  const actualDurationMs = now - startedAt;
  useSessionStore.getState().logSession({
    sessionType,
    presetName,
    plannedDurationMs,
    actualDurationMs,
    startedAt,
    completedAt: now,
    wasCompleted,
    wasSkipped,
  });
};

interface TimerStore {
  state: PomodoroState | null;
  activePreset: Preset | null;
  showingTransition: boolean;
  transitionTimeoutId: ReturnType<typeof setTimeout> | null;
  sessionStartedAt: number | null;

  startSession: (preset: Preset) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  abandonSession: () => void;
  skipSession: () => void;
  completeSession: () => void;
  syncFromNative: () => void;
  updateRemainingMs: (remainingMs: number) => void;
  startNextSession: () => void;
  reset: () => void;
}

export const useTimerStore = create<TimerStore>((set, get) => ({
  state: null,
  activePreset: null,
  showingTransition: false,
  transitionTimeoutId: null,
  sessionStartedAt: null,

  startSession: (preset: Preset) => {
    const { transitionTimeoutId } = get();
    if (transitionTimeoutId) {
      clearTimeout(transitionTimeoutId);
    }

    const initialState = createInitialState(preset);
    const durationMs = getSessionDurationMs('work', preset);

    startFocusService(durationMs, 'work').catch(warnDev);
    enableDnd(true).catch(warnDev);

    set({
      state: initialState,
      activePreset: preset,
      showingTransition: false,
      transitionTimeoutId: null,
      sessionStartedAt: Date.now(),
    });
  },

  pauseSession: () => {
    const { state } = get();
    if (!state || !state.isRunning || state.isPaused) {
      return;
    }
    // Pausing a foreground service is complex; stop and restart on resume
    stopFocusService().catch(warnDev);
    set({ state: pauseEngine(state) });
  },

  resumeSession: () => {
    const { state, activePreset } = get();
    if (!state || !state.isPaused || !activePreset) {
      return;
    }

    startFocusService(state.remainingMs, state.currentSession).catch(warnDev);
    set({ state: resumeEngine(state) });
  },

  abandonSession: () => {
    const { state, activePreset, transitionTimeoutId, sessionStartedAt } = get();
    if (!state || !activePreset) {
      return;
    }
    if (transitionTimeoutId) {
      clearTimeout(transitionTimeoutId);
    }
    stopFocusService().catch(warnDev);
    disableDnd().catch(warnDev);

    if (sessionStartedAt) {
      const plannedMs = getSessionDurationMs(state.currentSession, activePreset);
      logSessionToDb(
        state.currentSession,
        activePreset.name,
        plannedMs,
        sessionStartedAt,
        false,
        false,
      );
    }

    set({
      state: abandonEngine(state),
      showingTransition: false,
      transitionTimeoutId: null,
      sessionStartedAt: null,
    });
  },

  skipSession: () => {
    const { state, activePreset, sessionStartedAt } = get();
    if (!state || !activePreset) {
      return;
    }

    if (sessionStartedAt) {
      const plannedMs = getSessionDurationMs(state.currentSession, activePreset);
      logSessionToDb(
        state.currentSession,
        activePreset.name,
        plannedMs,
        sessionStartedAt,
        false,
        true,
      );
    }

    const nextState = skipEngine(state, activePreset);
    const durationMs = getSessionDurationMs(nextState.currentSession, activePreset);

    stopFocusService()
      .then(() => startFocusService(durationMs, nextState.currentSession))
      .catch(warnDev);

    set({
      state: nextState,
      showingTransition: false,
      transitionTimeoutId: null,
      sessionStartedAt: Date.now(),
    });
  },

  completeSession: () => {
    const { state, activePreset, sessionStartedAt } = get();
    if (!state || !activePreset) {
      return;
    }

    if (sessionStartedAt) {
      const plannedMs = getSessionDurationMs(state.currentSession, activePreset);
      logSessionToDb(
        state.currentSession,
        activePreset.name,
        plannedMs,
        sessionStartedAt,
        true,
        false,
      );
    }

    const nextState = complete(state, activePreset);

    const timeoutId = setTimeout(() => {
      get().startNextSession();
    }, 3000);

    set({
      state: nextState,
      showingTransition: true,
      transitionTimeoutId: timeoutId,
    });
  },

  startNextSession: () => {
    const { state, activePreset } = get();
    if (!state || !activePreset) {
      return;
    }

    const durationMs = getSessionDurationMs(state.currentSession, activePreset);
    startFocusService(durationMs, state.currentSession).catch(warnDev);

    set({
      state: {
        ...state,
        isRunning: true,
        isPaused: false,
      },
      showingTransition: false,
      transitionTimeoutId: null,
      sessionStartedAt: Date.now(),
    });
  },

  syncFromNative: () => {
    getRemainingTime()
      .then((remainingMs) => {
        const { state } = get();
        if (!state || !state.isRunning || state.isPaused) {
          return;
        }
        if (remainingMs > 0 && remainingMs !== state.remainingMs) {
          set({ state: { ...state, remainingMs } });
        }
      })
      .catch(warnDev);
  },

  updateRemainingMs: (remainingMs: number) => {
    const { state } = get();
    if (!state || !state.isRunning || state.isPaused) {
      return;
    }
    if (remainingMs <= 0) {
      get().completeSession();
      return;
    }
    if (remainingMs === state.remainingMs) {
      return;
    }
    set({ state: { ...state, remainingMs } });
  },

  reset: () => {
    const { transitionTimeoutId } = get();
    if (transitionTimeoutId) {
      clearTimeout(transitionTimeoutId);
    }
    stopFocusService().catch(warnDev);
    disableDnd().catch(warnDev);

    set({
      state: null,
      activePreset: null,
      showingTransition: false,
      transitionTimeoutId: null,
      sessionStartedAt: null,
    });
  },
}));
