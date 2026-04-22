import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, Pressable, Alert } from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { useTimerStore } from '@/stores/timerStore';
import { usePresetStore } from '@/stores/presetStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useUsageStore } from '@/stores/usageStore';
import { isDndAccessGranted, requestDndAccess } from '@/native/DndManager';
import { formatTime, formatUsageTime } from '@/utils/formatTime';
import { triggerHaptic } from '@/utils/haptics';

type RootStackParamList = {
  Tabs: undefined;
  Focus: undefined;
  UsageDetail: undefined;
};

type HomeScreenNav = NativeStackNavigationProp<RootStackParamList>;

const formatDate = (): string => {
  const now = new Date();
  const month = now
    .toLocaleString('en-US', { month: 'short' })
    .toLowerCase();
  const day = now.getDate();
  return `${month} ${day}`;
};

const HomeScreen = () => {
  const navigation = useNavigation<HomeScreenNav>();
  const isFocused = useIsFocused();
  const startSession = useTimerStore((s) => s.startSession);
  const getActivePreset = usePresetStore((s) => s.getActivePreset);
  const cyclePreset = usePresetStore((s) => s.cyclePreset);
  const dailyGoal = usePresetStore((s) => s.dailyGoal);

  const activePreset = getActivePreset();

  const completedToday = useSessionStore((s) => s.todayCompletedCount);
  const totalEver = useSessionStore((s) => s.totalEver);
  const streakDays = useSessionStore((s) => s.currentStreak);

  const usageAccessGranted = useUsageStore((s) => s.usageAccessGranted);
  const totalTimeMs = useUsageStore((s) => s.totalTimeMs);
  const checkUsagePermission = useUsageStore((s) => s.checkPermission);
  const refreshUsage = useUsageStore((s) => s.refreshUsage);
  const [dndGranted, setDndGranted] = useState(true);

  useEffect(() => {
    if (!isFocused) {
      return;
    }
    isDndAccessGranted()
      .then(setDndGranted)
      .catch(() => {});
    checkUsagePermission().then(refreshUsage);
  }, [isFocused, checkUsagePermission, refreshUsage]);

  const cycleToNextPreset = useCallback(() => {
    triggerHaptic();
    cyclePreset(1);
  }, [cyclePreset]);

  const cycleToPrevPreset = useCallback(() => {
    triggerHaptic();
    cyclePreset(-1);
  }, [cyclePreset]);

  const beginSession = useCallback(() => {
    const preset = usePresetStore.getState().getActivePreset();
    startSession(preset);
    navigation.navigate('Focus');
  }, [startSession, navigation]);

  const handleDigIn = useCallback(async () => {
    triggerHaptic();
    try {
      const granted = await isDndAccessGranted();
      if (!granted) {
        Alert.alert(
          'do not disturb access needed',
          'foxhole needs dnd access to silence notifications during focus sessions. phone calls will still come through.',
          [
            {
              text: 'grant access',
              onPress: () => {
                requestDndAccess().catch(() => {});
              },
            },
            {
              text: 'continue without dnd',
              style: 'cancel',
              onPress: beginSession,
            },
          ],
        );
        return;
      }
      beginSession();
    } catch {
      // If DND check fails, proceed anyway
      beginSession();
    }
  }, [beginSession]);

  const durationDisplay = formatTime(activePreset.workMinutes * 60 * 1000);

  return (
    <View style={styles.container}>
      <View style={styles.topSection}>
        <Text style={styles.date}>{formatDate()}</Text>
      </View>

      <View style={styles.centerSection}>
        <View style={styles.presetPickerRow}>
          <Pressable
            onPress={cycleToPrevPreset}
            style={({ pressed }) => [
              styles.chevronButton,
              pressed && styles.pressed,
            ]}
            hitSlop={8}>
            <Text style={styles.chevron}>{'<'}</Text>
          </Pressable>
          <Pressable
            onPress={cycleToNextPreset}
            style={({ pressed }) => [pressed && styles.pressed]}>
            <Text style={styles.presetName}>{activePreset.name}</Text>
          </Pressable>
          <Pressable
            onPress={cycleToNextPreset}
            style={({ pressed }) => [
              styles.chevronButton,
              pressed && styles.pressed,
            ]}
            hitSlop={8}>
            <Text style={styles.chevron}>{'>'}</Text>
          </Pressable>
        </View>
        <Text style={styles.duration}>{durationDisplay}</Text>
      </View>

      <Pressable
        onPress={handleDigIn}
        style={({ pressed }) => [
          styles.digInButton,
          pressed && styles.pressed,
        ]}>
        <Text style={styles.digInText}>dig in</Text>
      </Pressable>

      <View style={styles.statsSection}>
        {totalEver === 0 ? (
          <Text style={styles.statsText}>
            your first session starts here
          </Text>
        ) : (
          <>
            <Text style={styles.statsText}>
              {completedToday} of {dailyGoal} today
            </Text>
            <Text style={styles.statsText}>
              {streakDays} day streak
            </Text>
            {usageAccessGranted && (
              <Pressable
                onPress={() => { triggerHaptic(); navigation.navigate('UsageDetail'); }}
                style={({ pressed }) => [pressed && styles.pressed]}>
                <Text style={styles.statsText}>
                  {formatUsageTime(totalTimeMs)} distractions {'>'}
                </Text>
              </Pressable>
            )}
          </>
        )}
        {!dndGranted && (
          <Text style={styles.dndNote}>dnd not enabled</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background_primary,
  },
  topSection: {
    paddingTop: 48,
    paddingHorizontal: 24,
  },
  date: {
    fontFamily: typography.fontFamily,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.text_muted,
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chevronButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    fontFamily: typography.fontFamily,
    fontSize: typography.body.fontSize,
    color: colors.text_muted,
  },
  presetName: {
    fontFamily: typography.fontFamily,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.text_primary,
    paddingHorizontal: 8,
  },
  duration: {
    fontFamily: typography.fontFamily,
    fontSize: typography.timer.fontSize,
    lineHeight: typography.timer.lineHeight,
    color: colors.text_body,
    marginTop: 8,
  },
  digInButton: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  digInText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    color: colors.text_primary,
  },
  pressed: {
    opacity: 0.7,
  },
  statsSection: {
    alignItems: 'center',
    paddingBottom: 48,
    paddingTop: 16,
  },
  statsText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.text_muted,
    marginTop: 4,
  },
  dndNote: {
    fontFamily: typography.fontFamily,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.text_muted,
    marginTop: 8,
  },
});

export default HomeScreen;
