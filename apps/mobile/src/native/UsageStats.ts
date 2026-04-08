import { NativeModules, Platform } from 'react-native';
import type { AppUsageData } from '@/types';

const { UsageStats } = NativeModules;

export const isUsageAccessGranted = (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return Promise.resolve(false);
  }
  return UsageStats.isUsageAccessGranted();
};

export const requestUsageAccess = (): Promise<void> => {
  if (Platform.OS !== 'android') {
    return Promise.resolve();
  }
  return UsageStats.requestUsageAccess();
};

export const getUsageStats = (
  packageNames: string[],
  startTime: number,
  endTime: number,
): Promise<AppUsageData[]> => {
  if (Platform.OS !== 'android') {
    return Promise.resolve([]);
  }
  return UsageStats.getUsageStats(packageNames, startTime, endTime);
};

export const getInstalledApps = (): Promise<
  { packageName: string; label: string }[]
> => {
  if (Platform.OS !== 'android') {
    return Promise.resolve([]);
  }
  return UsageStats.getInstalledApps();
};
