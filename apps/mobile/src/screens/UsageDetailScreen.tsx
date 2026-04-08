import React, { useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, Pressable } from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { formatUsageTime } from '@/utils/formatTime';
import { useUsageStore } from '@/stores/usageStore';
import { requestUsageAccess } from '@/native/UsageStats';
import type { AppUsageData } from '@/types';
import { triggerHaptic } from '@/utils/haptics';

const AppRow = React.memo(({ item }: { item: AppUsageData }) => (
  <View style={styles.appRow}>
    <Text style={styles.appName}>{item.label}</Text>
    <Text style={styles.appStats}>
      {formatUsageTime(item.foregroundTimeMs)} {'\u00b7'} {item.openCount} opens
    </Text>
  </View>
));

const UsageDetailScreen = () => {
  const usageAccessGranted = useUsageStore((s) => s.usageAccessGranted);
  const todayUsage = useUsageStore((s) => s.todayUsage);
  const totalTimeMs = useUsageStore((s) => s.totalTimeMs);
  const totalOpens = useUsageStore((s) => s.totalOpens);
  const yesterdayTotalMs = useUsageStore((s) => s.yesterdayTotalMs);
  const refreshUsage = useUsageStore((s) => s.refreshUsage);
  const checkPermission = useUsageStore((s) => s.checkPermission);

  useEffect(() => {
    checkPermission().then(() => {
      refreshUsage();
    });
  }, [checkPermission, refreshUsage]);

  if (!usageAccessGranted) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.heading}>distractions</Text>
        </View>
        <View style={styles.centeredContent}>
          <Text style={styles.permissionText}>
            foxhole needs usage access
          </Text>
          <Text style={styles.permissionText}>
            to show app tracking data
          </Text>
          <Pressable
            onPress={() => { triggerHaptic(); requestUsageAccess(); }}
            style={({ pressed }) => [
              styles.grantButton,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.grantText}>grant access</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const getComparisonText = (): string | null => {
    if (yesterdayTotalMs === null) {
      return null;
    }
    const diffMs = totalTimeMs - yesterdayTotalMs;
    const diffMinutes = Math.abs(Math.round(diffMs / 60000));
    if (diffMinutes === 0) {
      return 'same as yesterday';
    }
    const direction = diffMs > 0 ? 'up' : 'down';
    return `${direction} ${formatUsageTime(Math.abs(diffMs))} from yesterday`;
  };

  const comparisonText = getComparisonText();

  return (
    <View style={styles.container}>
      <FlatList
        data={todayUsage}
        keyExtractor={(item) => item.packageName}
        renderItem={({ item }) => <AppRow item={item} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Text style={styles.heading}>distractions</Text>
              <Text style={styles.subheading}>today</Text>
            </View>
            <View style={styles.summary}>
              <Text style={styles.totalTime}>
                {formatUsageTime(totalTimeMs)}
              </Text>
              <Text style={styles.totalOpens}>
                {totalOpens} opens
              </Text>
              {comparisonText && (
                <Text style={styles.comparison}>{comparisonText}</Text>
              )}
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>nothing tracked today</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background_primary,
  },
  header: {
    paddingTop: 48,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  heading: {
    fontFamily: typography.fontFamily,
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    color: colors.text_primary,
  },
  subheading: {
    fontFamily: typography.fontFamily,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.text_muted,
    marginTop: 4,
  },
  summary: {
    paddingHorizontal: 24,
    marginTop: 8,
    marginBottom: 24,
  },
  totalTime: {
    fontFamily: typography.fontFamily,
    fontSize: typography.timer.fontSize,
    lineHeight: typography.timer.lineHeight,
    color: colors.text_body,
  },
  totalOpens: {
    fontFamily: typography.fontFamily,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.text_muted,
    marginTop: 4,
  },
  comparison: {
    fontFamily: typography.fontFamily,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.text_muted,
    marginTop: 8,
  },
  listContent: {
    paddingBottom: 48,
  },
  appRow: {
    marginHorizontal: 24,
    backgroundColor: colors.background_surface,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  appName: {
    fontFamily: typography.fontFamily,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.text_primary,
  },
  appStats: {
    fontFamily: typography.fontFamily,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.text_muted,
    marginTop: 2,
  },
  centeredContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  permissionText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.text_body,
  },
  grantButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  grantText: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    color: colors.text_muted,
  },
  pressed: {
    opacity: 0.7,
  },
  emptyContainer: {
    paddingTop: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.text_muted,
  },
});

export default UsageDetailScreen;
