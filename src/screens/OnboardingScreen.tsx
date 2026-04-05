import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, Pressable, AppState } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { isDndAccessGranted, requestDndAccess } from '@/native/DndManager';
import { storage } from '@/stores/mmkv';

const ONBOARDING_COMPLETE_KEY = 'onboarding_complete';

type RootStackParamList = {
  Onboarding: undefined;
  Tabs: undefined;
  Focus: undefined;
};

type OnboardingScreenNav = NativeStackNavigationProp<
  RootStackParamList,
  'Onboarding'
>;

export const isOnboardingComplete = (): boolean => {
  return storage.getBoolean(ONBOARDING_COMPLETE_KEY) === true;
};

export const markOnboardingComplete = (): void => {
  storage.set(ONBOARDING_COMPLETE_KEY, true);
};

const OnboardingScreen = () => {
  const navigation = useNavigation<OnboardingScreenNav>();
  const [dndGranted, setDndGranted] = useState(false);
  const [checkedDnd, setCheckedDnd] = useState(false);

  const checkDndStatus = useCallback(() => {
    isDndAccessGranted()
      .then((granted) => {
        setDndGranted(granted);
        setCheckedDnd(true);
      })
      .catch(() => {
        setCheckedDnd(true);
      });
  }, []);

  useEffect(() => {
    checkDndStatus();
  }, [checkDndStatus]);

  // Re-check DND status when app comes back to foreground (user returning from settings)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkDndStatus();
      }
    });
    return () => {
      subscription.remove();
    };
  }, [checkDndStatus]);

  const handleGrantAccess = useCallback(() => {
    requestDndAccess().catch(() => {});
  }, []);

  const handleCta = useCallback(() => {
    markOnboardingComplete();
    navigation.replace('Tabs');
  }, [navigation]);

  if (!checkedDnd) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.bodyText}>
          foxhole takes over{'\n'}your screen and{'\n'}silences your phone.
        </Text>
        <Text style={styles.descriptionText}>
          when you dig in,{'\n'}everything else stops.
        </Text>
      </View>

      <View style={styles.actions}>
        {!dndGranted && (
          <Pressable
            onPress={handleGrantAccess}
            style={({ pressed }) => [
              styles.grantButton,
              pressed && styles.pressedOpacity,
            ]}>
            <Text style={styles.grantText}>grant dnd access</Text>
          </Pressable>
        )}
        <Pressable
          onPress={handleCta}
          style={({ pressed }) => [
            styles.ctaButton,
            pressed && styles.pressedOpacity,
          ]}>
          <Text style={styles.ctaText}>
            dig in to your{'\n'}first session
          </Text>
        </Pressable>
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
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  bodyText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.text_body,
  },
  descriptionText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.text_muted,
    marginTop: 24,
  },
  actions: {
    paddingHorizontal: 32,
    paddingBottom: 64,
    alignItems: 'center',
  },
  grantButton: {
    backgroundColor: colors.background_surface,
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginBottom: 24,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grantText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.text_muted,
  },
  ctaButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.text_primary,
    textAlign: 'center',
  },
  pressedOpacity: {
    opacity: 0.7,
  },
});

export default OnboardingScreen;
