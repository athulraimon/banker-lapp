import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors } from '../../src/theme/colors';
import FadeInView from '../../src/components/anim/FadeInView';
import { staggerDelay } from '../../src/theme/motion';

// Scoring lives here as data so the table can never drift out of step with the
// prose around it. These mirror the backend's scoring engine.
const SCORING = [
  { slot: 'Pole', points: 5, note: 'Who takes pole position' },
  { slot: 'P1', points: 15, note: 'Race winner' },
  { slot: 'P2', points: 10, note: 'Second place' },
  { slot: 'P3', points: 8, note: 'Third place' },
];

const STEPS = [
  { n: '1', title: 'Pick four drivers', body: 'Open the next Grand Prix and choose who takes pole, plus your top three finishers.' },
  { n: '2', title: 'Lock in before Practice 1', body: 'Change your picks as often as you like until FP1 starts. After that the race is locked.' },
  { n: '3', title: 'Collect points', body: 'Once the results are in, exact matches score. Points add up across the season.' },
];

export default function AboutScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      <Text style={styles.title}>How it works</Text>
      <Text style={styles.subtitle}>Predict the front of the grid. Beat your mates over a season.</Text>

      {STEPS.map((step, i) => (
        <FadeInView key={step.n} delay={staggerDelay(i)} offsetY={10}>
          <View style={styles.step}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>{step.n}</Text>
            </View>
            <View style={styles.stepBody}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepText}>{step.body}</Text>
            </View>
          </View>
        </FadeInView>
      ))}

      <Text style={styles.sectionHeader}>Points</Text>
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
        Only exact matches score. Your pole pick can also be your P1, but P1, P2 and P3 must be three different drivers.
      </Text>

      <Text style={styles.sectionHeader}>Timing</Text>
      <View style={styles.card}>
        <View style={styles.timingRow}>
          <Text style={[styles.timingLabel, { color: colors.accentGreen }]}>Opens</Text>
          <Text style={styles.timingValue}>As soon as the previous race finishes</Text>
        </View>
        <View style={[styles.timingRow, styles.lastRow]}>
          <Text style={[styles.timingLabel, { color: colors.redText }]}>Locks</Text>
          <Text style={styles.timingValue}>The moment Practice 1 starts</Text>
        </View>
      </View>
      <Text style={styles.footnote}>
        Schedule and driver data from the Jolpica F1 API. Circuit layouts from the f1-circuits dataset (MIT).
        Unofficial and not associated with Formula 1.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgCarbon },
  inner: { padding: 20, paddingTop: 64, paddingBottom: 40 },
  title: { fontFamily: 'Jost-Bold', fontSize: 26, color: colors.textPrimary },
  subtitle: { fontFamily: 'Karla-Regular', fontSize: 13.5, color: colors.textSecondary, marginTop: 6, marginBottom: 24 },
  step: { flexDirection: 'row', gap: 14, marginBottom: 20 },
  stepBadge: {
    width: 30, height: 30, borderRadius: 15,
    borderWidth: 1, borderColor: colors.brass,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  stepBadgeText: { fontFamily: 'Jost-Bold', fontSize: 13, color: colors.brass },
  stepBody: { flex: 1 },
  stepTitle: { fontFamily: 'Jost-SemiBold', fontSize: 15, color: colors.textPrimary },
  stepText: { fontFamily: 'Karla-Regular', fontSize: 13, color: colors.textSecondary, lineHeight: 20, marginTop: 3 },
  sectionHeader: {
    fontFamily: 'Jost-SemiBold',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    marginTop: 20,
    marginBottom: 10,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: 10,
    backgroundColor: colors.bgCard,
    paddingHorizontal: 14,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderFaint,
  },
  lastRow: { borderBottomWidth: 0 },
  scoreSlot: { fontFamily: 'Jost-Bold', fontSize: 12.5, color: colors.brass, width: 46 },
  scoreNote: { fontFamily: 'Karla-Regular', fontSize: 13, color: colors.textSecondary, flex: 1 },
  scorePoints: { fontFamily: 'Jost-Bold', fontSize: 14, color: colors.textPrimary },
  timingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderFaint,
  },
  timingLabel: { fontFamily: 'Jost-Bold', fontSize: 12.5, width: 60 },
  timingValue: { fontFamily: 'Karla-Regular', fontSize: 13, color: colors.textSecondary, flex: 1 },
  footnote: { fontFamily: 'Karla-Regular', fontSize: 11.5, color: colors.textMuted, marginTop: 10, lineHeight: 17 },
});
