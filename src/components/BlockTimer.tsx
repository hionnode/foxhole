import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { formatTime } from '@/utils/formatTime';
import type { SessionType } from '@/types';

interface BlockTimerProps {
  remainingMs: number;
  totalMs: number;
  sessionType: SessionType;
}

const RING_SIZE = 280;
const BLOCK_SIZE = 14;
const RING_RADIUS = (RING_SIZE - BLOCK_SIZE) / 2;

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

export const BlockTimer: React.FC<BlockTimerProps> = ({
  remainingMs,
  totalMs,
  sessionType,
}) => {
  const totalBlocks = Math.max(1, Math.round(totalMs / 60000));
  const elapsedBlocks = Math.floor((totalMs - remainingMs) / 60000);

  const blocks = useMemo(() => {
    const items: { x: number; y: number; filled: boolean }[] = [];
    const centerX = RING_SIZE / 2 - BLOCK_SIZE / 2;
    const centerY = RING_SIZE / 2 - BLOCK_SIZE / 2;

    for (let i = 0; i < totalBlocks; i++) {
      // Start from 12 o'clock (-90deg), go clockwise
      const angle = ((2 * Math.PI) / totalBlocks) * i - Math.PI / 2;
      const x = centerX + RING_RADIUS * Math.cos(angle);
      const y = centerY + RING_RADIUS * Math.sin(angle);
      const filled = i >= elapsedBlocks;

      items.push({ x, y, filled });
    }

    return items;
  }, [totalBlocks, elapsedBlocks]);

  return (
    <View style={styles.container}>
      <View style={styles.ring}>
        {blocks.map((block, index) => (
          <View
            key={index}
            style={[
              styles.block,
              {
                left: block.x,
                top: block.y,
                backgroundColor: block.filled
                  ? colors.text_body
                  : colors.background_elevated,
              },
            ]}
          />
        ))}
        <View style={styles.center}>
          <Text style={styles.time}>{formatTime(remainingMs)}</Text>
          <Text style={styles.label}>{getSessionLabel(sessionType)}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    position: 'relative',
  },
  block: {
    position: 'absolute',
    width: BLOCK_SIZE,
    height: BLOCK_SIZE,
    borderRadius: 2,
  },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  time: {
    fontFamily: typography.fontFamily,
    fontSize: typography.timer.fontSize,
    lineHeight: typography.timer.lineHeight,
    color: colors.text_body,
  },
  label: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text_muted,
    marginTop: 4,
  },
});
