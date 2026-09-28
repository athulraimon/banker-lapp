import React, { useCallback, useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, RefreshControl } from 'react-native';
import { showAlert } from '../../src/components/AppDialog';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme/colors';
import { racesApi, Race } from '../../src/api/races';
import { predictionsApi, Prediction } from '../../src/api/predictions';
import DriverSearchSheet, { DriverSearchSheetRef } from '../../src/components/DriverSearchSheet';
import LoadingScreen from '../../src/components/LoadingScreen';
import SegmentedTabs from '../../src/components/SegmentedTabs';
import SwipeViews from '../../src/components/SwipeViews';
import RaceInfoPanel from '../../src/components/RaceInfoPanel';
import FadeInView from '../../src/components/anim/FadeInView';
import { useDrivers } from '../../src/hooks/useDrivers';
import { useAuthStore } from '../../src/store/useAuthStore';
import { usePendingPredictionStore } from '../../src/store/usePendingPredictionStore';

type RaceTab = 'predictions' | 'info';
type Slot = 'pole' | 'p1' | 'p2' | 'p3';

export default function PredictionEditorScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { byId: driversById } = useDrivers();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { pending, setPending, clearPending } = usePendingPredictionStore();
  const [race, setRace] = useState<Race | null>(null);
  const [prediction, setPrediction] = useState<Prediction>({
    race_id: id as string,
    pole_driver_id: '',
    p1_driver_id: '',
    p2_driver_id: '',
    p3_driver_id: '',
  });
  const [tab, setTab] = useState<RaceTab>('predictions');
  const [activeSlot, setActiveSlot] = useState<Slot | null>(null);
  const [saved, setSaved] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;

  const bottomSheetRef = useRef<DriverSearchSheetRef>(null);

  const load = useCallback((opts?: { silent?: boolean }) => {
    if (!id) return;
    if (!opts?.silent) setRefreshing(true);
    racesApi.getRace(id as string).then(race => {
      setRace(race);
      if (race.status === 'completed') {
        router.replace(`/race/${id}/results`);
      }
    }).catch(console.error).finally(() => setRefreshing(false));
    if (isAuthenticated) {
      predictionsApi.getPrediction(id as string).then(pred => {
        if (pred) setPrediction(pred);
      }).catch(console.error);
    } else if (pending && pending.race_id === id) {
      // A guest who started picking, was asked to sign in and came back
      // without doing so still has their slate.
      setPrediction(pending);
    }
  }, [id, isAuthenticated]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Once FP1 has passed, pole and the full result can land at any moment —
  // poll quietly so they show up without the player having to reopen the
  // screen. Stops the instant the race is marked completed (the load() above
  // then redirects to the results screen) or the weekend is fully over.
  useEffect(() => {
    if (race?.status !== 'locked') return;
    const t = setInterval(() => load({ silent: true }), 20000);
    return () => clearInterval(t);
  }, [race?.status, load]);

  const locked = race?.status === 'locked' || race?.status === 'completed';

  const podiumCodes = [prediction.p1_driver_id, prediction.p2_driver_id, prediction.p3_driver_id].filter(Boolean);
  const dupe = new Set(podiumCodes).size !== podiumCodes.length;
  const filledCount = ([prediction.pole_driver_id, prediction.p1_driver_id, prediction.p2_driver_id, prediction.p3_driver_id]).filter(Boolean).length;
  // Partial picks are allowed — the backend accepts any subset as long as the
  // podium has no duplicates. Only block on a duplicate or an empty slate.
  const canSave = filledCount >= 1 && !dupe;

  const handleSave = async () => {
    if (!canSave) return;

    // Guests may fill the sheet in — picking is the part worth trying before you
    // commit to an account. Only the save needs an identity to attach to, so the
    // picks are stashed and submitted for them the moment they sign in.
    if (!isAuthenticated) {
      setPending(prediction);
      router.push('/(auth)/login');
      return;
    }

    try {
      await predictionsApi.submitPrediction(prediction);
      clearPending();
      setSaved(true);
    } catch (e: any) {
      showAlert('Error', e.response?.data?.error || 'Failed to save predictions');
    }
  };

  const openDriverSearch = (slot: Slot) => {
    setActiveSlot(slot);
    bottomSheetRef.current?.expand();
  };

  const onSelectDriver = (driverId: string) => {
    if (activeSlot) {
      setPrediction(prev => ({ ...prev, [`${activeSlot}_driver_id`]: driverId }));
      setSaved(false);
    }
    bottomSheetRef.current?.close();
  };

  const renderSlot = (slot: Slot, tag: string, pole?: boolean) => {
    const driverId = prediction[`${slot}_driver_id` as keyof Prediction] as string;
    const driver = driverId ? driversById[driverId] : undefined;
    const stripe = driver?.team_color ? `#${driver.team_color}` : colors.borderColor;
    return (
      <TouchableOpacity
        style={[styles.slot, pole && styles.slotPole]}
        onPress={() => openDriverSearch(slot)}
        disabled={locked}
        activeOpacity={0.8}
      >
        <View style={[styles.slotTag, pole ? styles.slotTagPole : styles.slotTagPodium]}>
          <Text style={[styles.slotTagText, pole && { color: colors.heroBottom }]}>{tag}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.slotLabel, { color: driverId ? colors.textPrimary : colors.textMuted }]} numberOfLines={1}>
            {driverId ? (driver ? `${driverId} · ${driver.broadcast_name}` : driverId) : 'Tap to choose'}
          </Text>
          <Text style={styles.slotTeam} numberOfLines={1}>{driver?.team_name ?? 'Empty slot'}</Text>
        </View>
        <View style={[styles.slotStripe, { backgroundColor: stripe }]} />
      </TouchableOpacity>
    );
  };

  if (!race) return <LoadingScreen label="Loading race…" />;

  const fp1 = new Date(race.fp1_time).getTime();
  const ms = Math.max(0, fp1 - Date.now());
  const closesIn = `${Math.floor(ms / 86400000)}d ${Math.floor((ms / 3600000) % 24)}h`;

  const saveLabel = saved
    ? 'Picks saved ✓'
    : dupe ? 'Fix duplicate picks'
    : filledCount === 0 ? 'Pick at least one driver'
    : isAuthenticated ? 'Save picks'
    : 'Sign in to save picks';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        {/* Sticky header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>{race.grand_prix}</Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {locked ? 'Predictions locked' : `Closes in ${closesIn}`}
            </Text>
          </View>
          <Text style={[styles.badge, locked ? styles.badgeLocked : styles.badgeOpen]}>
            {locked ? 'Locked' : 'Open'}
          </Text>
        </View>

        <View style={styles.tabsWrap}>
          <SegmentedTabs<RaceTab>
            value={tab}
            onChange={setTab}
            progress={progress}
            options={[
              { value: 'predictions', label: 'Predictions' },
              { value: 'info', label: 'Circuit & sessions' },
            ]}
          />
        </View>

        <SwipeViews
          index={tab === 'predictions' ? 0 : 1}
          onIndexChange={(i) => setTab(i === 0 ? 'predictions' : 'info')}
          progress={progress}
        >
          <ScrollView
            contentContainerStyle={styles.pageInner}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load()} tintColor={colors.brass} />}
          >
            <FadeInView>
              <Text style={styles.eyebrow}>Qualifying · 5 pts</Text>
              {race.pole_driver_id && (
                <Text style={styles.poleConfirmed}>
                  Confirmed pole: {race.pole_driver_id}
                  {driversById[race.pole_driver_id] ? ` · ${driversById[race.pole_driver_id].broadcast_name}` : ''}
                </Text>
              )}
              {renderSlot('pole', 'POLE', true)}

              <Text style={[styles.eyebrow, { marginTop: 22 }]}>Podium · 15 / 10 / 8 pts</Text>
              {renderSlot('p1', 'P1')}
              {renderSlot('p2', 'P2')}
              {renderSlot('p3', 'P3')}

              {dupe && (
                <View style={styles.warn}>
                  <Text style={styles.warnText}>P1, P2 and P3 must be three different drivers.</Text>
                </View>
              )}

              <Text style={styles.note}>
                {isAuthenticated
                  ? "Save any time — you don't need all four. Your pole pick can also be your P1. Edit as often as you like until Practice 1."
                  : 'Pick freely as a guest. Signing in keeps this slate and enters it for the round — nothing is lost.'}
              </Text>
            </FadeInView>
          </ScrollView>

          <ScrollView contentContainerStyle={styles.pageInner} showsVerticalScrollIndicator={false}>
            <RaceInfoPanel race={race} />
          </ScrollView>
        </SwipeViews>

        {/* Pinned save bar (predictions tab, editable races only) */}
        {tab === 'predictions' && !locked && (
          <View style={styles.saveBarWrap}>
            <TouchableOpacity
              style={[
                styles.saveBar,
                { backgroundColor: saved ? colors.racingGreen : canSave ? colors.oxblood : colors.heroTop },
              ]}
              onPress={handleSave}
              disabled={!canSave}
              activeOpacity={0.85}
            >
              <Text style={[styles.saveBarText, { color: saved || canSave ? colors.oxbloodFg : colors.textMuted }]}>
                {saveLabel}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <DriverSearchSheet
          ref={bottomSheetRef}
          onSelectDriver={onSelectDriver}
          selectedDrivers={[prediction.pole_driver_id, prediction.p1_driver_id, prediction.p2_driver_id, prediction.p3_driver_id]}
        />
      </View>
    </GestureHandlerRootView>
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
    backgroundColor: colors.bgPhone,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderFaint,
  },
  backBtn: {
    width: 30, height: 30, borderRadius: 8,
    borderWidth: 1, borderColor: colors.borderColor,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'Jost-Bold',
    fontSize: 15,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: colors.textPrimary,
  },
  headerSub: { fontFamily: 'Karla-Regular', fontSize: 11, color: colors.textSecondary, marginTop: 1 },

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
  },
  badgeOpen: { backgroundColor: 'rgba(47,107,79,0.18)', color: colors.accentGreen, borderWidth: 1, borderColor: 'rgba(47,107,79,0.5)' },
  badgeLocked: { backgroundColor: 'rgba(168,41,28,0.15)', color: colors.redText, borderWidth: 1, borderColor: 'rgba(168,41,28,0.5)' },

  tabsWrap: { paddingHorizontal: 16, paddingTop: 14 },
  pageInner: { paddingHorizontal: 16, paddingBottom: 120 },
  eyebrow: {
    fontFamily: 'Jost-SemiBold',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    marginBottom: 10,
  },

  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.borderColor,
    backgroundColor: colors.bgCard,
    borderRadius: 10,
    marginBottom: 10,
  },
  slotPole: { borderColor: colors.borderStrong, marginBottom: 0 },
  slotTag: {
    width: 44, height: 32, borderRadius: 5,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  slotTagPole: { backgroundColor: colors.brass },
  slotTagPodium: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.borderStrong },
  slotTagText: { fontFamily: 'Jost-Bold', fontSize: 12, letterSpacing: 0.5, color: colors.textPrimary },
  slotLabel: { fontFamily: 'Jost-SemiBold', fontSize: 14.5 },
  slotTeam: { fontFamily: 'Karla-Regular', fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  slotStripe: { width: 4, height: 26, borderRadius: 2 },

  warn: {
    marginTop: 10,
    padding: 11,
    borderWidth: 1,
    borderColor: 'rgba(168,41,28,0.55)',
    backgroundColor: 'rgba(168,41,28,0.12)',
    borderRadius: 8,
  },
  warnText: { fontFamily: 'Karla-Regular', fontSize: 12.5, color: colors.redText },
  note: { fontFamily: 'Karla-Regular', fontSize: 11.5, color: colors.textMuted, marginTop: 14, lineHeight: 18 },
  poleConfirmed: { fontFamily: 'Karla-Regular', fontSize: 11.5, color: colors.brass, marginBottom: 8 },

  saveBarWrap: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 22,
    backgroundColor: colors.bgPhone,
    borderTopWidth: 1,
    borderTopColor: colors.borderFaint,
  },
  saveBar: { borderRadius: 9, paddingVertical: 15, alignItems: 'center' },
  saveBarText: {
    fontFamily: 'Jost-SemiBold',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
});
