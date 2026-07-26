import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';
import { useAuthStore } from '../../src/store/useAuthStore';
import { racesApi, Race } from '../../src/api/races';
import { countryFlag, usesTextFallback } from '../../src/utils/flags';

export default function DashboardScreen() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const router = useRouter();
  const [races, setRaces] = useState<Race[]>([]);
  const [tab, setTab] = useState<'upcoming' | 'completed'>('upcoming');

  // Refetch races whenever the tab gains focus so status changes (e.g. an admin
  // setting results) show up without restarting the app.
  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) {
        router.replace('/(auth)/login');
        return;
      }
      racesApi.getRaces(2026).then(setRaces).catch((err) => {
        console.error(err);
        if (err.response?.status === 401) {
          useAuthStore.getState().logout();
          router.replace('/(auth)/login');
        }
      });
    }, [isAuthenticated])
  );

  // A race weekend counts as over ~4h after the race start.
  const RACE_OVER_BUFFER_MS = 4 * 60 * 60 * 1000;
  const isWeekendOver = (r: Race) => Date.now() > new Date(r.race_time).getTime() + RACE_OVER_BUFFER_MS;
  // Active GP = the race whose weekend is happening now; once it's over this
  // rolls over to the next upcoming race (races are already ordered by time).
  const upcomingRace = races.find(r => !isWeekendOver(r));
  const upcomingRaces = races.filter(r => !isWeekendOver(r) && r.id !== upcomingRace?.id);
  const completedRaces = races.filter(r => isWeekendOver(r));
  const listData = tab === 'upcoming' ? upcomingRaces : completedRaces;

  const renderRaceCard = ({ item }: { item: Race }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => {
        if (isWeekendOver(item)) {
          router.push(`/race/${item.id}/results`);
        } else {
          router.push(`/race/${item.id}`);
        }
      }}
    >
      <View style={styles.cardHeader}>
        <View style={styles.titleRow}>
          <Text style={[styles.flag, usesTextFallback() && styles.flagCode]}>
            {countryFlag(item.country)}
          </Text>
          <View style={styles.titleText}>
            <Text style={styles.gpName}>{item.grand_prix}</Text>
            <Text style={styles.circuitName}>{item.circuit_name}{item.country ? ` · ${item.country}` : ''}</Text>
          </View>
        </View>
        {item.status === 'open' && <Text style={[styles.badge, styles.badgeOpen]}>Predictions Open</Text>}
        {item.status === 'locked' && <Text style={[styles.badge, styles.badgeLocked]}>Locked</Text>}
        {item.status === 'completed' && <Text style={[styles.badge, styles.badgeCompleted]}>Finished</Text>}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={typography.h2}>Dashboard</Text>
          <Text style={styles.greeting}>Welcome back, {user?.display_name || 'Driver'}!</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout} hitSlop={8}>
          <Ionicons name="log-out-outline" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {upcomingRace && (
        <>
          <Text style={typography.sectionHeaderCompact}>Active Grand Prix</Text>
          <TouchableOpacity 
            style={[styles.card, { borderColor: colors.f1Red }]}
            onPress={() => {
              if (isWeekendOver(upcomingRace)) {
                router.push(`/race/${upcomingRace.id}/results`);
              } else {
                router.push(`/race/${upcomingRace.id}`);
              }
            }}
          >
            <View style={styles.cardHeader}>
              <View style={styles.titleRow}>
                <Text style={[styles.flag, usesTextFallback() && styles.flagCode]}>
                  {countryFlag(upcomingRace.country)}
                </Text>
                <View style={styles.titleText}>
                  <Text style={styles.gpName}>{upcomingRace.grand_prix}</Text>
                  <Text style={styles.circuitName}>{upcomingRace.circuit_name}{upcomingRace.country ? ` · ${upcomingRace.country}` : ''}</Text>
                </View>
              </View>
              {Date.now() < new Date(upcomingRace.fp1_time).getTime() ? (
                <Text style={[styles.badge, styles.badgeOpen]}>Predictions Open</Text>
              ) : (
                <Text style={[styles.badge, styles.badgeLocked]}>Locked</Text>
              )}
            </View>
            <View style={styles.cardBody}>
              <View style={styles.countdownStrip}>
                {Date.now() < new Date(upcomingRace.fp1_time).getTime() ? (
                  <>
                    <Text style={styles.countdownLabel}>Closes at FP1:</Text>
                    <Text style={styles.countdownTime}>{new Date(upcomingRace.fp1_time).toLocaleDateString()}</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.countdownLabel}>Race day:</Text>
                    <Text style={styles.countdownTime}>{new Date(upcomingRace.race_time).toLocaleDateString()}</Text>
                  </>
                )}
              </View>
            </View>
          </TouchableOpacity>
        </>
      )}

      <Text style={typography.sectionHeaderCompact}>Calendar</Text>
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, tab === 'upcoming' && styles.tabItemActive]}
          onPress={() => setTab('upcoming')}
        >
          <Text style={[styles.tabText, tab === 'upcoming' && styles.tabTextActive]}>
            Upcoming ({upcomingRaces.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, tab === 'completed' && styles.tabItemActive]}
          onPress={() => setTab('completed')}
        >
          <Text style={[styles.tabText, tab === 'completed' && styles.tabTextActive]}>
            Completed ({completedRaces.length})
          </Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={listData}
        renderItem={renderRaceCard}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {tab === 'upcoming' ? 'No upcoming races.' : 'No completed races yet.'}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    paddingTop: 48,
    backgroundColor: colors.bgCarbon,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  greeting: {
    ...typography.body,
    marginTop: 2,
  },
  logoutBtn: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderColor,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    padding: 4,
    marginTop: 8,
    marginBottom: 16,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabItemActive: {
    backgroundColor: colors.f1Red,
  },
  tabText: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 13,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: '#fff',
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 24,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderColor,
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardHeader: {
    backgroundColor: colors.bgCardHeader,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderColor,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardBody: {
    padding: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  titleText: {
    flexShrink: 1,
  },
  flag: {
    fontSize: 28,
  },
  // Applied only where the platform has no flag glyphs and countryFlag()
  // returns an ISO code. A 28px "AU" would tower over the GP name, so it is
  // rendered as a small badge occupying roughly the same box as the emoji.
  flagCode: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 13,
    color: colors.textSecondary,
    backgroundColor: colors.bgCardHeader,
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  gpName: {
    ...typography.h3,
    fontSize: 16,
  },
  circuitName: {
    ...typography.caption,
  },
  countdownStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.f1Red,
    padding: 12,
    borderRadius: 8,
  },
  countdownLabel: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  countdownTime: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 16,
    color: colors.textPrimary,
  },
  badge: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 10,
    textTransform: 'uppercase',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeOpen: {
    backgroundColor: 'rgba(0, 245, 212, 0.15)',
    color: colors.accentGreen,
    borderColor: 'rgba(0, 245, 212, 0.3)',
    borderWidth: 1,
  },
  badgeLocked: {
    backgroundColor: 'rgba(255, 51, 51, 0.15)',
    color: colors.statusLocked,
    borderColor: 'rgba(255, 51, 51, 0.3)',
    borderWidth: 1,
  },
  badgeCompleted: {
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    color: colors.textSecondary,
    borderColor: 'rgba(148, 163, 184, 0.3)',
    borderWidth: 1,
  }
});

