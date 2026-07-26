import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';

// Scoring lives here as data so the table can never drift out of step with the
// prose around it. These mirror the backend's scoring engine.
const SCORING = [
  { slot: 'Pole', points: 5, note: 'Who takes pole position' },
  { slot: 'P1', points: 15, note: 'Race winner' },
  { slot: 'P2', points: 10, note: 'Second place' },
  { slot: 'P3', points: 8, note: 'Third place' },
];

const STEPS = [
  {
    n: '1',
    title: 'Pick four drivers',
    body: 'Open the next Grand Prix and choose who takes pole, plus your top three finishers.',
  },
  {
    n: '2',
    title: 'Lock in before Practice 1',
    body: 'Change your picks as often as you like until FP1 starts. After that the race is locked.',
  },
  {
    n: '3',
    title: 'Collect points',
    body: 'Once the results are in, exact matches score. Points add up across the season.',
  },
];

export default function AboutScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      <Text style={styles.title}>
        How <Text style={styles.titleAccent}>Banker Lapp</Text> works
      </Text>
      <Text style={styles.subtitle}>Predict the front of the grid. Beat your mates over a season.</Text>

      {STEPS.map((step) => (
        <View key={step.n} style={styles.step}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>{step.n}</Text>
          </View>
          <View style={styles.stepBody}>
            <Text style={styles.stepTitle}>{step.title}</Text>
            <Text style={styles.stepText}>{step.body}</Text>
          </View>
        </View>
      ))}

      <Text style={[typography.sectionHeaderCompact, styles.sectionHeader]}>Points</Text>
      <View style={styles.card}>
        {SCORING.map((row, i) => (
          <View key={row.slot} style={[styles.scoreRow, i === SCORING.length - 1 && styles.lastRow]}>
            <Text style={styles.scoreSlot}>{row.slot}</Text>
            <Text style={styles.scoreNote}>{row.note}</Text>
            <Text style={styles.scorePoints}>{row.points}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.footnote}>
        Only exact matches score — the right driver in the right place. Your pole pick can also be your P1, but
        P1, P2 and P3 must be three different drivers.
      </Text>

      <Text style={[typography.sectionHeaderCompact, styles.sectionHeader]}>Timing</Text>
      <View style={styles.card}>
        <View style={styles.timingRow}>
          <Text style={styles.timingLabel}>Opens</Text>
          <Text style={styles.timingValue}>As soon as the previous race finishes</Text>
        </View>
        <View style={[styles.timingRow, styles.lastRow]}>
          <Text style={styles.timingLabel}>Locks</Text>
          <Text style={styles.timingValue}>The moment Practice 1 starts</Text>
        </View>
      </View>
      <Text style={styles.footnote}>
        All times are shown in your own timezone. Check the Info tab on any race for its session times and
        circuit layout.
      </Text>

      <Text style={styles.credit}>
        Schedule and driver data from the Jolpica F1 API. Circuit layouts from the f1-circuits dataset (MIT).
        Unofficial and not associated with Formula 1.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgCarbon,
  },
  inner: {
    padding: 20,
    paddingTop: 64,
    paddingBottom: 40,
  },
  title: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 24,
    color: colors.textPrimary,
  },
  titleAccent: {
    color: colors.f1Red,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 6,
    marginBottom: 24,
  },
  step: {
    flexDirection: 'row',
    marginBottom: 18,
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.f1Red,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepBadgeText: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 13,
    color: colors.textPrimary,
  },
  stepBody: {
    flex: 1,
  },
  stepTitle: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 3,
  },
  stepText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  sectionHeader: {
    marginTop: 12,
    marginBottom: 8,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: 8,
    paddingHorizontal: 14,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderColor,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  scoreSlot: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 13,
    color: colors.accentGold,
    width: 46,
  },
  scoreNote: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
  scorePoints: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 15,
    color: colors.textPrimary,
  },
  timingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderColor,
  },
  timingLabel: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 13,
    color: colors.accentGreen,
    width: 58,
  },
  timingValue: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
  footnote: {
    ...typography.caption,
    marginTop: 8,
    lineHeight: 17,
  },
  credit: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 26,
    lineHeight: 15,
  },
});
