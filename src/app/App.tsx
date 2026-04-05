import React, { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigationContainerRef } from '@react-navigation/native';
import OnboardingScreen, {
  isOnboardingComplete,
} from '@/screens/OnboardingScreen';
import HomeScreen from '@/screens/HomeScreen';
import HistoryScreen from '@/screens/HistoryScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import FocusScreen from '@/screens/FocusScreen';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { useSessionStore } from '@/stores/sessionStore';
import { isFocusServiceRunning } from '@/native/FocusService';

type TabParamList = {
  Home: undefined;
  History: undefined;
  Settings: undefined;
};

type RootStackParamList = {
  Onboarding: undefined;
  Tabs: undefined;
  Focus: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.text_primary,
        tabBarInactiveTintColor: colors.text_muted,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarIconStyle: styles.tabBarIcon,
      }}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: 'home', tabBarIcon: () => null }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ tabBarLabel: 'history', tabBarIcon: () => null }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarLabel: 'settings', tabBarIcon: () => null }}
      />
    </Tab.Navigator>
  );
};

const onboardingDone = isOnboardingComplete();

const App = () => {
  const initialize = useSessionStore((s) => s.initialize);
  const navigationRef =
    useNavigationContainerRef<RootStackParamList>();
  const hasCheckedRecovery = useRef(false);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Process death recovery: if the native FocusService is still running
  // when the app starts, auto-navigate to FocusScreen so the existing
  // AppState + tick listener resync logic picks up the session.
  useEffect(() => {
    if (hasCheckedRecovery.current) {
      return;
    }
    hasCheckedRecovery.current = true;

    if (!onboardingDone) {
      return;
    }

    isFocusServiceRunning()
      .then((running) => {
        if (running && navigationRef.isReady()) {
          navigationRef.navigate('Focus');
        }
      })
      .catch(() => {});
  }, [navigationRef]);

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName={onboardingDone ? 'Tabs' : 'Onboarding'}
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          animationDuration: 200,
        }}>
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Tabs" component={TabNavigator} />
        <Stack.Screen name="Focus" component={FocusScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.background_primary,
    borderTopWidth: 0,
    elevation: 0,
    shadowOpacity: 0,
    height: 56,
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabBarLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.label.fontSize,
  },
  tabBarIcon: {
    display: 'none',
  },
});

export default App;
