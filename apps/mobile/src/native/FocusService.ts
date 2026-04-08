import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import type { SessionType } from '@/types';

const { FocusServiceModule } = NativeModules;
const eventEmitter = Platform.OS === 'android'
  ? new NativeEventEmitter(FocusServiceModule)
  : null;

export const startFocusService = (durationMs: number, sessionType: SessionType): Promise<void> => {
  if (Platform.OS !== 'android') {
    return Promise.resolve();
  }
  return FocusServiceModule.start(durationMs, sessionType);
};

export const stopFocusService = (): Promise<void> => {
  if (Platform.OS !== 'android') {
    return Promise.resolve();
  }
  return FocusServiceModule.stop();
};

export const getRemainingTime = (): Promise<number> => {
  if (Platform.OS !== 'android') {
    return Promise.resolve(0);
  }
  return FocusServiceModule.getRemainingTime();
};

export const isFocusServiceRunning = (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return Promise.resolve(false);
  }
  return FocusServiceModule.isRunning();
};

export const addTickListener = (callback: (remainingMs: number) => void) => {
  if (!eventEmitter) {
    return { remove: () => {} };
  }
  return eventEmitter.addListener('onTick', (event: { remainingMs: number }) =>
    callback(event.remainingMs),
  );
};

export const addCompleteListener = (callback: () => void) => {
  if (!eventEmitter) {
    return { remove: () => {} };
  }
  return eventEmitter.addListener('onComplete', () => callback());
};
