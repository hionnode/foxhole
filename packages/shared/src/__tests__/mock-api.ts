// Mock API client for local testing — simulates Lambda + PlanetScale backend

import type { SyncPayload, SyncResponse } from '../schema';
import type { ApiClient } from '../sync-client';
import { serverMerge } from '../sync-client';

export class MockApiClient implements ApiClient {
  // In-memory "server" state
  private serverState: SyncPayload | null = null;
  private syncLog: Array<{ timestamp: number; deviceId: string; action: string }> = [];

  async pushSync(payload: SyncPayload): Promise<SyncResponse> {
    this.syncLog.push({ timestamp: Date.now(), deviceId: payload.deviceId, action: 'push' });

    if (!this.serverState) {
      // First sync — server accepts everything
      this.serverState = { ...payload };
      return {
        serverTimestamp: Date.now(),
        presets: payload.presets,
        sessions: payload.sessions,
        habits: payload.habits,
        entries: payload.entries,
        streakFreezes: payload.streakFreezes,
        categories: payload.categories,
        websiteSettings: payload.websiteSettings,
        settings: payload.settings,
        conflicts: [],
      };
    }

    // Merge incoming with existing server state
    const response = serverMerge(this.serverState, payload);

    // Update server state
    this.serverState = {
      ...payload,
      presets: response.presets,
      sessions: response.sessions,
      habits: response.habits,
      entries: response.entries,
      streakFreezes: response.streakFreezes,
      categories: response.categories,
      websiteSettings: response.websiteSettings,
      settings: response.settings,
    };

    return response;
  }

  async pullSync(since: number, deviceId: string): Promise<SyncResponse> {
    this.syncLog.push({ timestamp: Date.now(), deviceId, action: 'pull' });

    if (!this.serverState) {
      return {
        serverTimestamp: Date.now(),
        presets: [],
        sessions: [],
        habits: [],
        entries: [],
        streakFreezes: [],
        categories: [],
        websiteSettings: [],
        settings: { dailyGoal: 4, vibrationEnabled: true, activePresetId: 'classic', trackedApps: [] },
        conflicts: [],
      };
    }

    return {
      serverTimestamp: Date.now(),
      presets: this.serverState.presets,
      sessions: this.serverState.sessions,
      habits: this.serverState.habits,
      entries: this.serverState.entries,
      streakFreezes: this.serverState.streakFreezes,
      categories: this.serverState.categories,
      websiteSettings: this.serverState.websiteSettings,
      settings: this.serverState.settings,
      conflicts: [],
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  // Test helpers
  getServerState(): SyncPayload | null {
    return this.serverState;
  }

  getSyncLog() {
    return this.syncLog;
  }

  reset() {
    this.serverState = null;
    this.syncLog = [];
  }
}
