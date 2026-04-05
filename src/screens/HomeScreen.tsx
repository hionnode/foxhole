import React, { useCallback } from 'react';
import { StyleSheet, Text, View, Pressable, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { useTimerStore } from '@/stores/timerStore';
import { usePresetStore } from '@/stores/presetStore';
import { isDndAccessGranted, requestDndAccess } from '@/native/DndManager';
import { formatTime } from '@/utils/formatTime';

type RootStackParamList = {
  Tabs: undefined;
  Focus: undefined;
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
  const startSession = useTimerStore((s) => s.startSession);
  const getActivePreset = usePresetStore((s) => s.getActivePreset);
  const presets = usePresetStore((s) => s.presets);
  const activePresetId = usePresetStore((s) => s.activePresetId);
  const setActivePreset = usePresetStore((s) => s.setActivePreset);
  const dailyGoal = usePresetStore((s) => s.dailyGoal);

  const activePreset = getActivePreset();

  // Hardcoded for now until Phase 4 wires up the DB
  const completedToday = 0;
  const totalEver = 0;
  const streakDays = 0;

  const cycleToNextPreset = useCallback(() => {
    const currentIndex = presets.findIndex((p) => p.id === activePresetId);
    const nextIndex = (currentIndex + 1) % presets.length;
    setActivePreset(presets[nextIndex].id);
  }, [presets, activePresetId, setActivePreset]);

  const cycleToPrevPreset = useCallback(() => {
    const currentIndex = presets.findIndex((p) => p.id === activePresetId);
    const prevIndex = (currentIndex - 1 + presets.length) % presets.length;
    setActivePreset(presets[prevIndex].id);
  }, [presets, activePresetId, setActivePreset]);

  const beginSession = useCallback(() => {
    const preset = usePresetStore.getState().getActivePreset();
    startSession(preset);
    navigation.navigate('Focus');
  }, [startSession, navigation]);

  const handleDigIn = useCallback(async () => {
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
          </>
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
});

export default HomeScreen;
