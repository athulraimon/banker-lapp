import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../theme/colors';

interface Props<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * Compact segmented control for switching panels within a screen.
 *
 * Deliberately small and self-contained: it sits inside a screen that already
 * has a header and the app's bottom tab bar, so anything larger would read as a
 * third level of navigation competing with those two.
 */
export default function SegmentedTabs<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View style={styles.track}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    // Centred, and sized to its content rather than stretched full width, so it
    // reads as a compact toggle rather than a second navigation bar.
    alignSelf: 'center',
    backgroundColor: colors.bgCardHeader,
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: 7,
    padding: 2,
    marginBottom: 14,
  },
  segment: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 5,
  },
  segmentActive: {
    backgroundColor: colors.f1Red,
  },
  label: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  labelActive: {
    color: colors.textPrimary,
  },
});
