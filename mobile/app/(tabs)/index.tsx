import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Animated } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme/colors';
import { useAuthStore } from '../../src/store/useAuthStore';
import { racesApi, Race } from '../../src/api/races';
import { predictionsApi, Prediction } from '../../src/api/predictions';
import FadeInView from '../../src/components/anim/FadeInView';
import PressableScale from '../../src/components/anim/PressableScale';
import CheckerStripe from '../../src/components/CheckerStripe';
import SwipeViews from '../../src/components/SwipeViews';
import SegmentedTabs from '../../src/components/SegmentedTabs';
import { Skeleton } from '../../src/components/Skeleton';
import { staggerDelay } from '../../src/theme/motion';
import { randomRadioLine } from '../../src/data/radioLines';
import { isWeekendOver } from '../../src/utils/raceWindow';

const pad = (n: number) => String(Math.max(0, Math.floor(n))).padStart(2, '0');

export default function DashboardScreen() {
  const { user, isAuthenticated, isGuest } = useAuthStore();
  const router = useRouter();
  const [races, setRaces] = useState<Race[]>([]);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [tab, setTab] = useState<'upcoming' | 'completed'>('upcoming');
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const progress = useRef(new Animated.Value(0)).current;
  // An iconic F1 line as the greeting, re-rolled every time the dashboard opens.
  const [radioLine, setRadioLine] = useState(randomRadioLine);

  useFocusEffect(useCallback(() => { setRadioLine(randomRadioLine()); }, []));

  useFocusEffect(
    useCallback(() => {
      // Guests get here too: the calendar is public F1 data, and a visitor who
      // cannot see the season has nothing to look at. Only a visitor who is
      // neither signed in nor browsing is sent back to the choice screen.
      if (!isAuthenticated && !isGuest) {
        router.replace('/(auth)/login');
        return;
      }
      racesApi.getRaces(2026).then(setRaces).catch((err) => {
        console.error(err);
        if (err.response?.status === 401) {
          useAuthStore.getState().logout();
          router.replace('/(auth)/login');
        }
      }).finally(() => setLoading(false));
    }, [isAuthenticated, isGuest])
  );

  const weekendOver = (r: Race) => isWeekendOver(r.race_time);

  const roundById = useMemo(() => {
    const map: Record<string, number> = {};
    [...races]
      .sort((a, b) => new Date(a.race_time).getTime() - new Date(b.race_time).getTime())
      .forEach((r, i) => { map[r.id] = i + 1; });
    return map;
  }, [races]);

  const activeRace = races.find(r => !weekendOver(r));
  const upcomingRaces = races.filter(r => !weekendOver(r) && r.id !== activeRace?.id);
  const completedRaces = races.filter(r => weekendOver(r));

  // The most recently finished round, so the dashboard can offer a one-tap jump
  // straight to how that weekend scored.
  const previousRace = [...completedRaces]
    .sort((a, b) => new Date(b.race_time).getTime() - new Date(a.race_time).getTime())[0];

  useFocusEffect(
    useCallback(() => {
      // A guest has no prediction to fetch, and asking would be a guaranteed 401
      // on every focus.
      if (!activeRace || !isAuthenticated) { setPrediction(null); return; }
      predictionsApi.getPrediction(activeRace.id).then(setPrediction).catch(() => setPrediction(null));
    }, [activeRace?.id, isAuthenticated])
  );

  const fp1 = activeRace ? new Date(activeRace.fp1_time).getTime() : 0;
  const isOpen = !!activeRace && now < fp1;

  useEffect(() => {
    if (!isOpen) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isOpen]);

  const ms = Math.max(0, fp1 - now);
  const cd = {
    d: pad(ms / 86400000),
    h: pad((ms / 3600000) % 24),
    m: pad((ms / 60000) % 60),
    s: pad((ms / 1000) % 60),
  };

  const pickCount = prediction
    ? (['pole_driver_id', 'p1_driver_id', 'p2_driver_id', 'p3_driver_id'] as const)
        .filter(k => prediction[k]).length
    : 0;
  const heroCta = isGuest
    ? (isOpen ? 'Try the prediction sheet' : 'View the race')
    : !isOpen
    ? 'View your picks'
    : pickCount === 4 ? 'Review your picks' : pickCount > 0 ? 'Finish your picks' : 'Make your picks';

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  // Predictions close (lock) when Practice 1 starts, so an upcoming race shows
  // "Closes" against its FP1 date rather than its race day.
  const statusFor = (r: Race): { label: string; color: string; date: string } => {
    if (weekendOver(r)) return { label: 'Finished', color: colors.textSecondary, date: r.race_time };
    if (Date.now() < new Date(r.fp1_time).getTime()) return { label: 'Closes', color: colors.accentGreen, date: r.fp1_time };
    return { label: 'Locked', color: colors.redText, date: r.race_time };
  };

  const openRace = (r: Race) => {
    if (weekendOver(r)) router.push(`/race/${r.id}/results`);
    else router.push(`/race/${r.id}`);
  };

  const renderRaceRow = ({ item, index }: { item: Race; index: number }) => {
    const st = statusFor(item);
    return (
      <FadeInView delay={staggerDelay(index)} offsetY={8}>
        <PressableScale style={styles.calRow} scaleTo={0.985} onPress={() => openRace(item)}>
          <View style={styles.roundPlate}>
            <Text style={styles.roundPlateText}>{pad(roundById[item.id] ?? index + 1)}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.calName} numberOfLines={1}>{item.grand_prix}</Text>
            <Text style={styles.calSub} numberOfLines={1}>{item.circuit_name}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.calStatus, { color: st.color }]}>{st.label}</Text>
            <Text style={styles.calDate}>{fmtDate(st.date)}</Text>
          </View>
        </PressableScale>
      </FadeInView>
    );
  };

  const raceList = (data: Race[], emptyText: string) => (
    <FlatList
      data={data}
      renderItem={renderRaceRow}
      keyExtractor={item => item.id}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24 }}
      ListEmptyComponent={<Text style={styles.emptyText}>{emptyText}</Text>}
    />
  );

  const showSkeleton = loading && races.length === 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow} numberOfLines={1}>
            Season 2026 · {isGuest ? 'Guest' : user?.display_name || 'Driver'}
          </Text>
          <Text style={styles.greeting}>{radioLine}</Text>
        </View>
      </View>

      {showSkeleton ? (
        <View style={{ paddingHorizontal: 18 }}>
          <Skeleton width={'100%'} height={230} radius={14} style={{ marginBottom: 24 }} />
          <Skeleton width={'40%'} height={12} style={{ marginBottom: 16 }} />
          {[0, 1, 2, 3].map(i => (
            <View key={i} style={styles.calRow}>
              <Skeleton width={34} height={34} radius={17} />
              <View style={{ flex: 1 }}>
                <Skeleton width={'60%'} height={14} />
                <Skeleton width={'40%'} height={11} style={{ marginTop: 6 }} />
              </View>
              <Skeleton width={40} height={12} />
            </View>
          ))}
        </View>
      ) : (
        <>
          {/* Shortcut to the last finished round's scores, sitting above the hero */}
          {previousRace && (
            <FadeInView style={{ paddingHorizontal: 18 }}>
              <PressableScale
                style={styles.prevBtn}
                scaleTo={0.99}
                onPress={() => router.push(`/race/${previousRace.id}/results`)}
                accessibilityRole="button"
                accessibilityLabel={`Check the previous race score for the ${previousRace.grand_prix}`}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.prevEyebrow}>Check previous race score</Text>
                  <Text style={styles.prevName} numberOfLines={1}>{previousRace.grand_prix}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </PressableScale>
            </FadeInView>
          )}

          {/* Hero: active Grand Prix (pinned above the swipeable calendar) */}
          {activeRace && (
            <FadeInView style={{ paddingHorizontal: 18 }}>
              <PressableScale style={styles.hero} scaleTo={0.99} onPress={() => openRace(activeRace)}>
                <CheckerStripe colorA={colors.brass} colorB={colors.brassDim} />
                <View style={styles.heroBody}>
                  <View style={styles.heroHead}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.heroEyebrow}>Round {pad(roundById[activeRace.id] ?? 0)} · Next up</Text>
                      <Text style={styles.heroTitle}>{activeRace.grand_prix}</Text>
                      <Text style={styles.heroSub}>
                        {activeRace.circuit_name}{activeRace.country ? ` · ${activeRace.country}` : ''}
                      </Text>
                    </View>
                    <Text style={[styles.badge, isOpen ? styles.badgeOpen : styles.badgeLocked]}>
                      {isOpen ? 'Open' : 'Locked'}
                    </Text>
                  </View>

                  {isOpen ? (
                    <>
                      <View style={styles.countdown}>
                        {[
                          { v: cd.d, l: 'days' },
                          { v: cd.h, l: 'hrs' },
                          { v: cd.m, l: 'min' },
                          { v: cd.s, l: 'sec', accent: true },
                        ].map((seg, i) => (
                          <React.Fragment key={seg.l}>
                            {i > 0 && <View style={styles.cdDivider} />}
                            <View style={styles.cdCell}>
                              <Text style={[styles.cdValue, seg.accent && { color: colors.brass }]}>{seg.v}</Text>
                              <Text style={styles.cdLabel}>{seg.l}</Text>
                            </View>
                          </React.Fragment>
                        ))}
                      </View>
                      <Text style={styles.lockNote}>
                        Picks lock when Practice 1 starts · {new Date(activeRace.fp1_time).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                      </Text>
                      {isGuest ? (
                        <Text style={styles.guestPrompt}>
                          Sign in to enter this round and score points.
                        </Text>
                      ) : (
                        <View style={styles.progressRow}>
                          <View style={styles.progressTrack}>
                            <View style={[styles.progressFill, { width: `${(pickCount / 4) * 100}%` }]} />
                          </View>
                          <Text style={styles.progressLabel}>{pickCount}/4 picked</Text>
                        </View>
                      )}
                    </>
                  ) : (
                    <Text style={[styles.lockNote, { marginTop: 12 }]}>
                      Predictions are locked — the weekend is under way.
                    </Text>
                  )}

                  <View style={styles.heroCta}>
                    <Text style={styles.heroCtaText}>{heroCta}</Text>
                  </View>
                </View>
              </PressableScale>
            </FadeInView>
          )}

          {/* Calendar header + swipeable Upcoming / Done lists */}
          <Text style={styles.calSectionLabel}>Calendar</Text>
          <View style={{ paddingHorizontal: 18 }}>
            <SegmentedTabs<'upcoming' | 'completed'>
              value={tab}
              onChange={setTab}
              progress={progress}
              options={[
                { value: 'upcoming', label: `Upcoming ${upcomingRaces.length}` },
                { value: 'completed', label: `Done ${completedRaces.length}` },
              ]}
            />
          </View>

          <SwipeViews
            index={tab === 'upcoming' ? 0 : 1}
            onIndexChange={(i) => setTab(i === 0 ? 'upcoming' : 'completed')}
            progress={progress}
          >
            {raceList(upcomingRaces, 'No upcoming races.')}
            {raceList(completedRaces, 'No completed races yet.')}
          </SwipeViews>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  guestPrompt: {
    fontFamily: 'Karla-Regular',
    fontSize: 12,
    color: colors.brass,
    marginTop: 14,
  },
  container: {
    flex: 1,
    paddingTop: 54,
    backgroundColor: colors.bgCarbon,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 18,
  },
  eyebrow: {
    fontFamily: 'Jost-SemiBold',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  greeting: {
    fontFamily: 'Jost-Bold',
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.3,
    color: colors.textPrimary,
    marginTop: 3,
    paddingRight: 8,
  },

  prevBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 10,
    backgroundColor: colors.bgCard,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  prevEyebrow: {
    fontFamily: 'Jost-SemiBold',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.brass,
  },
  prevName: { fontFamily: 'Jost-SemiBold', fontSize: 14, color: colors.textPrimary, marginTop: 3 },

  hero: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.heroTop,
    marginBottom: 22,
  },
  heroBody: { padding: 16 },
  heroHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  heroEyebrow: {
    fontFamily: 'Jost-SemiBold',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.brass,
  },
  heroTitle: { fontFamily: 'Jost-Bold', fontSize: 22, color: colors.textPrimary, marginTop: 4 },
  heroSub: { fontFamily: 'Karla-Regular', fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  countdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.borderColor,
  },
  cdCell: { flex: 1, alignItems: 'center' },
  cdDivider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.borderColor },
  cdValue: { fontFamily: 'Jost-Bold', fontSize: 22, color: colors.textPrimary, fontVariant: ['tabular-nums'] },
  cdLabel: {
    fontFamily: 'Karla-Regular',
    fontSize: 9,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    marginTop: 2,
  },
  lockNote: { fontFamily: 'Karla-Regular', fontSize: 11, color: colors.textSecondary, marginTop: 10, textAlign: 'center' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.brass, borderRadius: 3 },
  progressLabel: { fontFamily: 'Jost-SemiBold', fontSize: 11, fontWeight: '600', letterSpacing: 1, color: colors.textSecondary },
  heroCta: { marginTop: 14, backgroundColor: colors.oxblood, borderRadius: 8, paddingVertical: 13, alignItems: 'center' },
  heroCtaText: {
    fontFamily: 'Jost-SemiBold',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.oxbloodFg,
  },

  badge: {
    fontFamily: 'Jost-SemiBold',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 4,
    overflow: 'hidden',
  },
  badgeOpen: { backgroundColor: 'rgba(47,107,79,0.18)', color: colors.accentGreen, borderWidth: 1, borderColor: 'rgba(47,107,79,0.5)' },
  badgeLocked: { backgroundColor: 'rgba(168,41,28,0.15)', color: colors.redText, borderWidth: 1, borderColor: 'rgba(168,41,28,0.5)' },

  calSectionLabel: {
    fontFamily: 'Jost-SemiBold',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    paddingHorizontal: 18,
    marginBottom: 8,
  },
  calHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8, paddingHorizontal: 18 },
  calHeadLabel: {
    fontFamily: 'Jost-SemiBold',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  calRule: { flex: 1, height: 1, backgroundColor: colors.borderColor },
  pillRow: { flexDirection: 'row', gap: 4 },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: 'transparent' },
  pillActive: { backgroundColor: colors.surfaceAlt, borderColor: colors.borderStrong },
  pillText: {
    fontFamily: 'Jost-SemiBold',
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  pillTextActive: { color: colors.textPrimary },
  calRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderFaint,
  },
  roundPlate: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundPlateText: { fontFamily: 'Jost-Bold', fontSize: 12, color: colors.brass },
  calName: { fontFamily: 'Jost-SemiBold', fontSize: 15, color: colors.textPrimary },
  calSub: { fontFamily: 'Karla-Regular', fontSize: 11.5, color: colors.textSecondary, marginTop: 1 },
  calStatus: { fontFamily: 'Jost-SemiBold', fontSize: 12, fontWeight: '600' },
  calDate: { fontFamily: 'Karla-Regular', fontSize: 11, color: colors.textMuted, marginTop: 2 },
  emptyText: {
    fontFamily: 'Karla-Regular',
    color: colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 24,
  },
});
