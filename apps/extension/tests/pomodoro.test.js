import { describe, it, expect } from 'vitest';
import { loadModule } from './helpers/load-module.js';

loadModule('js/pomodoro.js');

const PRESET = {
  id: 'classic',
  name: 'classic',
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  cyclesBeforeLongBreak: 4
};

describe('Pomodoro', () => {
  describe('createInitialState', () => {
    it('starts on work session at round 1', () => {
      const state = Pomodoro.createInitialState(PRESET);
      expect(state.sessionType).toBe('work');
      expect(state.cyclePosition).toBe(1);
      expect(state.totalSeconds).toBe(25 * 60);
      expect(state.totalWorkCompleted).toBe(0);
      expect(state.status).toBe('running');
    });
  });

  describe('complete', () => {
    it('work -> short break (round unchanged, totalWork incremented, auto-runs)', () => {
      const s0 = Pomodoro.createInitialState(PRESET);
      const s1 = Pomodoro.complete(s0, PRESET);
      expect(s1.sessionType).toBe('short_break');
      expect(s1.cyclePosition).toBe(1);
      expect(s1.totalSeconds).toBe(5 * 60);
      expect(s1.totalWorkCompleted).toBe(1);
      // Breaks start automatically when work ends — rest is reactive.
      expect(s1.status).toBe('running');
    });

    it('short break -> work waits in pending_start until user begins', () => {
      const s0 = Pomodoro.createInitialState(PRESET);
      const s1 = Pomodoro.complete(s0, PRESET); // short_break, round 1
      const s2 = Pomodoro.complete(s1, PRESET); // work, round 2 (queued)
      expect(s2.sessionType).toBe('work');
      expect(s2.cyclePosition).toBe(2);
      expect(s2.totalSeconds).toBe(25 * 60);
      expect(s2.totalWorkCompleted).toBe(1);
      // Work after a break must be manually started.
      expect(s2.status).toBe('pending_start');
    });

    it('long break -> work also waits in pending_start', () => {
      let s = Pomodoro.createInitialState(PRESET);
      // Run through to a long break: 4 work + 3 short breaks bring us to the
      // 4th work session; completing that triggers the long break.
      for (let i = 0; i < 7; i++) s = Pomodoro.complete(s, PRESET);
      expect(s.sessionType).toBe('long_break');
      const next = Pomodoro.complete(s, PRESET);
      expect(next.sessionType).toBe('work');
      expect(next.status).toBe('pending_start');
    });

    it('full cycle goes work-break x4 then long break', () => {
      let s = Pomodoro.createInitialState(PRESET);

      // Round 1
      expect(s.sessionType).toBe('work');
      expect(s.cyclePosition).toBe(1);
      s = Pomodoro.complete(s, PRESET);
      expect(s.sessionType).toBe('short_break');
      expect(s.cyclePosition).toBe(1);
      expect(s.status).toBe('running');
      s = Pomodoro.complete(s, PRESET);
      expect(s.status).toBe('pending_start');

      // Round 2
      expect(s.sessionType).toBe('work');
      expect(s.cyclePosition).toBe(2);
      s = Pomodoro.complete(s, PRESET);
      expect(s.sessionType).toBe('short_break');
      expect(s.cyclePosition).toBe(2);
      s = Pomodoro.complete(s, PRESET);

      // Round 3
      expect(s.sessionType).toBe('work');
      expect(s.cyclePosition).toBe(3);
      s = Pomodoro.complete(s, PRESET);
      expect(s.sessionType).toBe('short_break');
      s = Pomodoro.complete(s, PRESET);

      // Round 4 -> long break
      expect(s.sessionType).toBe('work');
      expect(s.cyclePosition).toBe(4);
      s = Pomodoro.complete(s, PRESET);
      expect(s.sessionType).toBe('long_break');
      expect(s.cyclePosition).toBe(4);
      expect(s.totalSeconds).toBe(15 * 60);
      expect(s.status).toBe('running');

      // Long break ends -> reset to round 1 work, queued for manual start
      s = Pomodoro.complete(s, PRESET);
      expect(s.sessionType).toBe('work');
      expect(s.cyclePosition).toBe(1);
      expect(s.status).toBe('pending_start');
    });
  });

  describe('skip', () => {
    it('skipping a break advances to next work and auto-runs', () => {
      let s = Pomodoro.createInitialState(PRESET);
      s = Pomodoro.complete(s, PRESET); // short_break, round 1
      s = Pomodoro.skip(s, PRESET);     // work, round 2
      expect(s.sessionType).toBe('work');
      expect(s.cyclePosition).toBe(2);
      expect(s.totalWorkCompleted).toBe(1);
      // Skip is an active gesture — user is at the screen, so go straight in.
      expect(s.status).toBe('running');
    });
  });

  describe('formatSessionType', () => {
    it('formats labels for display', () => {
      expect(Pomodoro.formatSessionType('work')).toBe('work');
      expect(Pomodoro.formatSessionType('short_break')).toBe('short break');
      expect(Pomodoro.formatSessionType('long_break')).toBe('long break');
    });
  });

  describe('formatTimer', () => {
    it('zero-pads MM:SS', () => {
      expect(Pomodoro.formatTimer(0)).toBe('00:00');
      expect(Pomodoro.formatTimer(59)).toBe('00:59');
      expect(Pomodoro.formatTimer(60)).toBe('01:00');
      expect(Pomodoro.formatTimer(1500)).toBe('25:00');
    });
  });
});
