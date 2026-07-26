import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { colors } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';
import { standingsApi, Standing } from '../../src/api/standings';
import { useAuthStore } from '../../src/store/useAuthStore';

export default function StandingsScreen() {
  const [standings, setStandings] = useState<Standing[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuthStore();

  const load = useCallback(() => {
    setRefreshing(true);
    standingsApi
      .getGlobalStandings()
      .then(setStandings)
      .catch(console.error)
      .finally(() => setRefreshing(false));
  }, []);

  // Refetch every time the Championship tab gains focus, so scores updated by
  // an admin rescore show up without restarting the app.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const userStanding = standings.find(s => s.user_id === user?.id);

  const renderLeaderboardRow = ({ item, index }: { item: Standing, index: number }) => {
    const isCurrentUser = item.user_id === user?.id;
    const rankColor = index === 0 ? colors.accentGold : index === 1 ? '#e2e8f0' : index === 2 ? '#cd7f32' : colors.textSecondary;

    return (
      <View style={[styles.leaderboardRow, isCurrentUser && styles.currentUserRow]}>
        <Text style={[styles.rank, { color: rankColor }]}>
          {item.rank.toString().padStart(2, '0')}
        </Text>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.user_name} {isCurrentUser ? '(You)' : ''}</Text>
          <Text style={styles.userStats}>
            🏆 {item.correct_winners} Winners · 🎯 {item.pole_count} Poles
          </Text>
        </View>
        <View style={[styles.pointsBadge, index === 0 && styles.firstPlaceBadge]}>
          <Text style={[styles.pointsText, isCurrentUser && { color: colors.f1Red }]}>
            {item.total_points}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={typography.h2}>Championship</Text>
      <Text style={styles.seasonText}>2026 Season</Text>

      {userStanding && (
        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryLabel}>Your Standing</Text>
            <Text style={styles.summaryRank}>Rank #{userStanding.rank}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.summaryLabel}>Total Score</Text>
            <Text style={styles.summaryScore}>{userStanding.total_points} PTS</Text>
          </View>
        </View>
      )}

      <Text style={typography.sectionHeaderCompact}>Global Driver Leaderboard</Text>
      
      <View style={styles.leaderboardContainer}>
        <FlatList
          data={standings}
          renderItem={renderLeaderboardRow}
          keyExtractor={item => item.user_id}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.f1Red} />}
        />
      </View>
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
  seasonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 24,
  },
  summaryCard: {
    backgroundColor: colors.bgCardHeader,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.borderColor,
  },
  summaryLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  summaryRank: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 18,
    color: colors.textPrimary,
  },
  summaryScore: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 18,
    color: colors.f1Red,
  },
  leaderboardContainer: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderColor,
    overflow: 'hidden',
    flex: 1,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderColor,
  },
  currentUserRow: {
    backgroundColor: 'rgba(225, 6, 0, 0.05)',
    borderLeftWidth: 3,
    borderLeftColor: colors.f1Red,
    paddingLeft: 9,
  },
  rank: {
    width: 32,
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    ...typography.body,
    fontSize: 14,
  },
  userStats: {
    ...typography.caption,
    fontSize: 11,
    marginTop: 2,
  },
  pointsBadge: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  firstPlaceBadge: {
    borderColor: 'rgba(255, 183, 3, 0.3)',
    backgroundColor: 'rgba(255, 183, 3, 0.05)',
  },
  pointsText: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 16,
    color: colors.textPrimary,
  }
});
