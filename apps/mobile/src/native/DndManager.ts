import { NativeModules, Platform } from 'react-native';

const { DndManager } = NativeModules;

export const requestDndAccess = (): Promise<void> => {
  if (Platform.OS !== 'android') {
    return Promise.resolve();
  }
  return DndManager.requestDndAccess();
};

export const enableDnd = (allowCalls = true): Promise<void> => {
  if (Platform.OS !== 'android') {
    return Promise.resolve();
  }
  return DndManager.enableDnd(allowCalls);
};

export const disableDnd = (): Promise<void> => {
  if (Platform.OS !== 'android') {
    return Promise.resolve();
  }
  return DndManager.disableDnd();
};

export const isDndAccessGranted = (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return Promise.resolve(false);
  }
  return DndManager.isDndAccessGranted();
};
