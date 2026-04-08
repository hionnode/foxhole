export type SessionType = 'work' | 'short_break' | 'long_break';

export type TimerDisplayMode = 'digital' | 'blocks';

export interface Preset {
  id: string;
  name: string;
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  cyclesBeforeLongBreak: number;
}

export interface PomodoroState {
  currentSession: SessionType;
  cyclePosition: number;
  totalWorkCompleted: number;
  remainingMs: number;
  isRunning: boolean;
  isPaused: boolean;
}

export interface TrackedApp {
  packageName: string;
  label: string;
  enabled: boolean;
}

export interface AppUsageData {
  packageName: string;
  label: string;
  foregroundTimeMs: number;
  openCount: number;
}

export interface Session {
  id: number;
  sessionType: SessionType;
  presetName: string;
  plannedDurationMs: number;
  actualDurationMs: number;
  startedAt: number;
  completedAt: number;
  wasCompleted: boolean;
  wasSkipped: boolean;
}
