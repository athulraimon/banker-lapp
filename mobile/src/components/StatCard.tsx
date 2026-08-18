import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';

interface Props {
  // Small uppercase caption at the top of the card.
  label: string;
  value: string | number;
  // Optional line under the value, e.g. "of 12 races".
  sub?: string;
  // Optional chip in the top-right, e.g. a slot's point value.
  chip?: string;
  valueColor?: string;
  style?: StyleProp<ViewStyle>;
}

// A square tile for one statistic.
//
// Square on purpose: a row of them divides the available width evenly and the
// heights follow, so the strip reads as one block rather than a ragged list.
// Type is sized for a four-up row on a phone, which is the tightest case.
export default function StatCard({ label, value, sub, chip, valueColor, style }: Props) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.top}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        {!!chip && <Text style={styles.chip}>{chip}</Text>}
      </View>
      <View style={styles.body}>
        <Text style={[styles.value, !!valueColor && { color: valueColor }]} numberOfLines={1}>
          {value}
        </Text>
        {!!sub && (
          <Text style={styles.sub} numberOfLines={1}>
            {sub}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: 12,
    backgroundColor: colors.bgCard,
    padding: 9,
    justifyContent: 'space-between',
    minWidth: 0,
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  label: {
    flex: 1,
    fontFamily: 'Jost-SemiBold',
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '600',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  chip: {
    fontFamily: 'Jost-SemiBold',
    fontSize: 8.5,
    lineHeight: 12,
    letterSpacing: 0.6,
    color: colors.brassDim,
    flexShrink: 0,
  },
  body: {},
  value: {
    fontFamily: 'Jost-Bold',
    fontSize: 22,
    lineHeight: 26,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  sub: {
    fontFamily: 'Karla-Regular',
    fontSize: 9.5,
    lineHeight: 14,
    color: colors.textMuted,
    marginTop: 1,
  },
});
