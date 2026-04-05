import { NativeModules, Platform } from 'react-native';

const { ImmersiveMode } = NativeModules;

export const enableImmersiveMode = (): void => {
  if (Platform.OS === 'android') {
    ImmersiveMode.enable();
  }
};

export const disableImmersiveMode = (): void => {
  if (Platform.OS === 'android') {
    ImmersiveMode.disable();
  }
};
