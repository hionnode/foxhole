import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { triggerHaptic } from '@/utils/haptics';

interface StepperProps {
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  label?: string;
}

export const Stepper: React.FC<StepperProps> = ({
  value,
  onValueChange,
  min,
  max,
  step = 1,
  label,
}) => {
  const handleDecrement = () => {
    const next = value - step;
    if (next >= min) {
      triggerHaptic();
      onValueChange(next);
    }
  };

  const handleIncrement = () => {
    const next = value + step;
    if (next <= max) {
      triggerHaptic();
      onValueChange(next);
    }
  };

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        <Pressable
          onPress={handleDecrement}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.pressed,
          ]}
          hitSlop={4}>
          <Text style={styles.buttonText}>-</Text>
        </Pressable>
        <Text style={styles.value}>{value}</Text>
        <Pressable
          onPress={handleIncrement}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.pressed,
          ]}
          hitSlop={4}>
          <Text style={styles.buttonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  label: {
    fontFamily: typography.fontFamily,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.text_muted,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  button: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  buttonText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    color: colors.text_muted,
  },
  value: {
    fontFamily: typography.fontFamily,
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    color: colors.text_primary,
    minWidth: 48,
    textAlign: 'center',
  },
});
