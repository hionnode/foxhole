import React, { useCallback } from 'react';
import { StyleSheet, Text, View, Pressable, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { useTimerStore } from '@/stores/timerStore';
import { isDndAccessGranted, requestDndAccess } from '@/native/DndManager';
import type { Preset } from '@/types';

type RootStackParamList = {
  Home: undefined;
  Focus: undefined;
};

type HomeScreenNav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

const DEFAULT_PRESET: Preset = {
  id: 'classic',
  name: 'classic',
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  cyclesBeforeLongBreak: 4,
};

const HomeScreen = () => {
  const navigation = useNavigation<HomeScreenNav>();
  const startSession = useTimerStore(s => s.startSession);

  const beginSession = useCallback(() => {
    startSession(DEFAULT_PRESET);
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

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>foxhole</Text>
        <Text style={styles.presetName}>{DEFAULT_PRESET.name}</Text>
        <Text style={styles.duration}>{DEFAULT_PRESET.workMinutes} min</Text>
      </View>
      <Pressable
        onPress={handleDigIn}
        style={({ pressed }) => [
          styles.startButton,
          pressed && styles.pressedOpacity,
        ]}>
        <Text style={styles.startText}>dig in</Text>
      </Pressable>
      <View style={styles.footer}>
        <Text style={styles.footerText}>your first session starts here</Text>
      </View>
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
  title: {
    fontFamily: typography.fontFamily,
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    color: colors.text_primary,
    marginBottom: 32,
  },
  presetName: {
    fontFamily: typography.fontFamily,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.text_muted,
  },
  duration: {
    fontFamily: typography.fontFamily,
    fontSize: typography.timer.fontSize,
    lineHeight: typography.timer.lineHeight,
    color: colors.text_body,
    marginTop: 8,
  },
  startButton: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  startText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    color: colors.text_primary,
  },
  pressedOpacity: {
    opacity: 0.7,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 48,
    paddingTop: 16,
  },
  footerText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.text_muted,
  },
});

export default HomeScreen;
