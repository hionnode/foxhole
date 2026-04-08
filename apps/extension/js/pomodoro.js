// Pure Pomodoro cycle engine — no side effects, no chrome.* calls

const Pomodoro = {
  DEFAULT_PRESET: {
    id: 'classic',
    name: 'classic',
    workMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    cyclesBeforeLongBreak: 4
  },

  // Get session duration in seconds
  getSessionDurationSeconds(sessionType, preset) {
    if (sessionType === 'work') return preset.workMinutes * 60;
    if (sessionType === 'short_break') return preset.shortBreakMinutes * 60;
    if (sessionType === 'long_break') return preset.longBreakMinutes * 60;
    return 0;
  },

  // Create the initial state for a new pomodoro run
  createInitialState(preset) {
    const duration = this.getSessionDurationSeconds('work', preset);
    return {
      status: 'running',
      sessionType: 'work',
      remainingSeconds: duration,
      totalSeconds: duration,
      cyclePosition: 1,
      totalWorkCompleted: 0,
      presetName: preset.name,
      preset: preset,
      startedAt: null,
      pausedAt: null
    };
  },

  // Compute next state after a session completes
  complete(state, preset) {
    const next = { ...state };

    if (state.sessionType === 'work') {
      next.totalWorkCompleted = state.totalWorkCompleted + 1;
      if (state.cyclePosition >= preset.cyclesBeforeLongBreak) {
        next.sessionType = 'long_break';
      } else {
        next.sessionType = 'short_break';
      }
    } else if (state.sessionType === 'short_break') {
      next.sessionType = 'work';
      next.cyclePosition = state.cyclePosition + 1;
    } else if (state.sessionType === 'long_break') {
      next.sessionType = 'work';
      next.cyclePosition = 1;
    }

    const duration = this.getSessionDurationSeconds(next.sessionType, preset);
    next.remainingSeconds = duration;
    next.totalSeconds = duration;
    next.status = 'running';
    next.startedAt = null;
    next.pausedAt = null;

    return next;
  },

  // Compute next state after skipping current session
  skip(state, preset) {
    const next = { ...state };

    if (state.sessionType === 'work') {
      // Skipping work does NOT increment totalWorkCompleted
      if (state.cyclePosition >= preset.cyclesBeforeLongBreak) {
        next.sessionType = 'long_break';
      } else {
        next.sessionType = 'short_break';
      }
    } else if (state.sessionType === 'short_break') {
      next.sessionType = 'work';
      next.cyclePosition = state.cyclePosition + 1;
    } else if (state.sessionType === 'long_break') {
      next.sessionType = 'work';
      next.cyclePosition = 1;
    }

    const duration = this.getSessionDurationSeconds(next.sessionType, preset);
    next.remainingSeconds = duration;
    next.totalSeconds = duration;
    next.status = 'running';
    next.startedAt = null;
    next.pausedAt = null;

    return next;
  },

  // Format seconds as MM:SS
  formatTimer(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  },

  // Format session type for display
  formatSessionType(sessionType) {
    if (sessionType === 'work') return 'work';
    if (sessionType === 'short_break') return 'short break';
    if (sessionType === 'long_break') return 'long break';
    return sessionType;
  }
};
