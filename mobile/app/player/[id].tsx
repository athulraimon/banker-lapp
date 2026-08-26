import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme/colors';
import {
  standingsApi,
  PlayerProfile,
  PlayerRaceEntry,
  SlotComparison,
} from '../../src/api/standings';
import { useAuthStore } from '../../src/store/useAuthStore';
import LoadingScreen from '../../src/components/LoadingScreen';
import SignInWall from '../../src/components/SignInWall';
import StatCard from '../../src/components/StatCard';
import CheckerStripe from '../../src/components/CheckerStripe';
import FadeInView from '../../src/components/anim/FadeInView';
import PressableScale from '../../src/components/anim/PressableScale';
import { staggerDelay } from '../../src/theme/motion';

const pad = (n: number) => String(n).padStart(2, '0');

// Column order matches the scoring order, and the point values are the ones the
// server awards. Showing the worth on each card makes the weighting visible
// rather than something you have to already know.
const SLOTS = [
  { key: 'pole', label: 'Pole', worth: 5 },
  { key: 'p1', label: 'P1', worth: 15 },
  { key: 'p2', label: 'P2', worth: 10 },
  { key: 'p3', label: 'P3', worth: 8 },
] as const;

export default function PlayerProfileScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!id || !isAuthenticated) return;
    setFailed(false);
    standingsApi
      .getPlayerProfile(id as string)
      .then(setProfile)
      .catch((err) => {
        console.error(err);
        setFailed(true);
      });
  }, [id, isAuthenticated]);

  // Reachable by URL on the web build even though nothing links here for a
  // guest, so the screen refuses on its own rather than trusting its callers.
  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <ProfileHeader onBack={() => router.back()} title="Player" />
        <SignInWall
          title="Members only"
          message="Player seasons — every call they made, race by race — are part of the private championship."
        />
      </View>
    );
  }

  if (failed) {
    return (
      <View style={styles.container}>
        <ProfileHeader onBack={() => router.back()} title="Player" />
        <Text style={styles.errorText}>
          Couldn’t load this player’s season. Go back and try again.
        </Text>
      </View>
    );
  }
  if (!profile) return <LoadingScreen label="Loading player…" />;

  const isYou = profile.user_id === user?.id;
  const races = profile.races_scored;
  const totalHits = profile.pole_hits + profile.p1_hits + profile.p2_hits + profile.p3_hits;
  // Four callable slots per race, so the denominator is races × 4.
  const accuracy = races > 0 ? Math.round((totalHits / (races * 4)) * 100) : 0;

  const hitsFor = (key: string) =>
    ({
      pole: profile.pole_hits,
      p1: profile.p1_hits,
      p2: profile.p2_hits,
      p3: profile.p3_hits,
    }[key] ?? 0);

  const slotOf = (entry: PlayerRaceEntry, key: string) =>
    (entry.breakdown as unknown as Record<string, SlotComparison>)[key];

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  return (
    <View style={styles.container}>
      <ProfileHeader onBack={() => router.back()} title={isYou ? 'Your season' : 'Player season'} />

      <ScrollView contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false}>
        {/* Hero: who they are and where they sit */}
        <FadeInView>
          <View style={styles.hero}>
            <CheckerStripe colorA={colors.brass} colorB={colors.brassDim} />
            <View style={styles.heroBody}>
              <View style={styles.heroHead}>
                <View style={[styles.plate, profile.rank === 1 && styles.plateLeader]}>
                  <Text
                    style={[styles.plateText, profile.rank === 1 && { color: colors.heroBottom }]}
                  >
                    {pad(profile.rank)}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.heroEyebrow}>Championship position</Text>
                  <Text style={styles.heroName} numberOfLines={1}>
                    {profile.user_name}
                    {isYou ? ' (You)' : ''}
                  </Text>
                </View>
              </View>
              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroValue}>{profile.total_points}</Text>
                  <Text style={styles.heroLabel}>points</Text>
                </View>
                <View style={styles.heroDivider} />
                <View style={styles.heroStat}>
                  <Text style={styles.heroValue}>{races}</Text>
                  <Text style={styles.heroLabel}>races</Text>
                </View>
                <View style={styles.heroDivider} />
                <View style={styles.heroStat}>
                  <Text style={[styles.heroValue, { color: colors.brass }]}>{accuracy}%</Text>
                  <Text style={styles.heroLabel}>accuracy</Text>
                </View>
              </View>
            </View>
          </View>
        </FadeInView>

        {/* Square cards: how often each slot was called right */}
        <Text style={styles.eyebrow}>Calls made right</Text>
        <View style={styles.grid}>
          {SLOTS.map((s, i) => (
            <FadeInView key={s.key} delay={staggerDelay(i)} offsetY={8} style={styles.gridCell}>
              <StatCard
                label={s.label}
                chip={s.worth + 'p'}
                value={hitsFor(s.key)}
                sub={races > 0 ? 'of ' + races : 'no races yet'}
                valueColor={hitsFor(s.key) > 0 ? colors.brass : colors.textMuted}
              />
            </FadeInView>
          ))}
        </View>

        {/* Race by race: picks against the official result */}
        <Text style={styles.eyebrow}>Race by race</Text>
        {profile.entries.length === 0 ? (
          <Text style={styles.note}>
            No finished races yet. Races appear here once the player has entered one and it
            has run.
          </Text>
        ) : (
          <>
            <Text style={styles.hint}>
              Every finished race you entered.{' '}
              <Text style={{ color: colors.accentGreen }}>Green</Text> picks matched the official
              result. Tap a race for the full breakdown.
            </Text>
            {profile.entries.map((entry, index) => (
              <FadeInView key={entry.race_id} delay={staggerDelay(index)} offsetY={8}>
                <PressableScale
                  style={styles.raceCard}
                  scaleTo={0.99}
                  onPress={() => router.push('/race/' + entry.race_id + '/results')}
                >
                  <View style={styles.raceHead}>
                    <View style={styles.roundPlate}>
                      <Text style={styles.roundPlateText}>{pad(entry.round)}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.raceName} numberOfLines={1}>
                        {entry.grand_prix}
                      </Text>
                      <Text style={styles.raceSub} numberOfLines={1}>
                        {entry.country} · {fmtDate(entry.race_time)}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      {entry.resulted ? (
                        <>
                          <Text
                            style={[
                              styles.racePts,
                              {
                                color:
                                  entry.breakdown.points > 0 ? colors.brass : colors.textMuted,
                              },
                            ]}
                          >
                            {entry.breakdown.points > 0 ? '+' + entry.breakdown.points : '0'}
                          </Text>
                          <Text style={styles.raceHits}>{entry.breakdown.hits}/4</Text>
                        </>
                      ) : (
                        <Text style={styles.racePending}>Awaiting result</Text>
                      )}
                    </View>
                  </View>

                  {/* Aligned columns, so picked and actual read as one comparison
                      rather than two separate lists. */}
                  <View style={styles.cmp}>
                    <View style={styles.cmpRow}>
                      <Text style={styles.cmpRowLabel} />
                      {SLOTS.map((s) => (
                        <Text key={s.key} style={styles.cmpHead}>
                          {s.label}
                        </Text>
                      ))}
                    </View>
                    <View style={styles.cmpRow}>
                      <Text style={styles.cmpRowLabel}>Picked</Text>
                      {SLOTS.map((s) => {
                        const slot = slotOf(entry, s.key);
                        return (
                          <Text
                            key={s.key}
                            style={[
                              styles.cmpCell,
                              {
                                color: slot.hit
                                  ? colors.accentGreen
                                  : colors.textSecondary,
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {slot.predicted || '—'}
                          </Text>
                        );
                      })}
                    </View>
                    {entry.resulted ? (
                      <View style={styles.cmpRow}>
                        <Text style={styles.cmpRowLabel}>Result</Text>
                        {SLOTS.map((s) => (
                          <Text
                            key={s.key}
                            style={[styles.cmpCell, styles.cmpActual]}
                            numberOfLines={1}
                          >
                            {slotOf(entry, s.key).actual || '—'}
                          </Text>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.cmpPendingNote}>
                        Official result not entered yet.
                      </Text>
                    )}
                  </View>
                </PressableScale>
              </FadeInView>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function ProfileHeader({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack} hitSlop={8}>
        <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
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
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontFamily: 'Jost-Bold',
    fontSize: 15,
    lineHeight: 20,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: colors.textPrimary,
  },
  inner: { padding: 16, paddingBottom: 40 },

  hero: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.heroTop,
  },
  heroBody: { padding: 16 },
  heroHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  plate: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    flexShrink: 0,
  },
  plateLeader: { backgroundColor: colors.brass, borderColor: colors.brass },
  plateText: { fontFamily: 'Jost-Bold', fontSize: 14, lineHeight: 19, color: colors.textPrimary },
  heroEyebrow: {
    fontFamily: 'Jost-SemiBold',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.brass,
  },
  heroName: {
    fontFamily: 'Jost-Bold',
    fontSize: 20,
    lineHeight: 26,
    color: colors.textPrimary,
    marginTop: 2,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.borderColor,
  },
  heroStat: { flex: 1, alignItems: 'center' },
  heroDivider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.borderColor },
  heroValue: {
    fontFamily: 'Jost-Bold',
    fontSize: 22,
    lineHeight: 28,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  heroLabel: {
    fontFamily: 'Karla-Regular',
    fontSize: 9.5,
    lineHeight: 14,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    marginTop: 1,
  },

  eyebrow: {
    fontFamily: 'Jost-SemiBold',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    marginTop: 24,
    marginBottom: 10,
  },
  // One row of four. flexBasis rather than a fixed width so the cards divide
  // whatever width the column has, and stay square via StatCard's aspect ratio.
  grid: { flexDirection: 'row', gap: 8 },
  gridCell: { flexGrow: 1, flexBasis: '22%', minWidth: 0 },

  hint: {
    fontFamily: 'Karla-Regular',
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
    marginBottom: 10,
  },
  note: { fontFamily: 'Karla-Regular', fontSize: 12.5, lineHeight: 18, color: colors.textMuted },

  raceCard: {
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: 11,
    backgroundColor: colors.bgCard,
    padding: 12,
    marginBottom: 9,
  },
  raceHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  roundPlate: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  roundPlateText: { fontFamily: 'Jost-Bold', fontSize: 11.5, lineHeight: 16, color: colors.brass },
  raceName: {
    fontFamily: 'Jost-SemiBold',
    fontSize: 14.5,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  raceSub: {
    fontFamily: 'Karla-Regular',
    fontSize: 11,
    lineHeight: 16,
    color: colors.textSecondary,
    marginTop: 1,
  },
  racePts: { fontFamily: 'Jost-Bold', fontSize: 16, lineHeight: 21, fontVariant: ['tabular-nums'] },
  raceHits: { fontFamily: 'Karla-Regular', fontSize: 10.5, lineHeight: 15, color: colors.textMuted },
  racePending: {
    fontFamily: 'Jost-SemiBold',
    fontSize: 9.5,
    lineHeight: 13,
    maxWidth: 54,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.brassDim,
    textAlign: 'right',
  },
  cmpPendingNote: {
    fontFamily: 'Karla-Regular',
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
    fontStyle: 'italic',
  },

  cmp: {
    marginTop: 11,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderFaint,
    gap: 3,
  },
  cmpRow: { flexDirection: 'row', alignItems: 'center' },
  cmpRowLabel: {
    width: 52,
    fontFamily: 'Karla-Regular',
    fontSize: 9.5,
    lineHeight: 15,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  cmpHead: {
    flex: 1,
    fontFamily: 'Jost-SemiBold',
    fontSize: 9,
    lineHeight: 14,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textMuted,
    textAlign: 'center',
  },
  cmpCell: {
    flex: 1,
    fontFamily: 'Jost-SemiBold',
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
  },
  cmpActual: { color: colors.textMuted },

  errorText: {
    fontFamily: 'Karla-Regular',
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
    padding: 24,
    textAlign: 'center',
  },
});
