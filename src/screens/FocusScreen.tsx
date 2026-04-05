import React, { useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Alert,
  BackHandler,
  AppState,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { formatTime } from '@/utils/formatTime';
import { getSessionDurationMs } from '@/utils/pomodoroEngine';
import { enableImmersiveMode, disableImmersiveMode } from '@/native/ImmersiveMode';
import { addTickListener, addCompleteListener } from '@/native/FocusService';
import { disableDnd } from '@/native/DndManager';
import { useTimerStore } from '@/stores/timerStore';
import { usePresetStore } from '@/stores/presetStore';
import { DigitalTimer } from '@/components/DigitalTimer';
import { BlockTimer } from '@/components/BlockTimer';
import type { SessionType } from '@/types';

type RootStackParamList = {
  Tabs: undefined;
  Focus: undefined;
};

type FocusScreenNav = NativeStackNavigationProp<RootStackParamList, 'Focus'>;

const getSessionLabel = (type: SessionType): string => {
  switch (type) {
    case 'work':
      return 'work';
    case 'short_break':
      return 'short break';
    case 'long_break':
      return 'long break';
  }
};

const FocusScreen = () => {
  const navigation = useNavigation<FocusScreenNav>();
  const state = useTimerStore(s => s.state);
  const activePreset = useTimerStore(s => s.activePreset);
  const showingTransition = useTimerStore(s => s.showingTransition);
  const abandonSession = useTimerStore(s => s.abandonSession);
  const skipSession = useTimerStore(s => s.skipSession);
  const startNextSession = useTimerStore(s => s.startNextSession);
  const syncFromNative = useTimerStore(s => s.syncFromNative);
  const updateRemainingMs = useTimerStore(s => s.updateRemainingMs);
  const completeSession = useTimerStore(s => s.completeSession);
  const reset = useTimerStore(s => s.reset);
  const timerDisplayMode = usePresetStore(s => s.timerDisplayMode);

  useEffect(() => {
    enableImmersiveMode();
    return () => {
      disableImmersiveMode();
    };
  }, []);

  // Subscribe to native tick and complete events
  useEffect(() => {
    const tickSub = addTickListener((remainingMs: number) => {
      updateRemainingMs(remainingMs);
    });

    const completeSub = addCompleteListener(() => {
      completeSession();
    });

    return () => {
      tickSub.remove();
      completeSub.remove();
    };
  }, [updateRemainingMs, completeSession]);

  // Resync timer when app comes back to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        syncFromNative();
        // Re-enable immersive mode (may have been lost during phone call)
        enableImmersiveMode();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [syncFromNative]);

  const handleAbandonAndGoBack = useCallback(() => {
    abandonSession();
    disableImmersiveMode();
    navigation.goBack();
  }, [abandonSession, navigation]);

  const showAbandonConfirmation = useCallback(() => {
    Alert.alert(
      'abandon this session?',
      '',
      [
        { text: 'keep going', style: 'cancel' },
        { text: 'abandon', onPress: handleAbandonAndGoBack },
      ],
    );
  }, [handleAbandonAndGoBack]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        showAbandonConfirmation();
        return true;
      },
    );
    return () => backHandler.remove();
  }, [showAbandonConfirmation]);

  // If no state (e.g. navigated here without starting), go back
  useEffect(() => {
    if (!state || !activePreset) {
      navigation.goBack();
    }
  }, [state, activePreset, navigation]);

  if (!state || !activePreset) {
    return null;
  }

  if (showingTransition) {
    const nextLabel = getSessionLabel(state.currentSession);
    const nextDuration = formatTime(
      getSessionDurationMs(state.currentSession, activePreset),
    );
    const isBreak =
      state.currentSession === 'short_break' ||
      state.currentSession === 'long_break';

    return (
      <View style={styles.container}>
        <View style={styles.transitionContent}>
          <Text style={styles.transitionLabel}>{nextLabel}</Text>
          <Text style={styles.transitionDuration}>{nextDuration}</Text>
          {isBreak ? (
            <Pressable
              onPress={skipSession}
              style={({ pressed }) => [
                styles.skipButton,
                pressed && styles.pressedOpacity,
              ]}>
              <Text style={styles.skipText}>skip</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={startNextSession}
              style={({ pressed }) => [
                styles.skipButton,
                pressed && styles.pressedOpacity,
              ]}>
              <Text style={styles.skipText}>start</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  const totalMs = getSessionDurationMs(state.currentSession, activePreset);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {timerDisplayMode === 'blocks' ? (
          <BlockTimer
            remainingMs={state.remainingMs}
            totalMs={totalMs}
            sessionType={state.currentSession}
          />
        ) : (
          <DigitalTimer remainingMs={state.remainingMs} />
        )}
        {timerDisplayMode === 'digital' && (
          <>
            <Text style={styles.sessionLabel}>
              {getSessionLabel(state.currentSession)}
            </Text>
            <Text style={styles.cycleLabel}>
              round {state.cyclePosition} of {activePreset.cyclesBeforeLongBreak}
            </Text>
          </>
        )}
        {timerDisplayMode === 'blocks' && (
          <Text style={styles.cycleLabel}>
            round {state.cyclePosition} of {activePreset.cyclesBeforeLongBreak}
          </Text>
        )}
      </View>
      <Pressable
        onPress={showAbandonConfirmation}
        style={({ pressed }) => [
          styles.surfaceButton,
          pressed && styles.pressedOpacity,
        ]}>
        <Text style={styles.surfaceText}>surface</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background_primary,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timer: {
    fontFamily: typography.fontFamily,
    fontSize: typography.timer.fontSize,
    lineHeight: typography.timer.lineHeight,
    color: colors.text_body,
  },
  sessionLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text_muted,
    marginTop: 8,
  },
  cycleLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.text_muted,
    marginTop: 4,
  },
  surfaceButton: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingBottom: 48,
  },
  surfaceText: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    color: colors.text_muted,
  },
  pressedOpacity: {
    opacity: 0.7,
  },
  transitionContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transitionLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    color: colors.text_body,
  },
  transitionDuration: {
    fontFamily: typography.fontFamily,
    fontSize: typography.timer.fontSize,
    lineHeight: typography.timer.lineHeight,
    color: colors.text_muted,
    marginTop: 8,
  },
  skipButton: {
    marginTop: 32,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  skipText: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    color: colors.text_muted,
  },
});

export default FocusScreen;
