import { Vibration } from 'react-native';
import { usePresetStore } from '@/stores/presetStore';

export const triggerHaptic = (): void => {
  if (usePresetStore.getState().vibrationEnabled) {
    Vibration.vibrate(10);
  }
};
