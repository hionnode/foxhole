import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { formatTime } from '@/utils/formatTime';

interface DigitalTimerProps {
  remainingMs: number;
}

export const DigitalTimer: React.FC<DigitalTimerProps> = ({ remainingMs }) => {
  return (
    <View style={styles.container}>
      <Text
        style={styles.timer}
        numberOfLines={1}
        adjustsFontSizeToFit>
        {formatTime(remainingMs)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timer: {
    fontFamily: typography.fontFamily,
    fontSize: typography.timerLarge.fontSize,
    lineHeight: typography.timerLarge.lineHeight,
    color: colors.text_body,
    letterSpacing: 4,
  },
});
