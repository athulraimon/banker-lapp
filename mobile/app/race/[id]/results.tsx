import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors } from '../../../src/theme/colors';
import { typography } from '../../../src/theme/typography';
import { racesApi, Race, RaceResultWithPredictions } from '../../../src/api/races';
import { predictionsApi, Prediction } from '../../../src/api/predictions';
import LoadingScreen from '../../../src/components/LoadingScreen';
import SegmentedTabs from '../../../src/components/SegmentedTabs';
import RaceInfoPanel from '../../../src/components/RaceInfoPanel';

type RaceTab = 'predictions' | 'info';

export default function RaceResultsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [race, setRace] = useState<Race | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [raceResults, setRaceResults] = useState<RaceResultWithPredictions | null>(null);
  // Mirrors the prediction editor so a race feels the same whether it is open
  // or locked: results lead, circuit and session times sit behind Info.
  const [tab, setTab] = useState<RaceTab>('predictions');

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
  // The race weekend is only "finished" ~4h after the race start; before that,
  // any entered results are provisional.
  const weekendOver = Date.now() > new Date(race.race_time).getTime() + 4 * 60 * 60 * 1000;

  const getPoints = (userPred: string, actualVal: string) => {
    if (userPred && userPred === actualVal) {
      if (actualVal === actual?.pole_driver_id) return 5;
      if (actualVal === actual?.p1_driver_id) return 15;
      if (actualVal === actual?.p2_driver_id) return 10;
      if (actualVal === actual?.p3_driver_id) return 8;
    }
    return 0;
  };

  const renderComparisonRow = (label: string, userPred: string, actualVal: string) => {
    const points = getPoints(userPred, actualVal);
    const isHit = userPred === actualVal && userPred !== '';
    
    return (
      <View style={styles.comparisonRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.compVal}>{userPred || '-'}</Text>
        </View>
        
        {isHit ? (
          <View style={[styles.compStatus, styles.hitStatus]}>
            <Text style={{ color: colors.accentGreen, fontSize: 12 }}>✓</Text>
          </View>
        ) : (
          <View style={[styles.compStatus, styles.missStatus]}>
            <Text style={{ color: colors.statusLocked, fontSize: 12 }}>✕</Text>
          </View>
        )}
        
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={styles.compVal}>{actualVal || '-'}</Text>
          <Text style={styles.compLabel}>{label} · {points} Pts</Text>
        </View>
      </View>
    );
  };

  // A single podium pick shown as a chip, green when it matches the official result.
  const pickChip = (label: string, pick: string, actualVal?: string) => {
    const hit = !!pick && pick === actualVal;
    return (
      <View style={[styles.chip, hit && styles.chipHit]}>
        <Text style={styles.chipLabel}>{label}</Text>
        <Text style={[styles.chipVal, hit && styles.chipValHit]}>{pick || '–'}</Text>
      </View>
    );
  };

  const renderCompetitorRow = (
    score: { user_id: string; user_name: string; points: number; correct_winner: boolean },
    index: number
  ) => {
    const pred = raceResults?.predictions.find((p) => p.user_id === score.user_id);
    const isYou = score.user_id === prediction?.user_id;
    return (
      <View style={[styles.competitorRow, isYou && styles.topCompetitor]}>
        <Text style={styles.compRank}>{(index + 1).toString().padStart(2, '0')}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.competitorName}>
            {score.user_name}
            {isYou ? ' (You)' : ''}
          </Text>
          <View style={styles.chipRow}>
            {pickChip('POLE', pred?.pole_driver_id || '', actual?.pole_driver_id)}
            {pickChip('P1', pred?.p1_driver_id || '', actual?.p1_driver_id)}
            {pickChip('P2', pred?.p2_driver_id || '', actual?.p2_driver_id)}
            {pickChip('P3', pred?.p3_driver_id || '', actual?.p3_driver_id)}
          </View>
        </View>
        <View style={styles.competitorPoints}>
          <Text style={styles.competitorPointsVal}>{score.points}</Text>
          <Text style={styles.competitorPointsLabel}>pts</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.appTitle}>Race Breakdown</Text>
        <Text style={[styles.badgeCompleted, !weekendOver && styles.badgeProvisional]}>
          {weekendOver ? 'Finished' : 'Provisional'}
        </Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryBox}>
          <Text style={styles.roundText}>Round {race.season} results</Text>
          <Text style={styles.raceName}>{race.grand_prix}</Text>
          <Text style={styles.pointsEarned}>+{userScore?.points || 0} <Text style={styles.pointsLabel}>Points Earned</Text></Text>
        </View>

        <SegmentedTabs<RaceTab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'predictions', label: 'Predictions' },
            { value: 'info', label: 'Info' },
          ]}
        />

        {tab === 'info' ? (
          <RaceInfoPanel race={race} />
        ) : (
          <>
        <Text style={typography.sectionHeaderCompact}>Your Prediction vs Actual</Text>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.compLabel}>Your Bet</Text>
            <Text style={[styles.compLabel, { textAlign: 'right' }]}>Official Result</Text>
          </View>
          
          <View style={styles.cardBody}>
            {renderComparisonRow('POLE', prediction?.pole_driver_id || '', actual?.pole_driver_id || '')}
            {renderComparisonRow('P1', prediction?.p1_driver_id || '', actual?.p1_driver_id || '')}
            {renderComparisonRow('P2', prediction?.p2_driver_id || '', actual?.p2_driver_id || '')}
            {renderComparisonRow('P3', prediction?.p3_driver_id || '', actual?.p3_driver_id || '')}
          </View>
        </View>

        <Text style={typography.sectionHeaderCompact}>Competitor Results</Text>
        
        <View style={styles.card}>
          {raceResults?.race_scores?.length ? (
            raceResults.race_scores.map((score, index) => (
              <View key={score.user_id}>{renderCompetitorRow(score, index)}</View>
            ))
          ) : (
            <View style={styles.cardBody}>
              <Text style={styles.compLabel}>No scores yet — results haven’t been entered for this race.</Text>
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.btnSecondary} onPress={() => router.push('/(tabs)/standings')}>
          <Text style={styles.btnSecondaryText}>View Global Standings</Text>
        </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgCarbon,
  },
  header: {
    height: 56,
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderColor,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 48,
  },
  appTitle: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 18,
    color: colors.textPrimary,
  },
  badgeCompleted: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 10,
    textTransform: 'uppercase',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    color: colors.textSecondary,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)',
    overflow: 'hidden',
  },
  badgeProvisional: {
    backgroundColor: 'rgba(255, 183, 3, 0.15)',
    color: colors.accentGold,
    borderColor: 'rgba(255, 183, 3, 0.3)',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 16,
    paddingBottom: 40,
  },
  summaryBox: {
    backgroundColor: colors.bgCard,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderColor,
    alignItems: 'center',
    marginBottom: 20,
  },
  roundText: {
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  raceName: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 22,
    marginTop: 4,
    color: colors.textPrimary,
  },
  pointsEarned: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 24,
    color: colors.accentGreen,
    marginTop: 8,
  },
  pointsLabel: {
    fontFamily: 'Outfit-Regular',
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '400',
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderColor,
    overflow: 'hidden',
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderColor,
  },
  cardBody: {
    padding: 16,
    paddingTop: 8,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  compLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  compVal: {
    fontFamily: 'Outfit-Regular',
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  compStatus: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
  },
  hitStatus: {
    backgroundColor: 'rgba(0, 245, 212, 0.15)',
  },
  missStatus: {
    backgroundColor: 'rgba(255, 51, 51, 0.1)',
  },
  competitorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  topCompetitor: {
    backgroundColor: 'rgba(225, 6, 0, 0.06)',
    borderLeftWidth: 3,
    borderLeftColor: colors.f1Red,
  },
  compRank: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 14,
    color: colors.textMuted,
    width: 24,
  },
  competitorName: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 14,
    color: colors.textPrimary,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignItems: 'center',
    minWidth: 42,
  },
  chipHit: {
    backgroundColor: 'rgba(0, 245, 212, 0.12)',
    borderColor: 'rgba(0, 245, 212, 0.4)',
  },
  chipLabel: {
    fontSize: 8,
    color: colors.textMuted,
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  chipVal: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 12,
    color: colors.textSecondary,
  },
  chipValHit: {
    color: colors.accentGreen,
  },
  competitorPoints: {
    alignItems: 'center',
    minWidth: 44,
  },
  competitorPointsVal: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 18,
    color: colors.f1Red,
  },
  competitorPointsLabel: {
    fontSize: 9,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borderColor,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  btnSecondaryText: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 14,
    color: colors.textPrimary,
  }
});