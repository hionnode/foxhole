import { describe, it, expect, beforeEach } from 'vitest';
import { SyncClient } from '../sync-client';
import { MockApiClient } from './mock-api';
import { MockStorageAdapter } from './mock-storage';
import { validateSyncPayload } from '../validation';
import { DEFAULT_PRESET } from '../schema';

describe('end-to-end sync', () => {
  let api: MockApiClient;
  let mobileStorage: MockStorageAdapter;
  let extensionStorage: MockStorageAdapter;
  let mobileClient: SyncClient;
  let extensionClient: SyncClient;

  beforeEach(() => {
    api = new MockApiClient();
    mobileStorage = new MockStorageAdapter('device-mobile-1', 'mobile');
    extensionStorage = new MockStorageAdapter('device-ext-1', 'extension');
    mobileClient = new SyncClient(mobileStorage, api);
    extensionClient = new SyncClient(extensionStorage, api);
  });

  it('first sync from mobile pushes all data to server', async () => {
    mobileStorage.addHabit('exercise');
    mobileStorage.logWorkSession();

    const result = await mobileClient.sync();
    expect(result.success).toBe(true);
    expect(result.conflicts).toHaveLength(0);

    const server = api.getServerState();
    expect(server).not.toBeNull();
    expect(server!.habits).toHaveLength(1);
    expect(server!.sessions).toHaveLength(1);
  });

  it('extension pulls data from mobile via server', async () => {
    // Mobile creates data
    const habit = mobileStorage.addHabit('read');
    mobileStorage.completeHabit(habit.id, '2026-04-08');
    mobileStorage.logWorkSession();

    await mobileClient.sync();

    // Extension pulls
    await extensionClient.sync();

    expect(extensionStorage.habits).toHaveLength(1);
    expect(extensionStorage.habits[0].name).toBe('read');
    expect(extensionStorage.entries).toHaveLength(1);
    expect(extensionStorage.sessions).toHaveLength(1);
  });

  it('sessions from both devices merge without conflicts', async () => {
    // Mobile logs 2 sessions
    mobileStorage.logWorkSession('classic', 25 * 60 * 1000);
    mobileStorage.logWorkSession('classic', 25 * 60 * 1000);
    await mobileClient.sync();

    // Extension logs 1 session
    extensionStorage.logWorkSession('classic', 25 * 60 * 1000);
    await extensionClient.sync();

    // Both should see 3 sessions
    expect(extensionStorage.sessions).toHaveLength(3);

    // Mobile pulls extension's session
    await mobileClient.sync();
    expect(mobileStorage.sessions).toHaveLength(3);
  });

  it('habit entries merge optimistically (completed=true wins)', async () => {
    const habit = mobileStorage.addHabit('meditate');
    await mobileClient.sync();

    // Extension gets the habit
    await extensionClient.sync();
    expect(extensionStorage.habits).toHaveLength(1);

    // Both mark the same day — mobile completes, extension doesn't
    mobileStorage.entries.push({
      habitId: habit.id,
      date: '2026-04-08',
      completed: true,
      value: 1,
    });

    extensionStorage.entries.push({
      habitId: habit.id,
      date: '2026-04-08',
      completed: false,
      value: 0,
    });

    // Mobile syncs first
    await mobileClient.sync();
    // Extension syncs — should keep completed=true
    await extensionClient.sync();

    const entry = extensionStorage.entries.find(
      e => e.habitId === habit.id && e.date === '2026-04-08'
    );
    expect(entry?.completed).toBe(true);
    expect(entry?.value).toBe(1);
  });

  it('streak freezes merge additively', async () => {
    const habit = mobileStorage.addHabit('exercise');
    await mobileClient.sync();
    await extensionClient.sync();

    // Mobile freezes day 1
    mobileStorage.addFreeze(habit.id, '2026-04-05');
    await mobileClient.sync();

    // Extension freezes day 2
    extensionStorage.addFreeze(habit.id, '2026-04-06');
    await extensionClient.sync();

    // Both should have both freezes
    expect(extensionStorage.streakFreezes).toHaveLength(2);

    await mobileClient.sync();
    expect(mobileStorage.streakFreezes).toHaveLength(2);
  });

  it('deleted habits propagate via soft delete', async () => {
    const habit = mobileStorage.addHabit('temporary');
    await mobileClient.sync();
    await extensionClient.sync();

    expect(extensionStorage.habits).toHaveLength(1);

    // Mobile soft-deletes the habit
    mobileStorage.habits[0].deletedAt = '2026-04-08';
    await mobileClient.sync();

    // Extension pulls — habit should be marked deleted
    await extensionClient.sync();
    expect(extensionStorage.habits[0].deletedAt).toBe('2026-04-08');
  });

  it('preset conflicts detected on concurrent edits', async () => {
    // Both start with classic preset
    await mobileClient.sync();

    // Extension modifies the preset locally
    extensionStorage.presets = [{
      ...DEFAULT_PRESET,
      workMinutes: 30,
    }];

    // Mobile also modifies
    mobileStorage.presets = [{
      ...DEFAULT_PRESET,
      workMinutes: 50,
    }];

    // Mobile syncs first — server gets 50
    await mobileClient.sync();

    // Extension syncs — last write wins, extension's 30 takes over
    // but a conflict is detected and reported
    const result = await extensionClient.sync();
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].entity).toBe('preset');
    expect(extensionStorage.presets[0].workMinutes).toBe(30);

    // Mobile pulls — now gets extension's 30 (last write wins)
    await mobileClient.pullOnly();
    expect(mobileStorage.presets[0].workMinutes).toBe(30);
  });

  it('sync payloads pass validation', async () => {
    mobileStorage.addHabit('read');
    mobileStorage.logWorkSession();
    mobileStorage.completeHabit(mobileStorage.habits[0].id);

    const payload = await mobileStorage.buildSyncPayload();
    expect(validateSyncPayload(payload)).toBe(true);
  });

  it('settings sync uses last-write-wins', async () => {
    mobileStorage.settings.dailyGoal = 6;
    await mobileClient.sync();

    extensionStorage.settings.dailyGoal = 8;
    await extensionClient.sync();

    // Server should have extension's value (last write)
    const server = api.getServerState();
    expect(server!.settings.dailyGoal).toBe(8);

    // Mobile pulls — gets extension's value
    await mobileClient.pullOnly();
    expect(mobileStorage.settings.dailyGoal).toBe(8);
  });

  it('handles empty state gracefully', async () => {
    const result = await mobileClient.sync();
    expect(result.success).toBe(true);
    expect(result.conflicts).toHaveLength(0);
  });

  it('website settings sync categories and limits', async () => {
    extensionStorage.websiteSettings = [
      { domain: 'github.com', dailyLimitSeconds: null, categoryId: 'cat-2' },
      { domain: 'twitter.com', dailyLimitSeconds: 1800, categoryId: 'cat-3' },
    ];
    extensionStorage.categories = [
      { id: 'cat-2', name: 'code', color: '#50c878', isDefault: true },
      { id: 'cat-3', name: 'social media', color: '#ff9500', isDefault: true },
    ];

    await extensionClient.sync();
    await mobileClient.sync();

    // Mobile gets extension's website settings
    expect(mobileStorage.websiteSettings).toHaveLength(2);
    expect(mobileStorage.categories).toHaveLength(2);
  });

  it('multiple sync cycles converge', async () => {
    // Round 1: mobile creates habit
    mobileStorage.addHabit('exercise');
    await mobileClient.sync();

    // Round 2: extension creates habit + completes mobile's
    await extensionClient.sync();
    extensionStorage.addHabit('read');
    extensionStorage.completeHabit(extensionStorage.habits[0].id, '2026-04-08');
    await extensionClient.sync();

    // Round 3: mobile pulls, adds freeze
    await mobileClient.sync();
    expect(mobileStorage.habits).toHaveLength(2);
    mobileStorage.addFreeze(mobileStorage.habits[0].id, '2026-04-07');
    await mobileClient.sync();

    // Round 4: extension pulls final state
    await extensionClient.sync();
    expect(extensionStorage.habits).toHaveLength(2);
    expect(extensionStorage.streakFreezes).toHaveLength(1);
    expect(extensionStorage.entries).toHaveLength(1);
  });
});
