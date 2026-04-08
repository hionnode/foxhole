import { PomodoroState, Preset, SessionType } from '@/types';

export const getSessionDurationMs = (type: SessionType, preset: Preset): number => {
  switch (type) {
    case 'work':
      return preset.workMinutes * 60 * 1000;
    case 'short_break':
      return preset.shortBreakMinutes * 60 * 1000;
    case 'long_break':
      return preset.longBreakMinutes * 60 * 1000;
  }
};

export const createInitialState = (preset: Preset): PomodoroState => ({
  currentSession: 'work',
  cyclePosition: 1,
  totalWorkCompleted: 0,
  remainingMs: getSessionDurationMs('work', preset),
  isRunning: true,
  isPaused: false,
});

export const tick = (state: PomodoroState, elapsedMs: number): PomodoroState => {
  if (!state.isRunning || state.isPaused) {
    return state;
  }
  return {
    ...state,
    remainingMs: Math.max(0, state.remainingMs - elapsedMs),
  };
};

export const complete = (state: PomodoroState, preset: Preset): PomodoroState => {
  const { currentSession, cyclePosition, totalWorkCompleted } = state;

  switch (currentSession) {
    case 'work': {
      const newTotalWork = totalWorkCompleted + 1;
      if (cyclePosition < preset.cyclesBeforeLongBreak) {
        return {
          ...state,
          currentSession: 'short_break',
          totalWorkCompleted: newTotalWork,
          remainingMs: getSessionDurationMs('short_break', preset),
          isRunning: true,
          isPaused: false,
        };
      }
      return {
        ...state,
        currentSession: 'long_break',
        totalWorkCompleted: newTotalWork,
        remainingMs: getSessionDurationMs('long_break', preset),
        isRunning: true,
        isPaused: false,
      };
    }
    case 'short_break':
      return {
        ...state,
        currentSession: 'work',
        cyclePosition: cyclePosition + 1,
        remainingMs: getSessionDurationMs('work', preset),
        isRunning: true,
        isPaused: false,
      };
    case 'long_break':
      return {
        ...state,
        currentSession: 'work',
        cyclePosition: 1,
        remainingMs: getSessionDurationMs('work', preset),
        isRunning: true,
        isPaused: false,
      };
  }
};

export const skip = (state: PomodoroState, preset: Preset): PomodoroState => {
  const { currentSession, cyclePosition } = state;

  switch (currentSession) {
    case 'work': {
      if (cyclePosition < preset.cyclesBeforeLongBreak) {
        return {
          ...state,
          currentSession: 'short_break',
          remainingMs: getSessionDurationMs('short_break', preset),
          isRunning: true,
          isPaused: false,
        };
      }
      return {
        ...state,
        currentSession: 'long_break',
        remainingMs: getSessionDurationMs('long_break', preset),
        isRunning: true,
        isPaused: false,
      };
    }
    case 'short_break':
      return {
        ...state,
        currentSession: 'work',
        cyclePosition: cyclePosition + 1,
        remainingMs: getSessionDurationMs('work', preset),
        isRunning: true,
        isPaused: false,
      };
    case 'long_break':
      return {
        ...state,
        currentSession: 'work',
        cyclePosition: 1,
        remainingMs: getSessionDurationMs('work', preset),
        isRunning: true,
        isPaused: false,
      };
  }
};

export const abandon = (state: PomodoroState): PomodoroState => ({
  ...state,
  isRunning: false,
  isPaused: false,
});

export const pause = (state: PomodoroState): PomodoroState => ({
  ...state,
  isPaused: true,
});

export const resume = (state: PomodoroState): PomodoroState => ({
  ...state,
  isPaused: false,
});
