import React, { useMemo } from 'react';
import { StyleSheet, Text, View, SectionList } from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { useSessionStore } from '@/stores/sessionStore';
import { usePresetStore } from '@/stores/presetStore';
import type { Session } from '@/types';
import { getLocalDateString } from '@/utils/date';
import { getSessionTypeLabel } from '@/utils/formatTime';

interface SessionSection {
  title: string;
  data: Session[];
}

const formatSectionTitle = (dateStr: string): string => {
  const today = getLocalDateString();
  if (dateStr === today) {
    return 'today';
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterday.getTime());
  if (dateStr === yesterdayStr) {
    return 'yesterday';
  }

  const [, monthStr, dayStr] = dateStr.split('-');
  const monthIndex = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);
  const monthNames = [
    'jan', 'feb', 'mar', 'apr', 'may', 'jun',
    'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
  ];
  return `${monthNames[monthIndex]} ${day}`;
};

const formatStartTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12;
  if (hours === 0) {
    hours = 12;
  }
  const minuteStr = String(minutes).padStart(2, '0');
  return `${hours}:${minuteStr} ${ampm}`;
};

const formatDuration = (ms: number): string => {
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 1) {
    return '<1 min';
  }
  return `${totalMinutes} min`;
};

const getStatusLabel = (session: Session): string | null => {
  if (session.wasSkipped) {
    return 'skipped';
  }
  if (!session.wasCompleted) {
    return 'abandoned';
  }
  return null;
};

const SessionRow = React.memo(({ session }: { session: Session }) => {
  const statusLabel = getStatusLabel(session);
  const isMuted = statusLabel !== null;
  const textColor = isMuted ? colors.text_muted : colors.text_body;

  return (
    <View style={styles.sessionRow}>
      <View style={styles.sessionTopRow}>
        <Text style={[styles.sessionText, { color: textColor }]}>
          {formatStartTime(session.startedAt)}
        </Text>
        <Text style={[styles.sessionText, { color: textColor }]}>{' \u00b7 '}</Text>
        <Text style={[styles.sessionText, { color: textColor }]}>
          {formatDuration(session.actualDurationMs)}
        </Text>
      </View>
      <View style={styles.sessionBottomRow}>
        <Text style={[styles.sessionType, { color: textColor }]}>
          {getSessionTypeLabel(session.sessionType)}
        </Text>
        <Text style={[styles.sessionText, { color: textColor }]}>{' \u00b7 '}</Text>
        <Text style={[styles.sessionPreset, { color: textColor }]}>
          {statusLabel ?? session.presetName}
        </Text>
      </View>
    </View>
  );
});

const SectionHeader = ({ title }: { title: string }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionHeaderText}>{title}</Text>
  </View>
);

const EmptyState = () => (
  <View style={styles.emptyContainer}>
    <Text style={styles.emptyText}>no sessions yet. dig in.</Text>
  </View>
);

const HistoryScreen = () => {
  const allSessions = useSessionStore((s) => s.allSessions);
  const todayCompletedCount = useSessionStore((s) => s.todayCompletedCount);
  const currentStreak = useSessionStore((s) => s.currentStreak);
  const dailyGoal = usePresetStore((s) => s.dailyGoal);

  const sections: SessionSection[] = useMemo(() => {
    const groups: Record<string, Session[]> = {};
    const order: string[] = [];

    for (const session of allSessions) {
      const dateKey = getLocalDateString(session.startedAt);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
        order.push(dateKey);
      }
      groups[dateKey].push(session);
    }

    return order.map((dateKey) => ({
      title: formatSectionTitle(dateKey),
      data: groups[dateKey],
    }));
  }, [allSessions]);

  if (allSessions.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.heading}>history</Text>
        </View>
        <EmptyState />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <SessionRow session={item} />}
        renderSectionHeader={({ section }) => (
          <SectionHeader title={section.title} />
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.heading}>history</Text>
            <Text style={styles.statsText}>
              {currentStreak} day streak
            </Text>
            <Text style={styles.statsText}>
              {todayCompletedCount} of {dailyGoal} today
            </Text>
          </View>
        }
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.listContent}
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
  statsText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.text_muted,
    marginTop: 4,
  },
  listContent: {
    paddingBottom: 24,
  },
  sectionHeader: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 8,
  },
  sectionHeaderText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.text_muted,
  },
  sessionRow: {
    marginHorizontal: 24,
    backgroundColor: colors.background_surface,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  sessionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sessionBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  sessionText: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text_body,
  },
  sessionType: {
    fontFamily: typography.fontFamily,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.text_body,
  },
  sessionPreset: {
    fontFamily: typography.fontFamily,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.text_body,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.text_muted,
  },
});

export default HistoryScreen;
