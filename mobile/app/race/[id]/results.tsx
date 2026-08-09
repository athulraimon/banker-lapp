import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../src/theme/colors';
import { racesApi, Race, RaceResultWithPredictions } from '../../../src/api/races';
import { predictionsApi, Prediction } from '../../../src/api/predictions';
import LoadingScreen from '../../../src/components/LoadingScreen';
import CheckerStripe from '../../../src/components/CheckerStripe';
import FadeInView from '../../../src/components/anim/FadeInView';
import { staggerDelay } from '../../../src/theme/motion';

export default function RaceResultsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [race, setRace] = useState<Race | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [raceResults, setRaceResults] = useState<RaceResultWithPredictions | null>(null);

  useEffect(() => {
    if (id) {
      racesApi.getRace(id as string).then(setRace).catch(console.error);
      predictionsApi.getPrediction(id as string).then(setPrediction).catch(console.error);
      racesApi.getRaceResults(id as string).then(setRaceResults).catch(console.error);
    }
  }, [id]);

  if (!race) return <LoadingScreen label="Loading race…" />;

  const userScore = raceResults?.race_scores?.find(s => s.user_id === prediction?.user_id);
  const actual = raceResults?.race_result;
  const weekendOver = Date.now() > new Date(race.race_time).getTime() + 4 * 60 * 60 * 1000;

  const slots = [
    { key: 'pole', label: 'POLE' },
    { key: 'p1', label: 'P1' },
    { key: 'p2', label: 'P2' },
    { key: 'p3', label: 'P3' },
  ] as const;

  const pointsFor = (label: string) => ({ POLE: 5, P1: 15, P2: 10, P3: 8 } as Record<string, number>)[label] ?? 0;
  const getPoints = (userPred: string, actualVal: string, label: string) =>
    userPred && userPred === actualVal ? pointsFor(label) : 0;

  const actualVal = (key: string) => ((actual as Record<string, string> | null | undefined)?.[`${key}_driver_id`]) || '';
  const predVal = (key: string) => ((prediction as Record<string, string> | null | undefined)?.[`${key}_driver_id`]) || '';

  const correctCount = slots.filter(s => {
    const mine = predVal(s.key);
    return !!mine && mine === actualVal(s.key);
  }).length;

  const compareRow = (label: string, mine: string, act: string) => {
    const hit = !!mine && mine === act;
    const pts = getPoints(mine, act, label);
    return (
      <View key={label} style={styles.cmpRow}>
        <Text style={styles.cmpSlot}>{label}</Text>
        <Text style={[styles.cmpYour, { color: hit ? colors.textPrimary : colors.textMuted }]} numberOfLines={1}>{mine || '—'}</Text>
        <Text style={[styles.cmpMark, { color: hit ? colors.accentGreen : colors.redText }]}>{hit ? '✓' : '✕'}</Text>
        <Text style={styles.cmpActual} numberOfLines={1}>{act || '—'}</Text>
        <Text style={[styles.cmpPts, { color: pts ? colors.brass : colors.textMuted }]}>{pts ? `+${pts}` : '0'}</Text>
      </View>
    );
  };

  const competitorPicks = (userId: string) => {
    const p = raceResults?.predictions.find(x => x.user_id === userId);
    if (!p) return '—';
    return [p.pole_driver_id, p.p1_driver_id, p.p2_driver_id, p.p3_driver_id].map(v => v || '–').join(' · ');
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Race breakdown</Text>
        <Text style={[styles.badge, !weekendOver && styles.badgeProvisional]}>
          {weekendOver ? 'Finished' : 'Provisional'}
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false}>
        {/* Summary */}
        <FadeInView>
          <View style={styles.summary}>
            <CheckerStripe colorA={colors.cream} colorB={colors.heroBottom} />
            <View style={styles.summaryBody}>
              <Text style={styles.summaryEyebrow}>{race.season} Season</Text>
              <Text style={styles.summaryName}>{race.grand_prix}</Text>
              <Text style={styles.summaryPoints}>+{userScore?.points || 0}</Text>
              <Text style={styles.summaryCaption}>Points earned · {correctCount} of 4 correct</Text>
            </View>
          </View>
        </FadeInView>

        {/* Comparison */}
        <Text style={styles.eyebrow}>Your picks vs the result</Text>
        {slots.map(s => compareRow(s.label, predVal(s.key), actualVal(s.key)))}

        {/* Competitors */}
        <Text style={[styles.eyebrow, { marginTop: 22 }]}>How everyone scored</Text>
        {raceResults?.race_scores?.length ? (
          raceResults.race_scores.map((score, index) => {
            const isYou = score.user_id === prediction?.user_id;
            return (
              <FadeInView key={score.user_id} delay={staggerDelay(index)} offsetY={8}>
                <View style={[styles.compRow, isYou && styles.compRowYou]}>
                  <Text style={styles.compRank}>{String(index + 1).padStart(2, '0')}</Text>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.compName} numberOfLines={1}>{score.user_name}{isYou ? ' (You)' : ''}</Text>
                    <Text style={styles.compPicks} numberOfLines={1}>{competitorPicks(score.user_id)}</Text>
                  </View>
                  <Text style={styles.compPts}>{score.points}</Text>
                </View>
              </FadeInView>
            );
          })
        ) : (
          <Text style={styles.note}>No scores yet — results haven’t been entered for this race.</Text>
        )}

        <TouchableOpacity style={styles.viewBtn} onPress={() => router.push('/(tabs)/standings')} activeOpacity={0.85}>
          <Text style={styles.viewBtnText}>View championship</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPhone },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderFaint,
  },
  backBtn: {
    width: 30, height: 30, borderRadius: 8,
    borderWidth: 1, borderColor: colors.borderColor,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { flex: 1, fontFamily: 'Jost-Bold', fontSize: 15, textTransform: 'uppercase', letterSpacing: 0.4, color: colors.textPrimary },
  badge: {
    fontFamily: 'Jost-SemiBold',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(158,148,129,0.14)',
    color: colors.textSecondary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  badgeProvisional: { backgroundColor: 'rgba(201,162,39,0.15)', color: colors.brass, borderColor: 'rgba(201,162,39,0.4)' },

  inner: { padding: 16, paddingBottom: 40 },

  summary: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.heroTop,
  },
  summaryBody: { padding: 18, alignItems: 'center' },
  summaryEyebrow: {
    fontFamily: 'Jost-SemiBold',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  summaryName: { fontFamily: 'Jost-Bold', fontSize: 19, color: colors.textPrimary, marginTop: 4, textAlign: 'center' },
  summaryPoints: { fontFamily: 'Jost-Bold', fontSize: 44, color: colors.brass, marginTop: 10, lineHeight: 46, fontVariant: ['tabular-nums'] },
  summaryCaption: {
    fontFamily: 'Karla-Regular',
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    marginTop: 6,
  },

  eyebrow: {
    fontFamily: 'Jost-SemiBold',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    marginTop: 22,
    marginBottom: 10,
  },

  cmpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: 9,
    backgroundColor: colors.bgCard,
    marginBottom: 8,
  },
  cmpSlot: { fontFamily: 'Jost-Bold', fontSize: 11, letterSpacing: 1, color: colors.textSecondary, width: 34 },
  cmpYour: { fontFamily: 'Jost-SemiBold', fontSize: 14, flex: 1 },
  cmpMark: { fontSize: 13, width: 20, textAlign: 'center' },
  cmpActual: { fontFamily: 'Jost-SemiBold', fontSize: 14, color: colors.textSecondary, flex: 1, textAlign: 'right' },
  cmpPts: { fontFamily: 'Jost-Bold', fontSize: 13, width: 40, textAlign: 'right' },

  compRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.borderColor,
    backgroundColor: colors.bgCard,
    marginBottom: 8,
  },
  compRowYou: { backgroundColor: 'rgba(168,41,28,0.10)', borderColor: 'rgba(168,41,28,0.5)' },
  compRank: { fontFamily: 'Jost-Bold', fontSize: 13, color: colors.textSecondary, width: 20 },
  compName: { fontFamily: 'Jost-SemiBold', fontSize: 14, color: colors.textPrimary },
  compPicks: { fontFamily: 'Karla-Regular', fontSize: 11.5, color: colors.textSecondary, marginTop: 2 },
  compPts: { fontFamily: 'Jost-Bold', fontSize: 18, color: colors.brass, fontVariant: ['tabular-nums'] },

  note: { fontFamily: 'Karla-Regular', fontSize: 12.5, color: colors.textMuted, marginTop: 4 },

  viewBtn: {
    marginTop: 16,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewBtnText: {
    fontFamily: 'Jost-SemiBold',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textPrimary,
  },
});
