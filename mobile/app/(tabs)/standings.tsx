import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { colors } from '../../src/theme/colors';
import { standingsApi, Standing } from '../../src/api/standings';
import { useAuthStore } from '../../src/store/useAuthStore';
import FadeInView from '../../src/components/anim/FadeInView';
import { Skeleton } from '../../src/components/Skeleton';
import { staggerDelay } from '../../src/theme/motion';

const pad = (n: number) => String(n).padStart(2, '0');

export default function StandingsScreen() {
  const [standings, setStandings] = useState<Standing[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const { user } = useAuthStore();

  const load = useCallback(() => {
    setRefreshing(true);
    standingsApi
      .getGlobalStandings()
      .then(setStandings)
      .catch(console.error)
      .finally(() => {
        setRefreshing(false);
        setLoaded(true);
      });
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const userStanding = standings.find(s => s.user_id === user?.id);
  const leaderPoints = standings[0]?.total_points ?? 0;
  const gapToLead = userStanding ? leaderPoints - userStanding.total_points : 0;

  const renderRow = ({ item, index }: { item: Standing; index: number }) => {
    const isYou = item.user_id === user?.id;
    const isLeader = index === 0;
    const gap = leaderPoints - item.total_points;
    return (
      <FadeInView delay={staggerDelay(index)} offsetY={8}>
        <View style={[styles.row, isYou && styles.rowYou]}>
          <View
            style={[
              styles.plate,
              isLeader ? styles.plateLeader : isYou ? styles.plateYou : styles.plateDefault,
            ]}
          >
            <Text style={[styles.plateText, isLeader && { color: colors.heroBottom }]}>{pad(item.rank)}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.name} numberOfLines={1}>{item.user_name}{isYou ? ' (You)' : ''}</Text>
            <Text style={styles.stats}>{item.correct_winners} wins called · {item.pole_count} poles</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.pts, { color: isYou ? colors.brass : colors.textPrimary }]}>{item.total_points}</Text>
            <Text style={styles.gap}>{isLeader ? 'leader' : `−${gap}`}</Text>
          </View>
        </View>
      </FadeInView>
    );
  };

  const showSkeleton = !loaded && standings.length === 0;

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>2026 Season</Text>
      <Text style={styles.title}>Championship</Text>

      {userStanding && (
        <FadeInView>
          <View style={styles.summary}>
            <View style={styles.summaryHalf}>
              <Text style={styles.summaryLabel}>Your position</Text>
              <Text style={styles.summaryValue}>P{userStanding.rank}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={[styles.summaryHalf, { alignItems: 'flex-end' }]}>
              <Text style={styles.summaryLabel}>Points</Text>
              <Text style={[styles.summaryValue, { color: colors.brass }]}>{userStanding.total_points}</Text>
            </View>
          </View>
          {gapToLead > 0 && (
            <Text style={styles.gapNote}>{gapToLead} points off the lead.</Text>
          )}
        </FadeInView>
      )}

      {showSkeleton ? (
        <View style={{ marginTop: 8 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={styles.row}>
              <Skeleton width={30} height={30} radius={15} />
              <View style={{ flex: 1 }}>
                <Skeleton width={'50%'} height={14} />
                <Skeleton width={'36%'} height={11} style={{ marginTop: 6 }} />
              </View>
              <Skeleton width={34} height={18} />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={standings}
          renderItem={renderRow}
          keyExtractor={item => item.user_id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.brass} />}
          ListFooterComponent={
            standings.length ? (
              <Text style={styles.footnote}>Pull to refresh re-scores from the server. Your row stays highlighted wherever you sit.</Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 18, paddingTop: 54, backgroundColor: colors.bgCarbon },
  eyebrow: {
    fontFamily: 'Jost-SemiBold',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  title: { fontFamily: 'Jost-Bold', fontSize: 26, color: colors.textPrimary, marginTop: 2, marginBottom: 18 },

  summary: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.heroTop,
    marginBottom: 8,
  },
  summaryHalf: { flex: 1, padding: 16 },
  summaryDivider: { width: 1, backgroundColor: colors.borderColor },
  summaryLabel: {
    fontFamily: 'Karla-Regular',
    fontSize: 9.5,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  summaryValue: { fontFamily: 'Jost-Bold', fontSize: 24, color: colors.textPrimary, marginTop: 3, fontVariant: ['tabular-nums'] },
  gapNote: { fontFamily: 'Karla-Regular', fontSize: 12, color: colors.textSecondary, marginTop: 10, marginBottom: 8 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderColor,
    backgroundColor: colors.bgCard,
    marginBottom: 8,
  },
  rowYou: { backgroundColor: 'rgba(168,41,28,0.10)', borderColor: 'rgba(168,41,28,0.5)' },
  plate: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  plateDefault: { backgroundColor: colors.surfaceAlt },
  plateLeader: { backgroundColor: colors.brass },
  plateYou: { backgroundColor: colors.oxblood },
  plateText: { fontFamily: 'Jost-Bold', fontSize: 12, color: colors.textPrimary },
  name: { fontFamily: 'Jost-SemiBold', fontSize: 15, color: colors.textPrimary },
  stats: { fontFamily: 'Karla-Regular', fontSize: 11.5, color: colors.textSecondary, marginTop: 2 },
  pts: { fontFamily: 'Jost-Bold', fontSize: 17, fontVariant: ['tabular-nums'] },
  gap: { fontFamily: 'Karla-Regular', fontSize: 10.5, color: colors.textMuted, marginTop: 1 },
  footnote: { fontFamily: 'Karla-Regular', fontSize: 11.5, color: colors.textMuted, marginTop: 12, lineHeight: 17 },
});
