// Sync client — orchestrates the push/pull cycle.
// Platform-agnostic: uses injected storage adapter and API client.

import type { SyncPayload, SyncResponse } from './schema';
import {
  mergeSessions,
  mergeHabits,
  mergeEntries,
  mergeStreakFreezes,
  mergePresets,
  mergeCategories,
  mergeWebsiteSettings,
  mergeUserSettings,
} from './merge';

// Platform storage adapter interface
export interface StorageAdapter {
  buildSyncPayload(): Promise<SyncPayload>;
  applySyncResponse(response: SyncResponse): Promise<void>;
  getLastSyncTimestamp(): Promise<number>;
  setLastSyncTimestamp(ts: number): Promise<void>;
}

// API client interface (to be implemented per environment)
export interface ApiClient {
  pushSync(payload: SyncPayload): Promise<SyncResponse>;
  pullSync(since: number, deviceId: string): Promise<SyncResponse>;
  healthCheck(): Promise<boolean>;
}

export class SyncClient {
  constructor(
    private storage: StorageAdapter,
    private api: ApiClient,
  ) {}

  async sync(): Promise<{ success: boolean; conflicts: SyncResponse['conflicts'] }> {
    const payload = await this.storage.buildSyncPayload();
    const response = await this.api.pushSync(payload);
    await this.storage.applySyncResponse(response);
    await this.storage.setLastSyncTimestamp(response.serverTimestamp);
    return { success: true, conflicts: response.conflicts };
  }

  async pullOnly(): Promise<{ success: boolean; conflicts: SyncResponse['conflicts'] }> {
    const since = await this.storage.getLastSyncTimestamp();
    const payload = await this.storage.buildSyncPayload();
    const response = await this.api.pullSync(since, payload.deviceId);
    await this.storage.applySyncResponse(response);
    await this.storage.setLastSyncTimestamp(response.serverTimestamp);
    return { success: true, conflicts: response.conflicts };
  }

  async isOnline(): Promise<boolean> {
    try {
      return await this.api.healthCheck();
    } catch {
      return false;
    }
  }
}

// Server-side merge function (used by Lambda handler)
// Server-side merge: incoming client payload is the latest write.
// For append-only data (sessions, freezes): union of both.
// For user-editable data (presets, settings): incoming (last-write) wins.
// For optimistic data (entries, habits): merge with incoming preferred.
export function serverMerge(
  existing: SyncPayload,
  incoming: SyncPayload,
): SyncResponse {
  // Presets: incoming client wins (last-write-wins), detect conflicts
  const { merged: presets, conflicts: presetConflicts } = mergePresets(
    existing.presets,  // local = old server state
    incoming.presets,  // remote = new client push (wins)
  );

  return {
    serverTimestamp: Date.now(),
    presets,
    sessions: mergeSessions(existing.sessions, incoming.sessions),
    habits: mergeHabits(existing.habits, incoming.habits),
    entries: mergeEntries(existing.entries, incoming.entries),
    streakFreezes: mergeStreakFreezes(existing.streakFreezes, incoming.streakFreezes),
    categories: mergeCategories(existing.categories, incoming.categories),
    websiteSettings: mergeWebsiteSettings(existing.websiteSettings, incoming.websiteSettings),
    settings: mergeUserSettings(existing.settings, incoming.settings),
    conflicts: presetConflicts,
  };
}
