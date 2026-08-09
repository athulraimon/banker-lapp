import React, { useEffect, useRef } from 'react';
import { Animated, DimensionValue, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { useNativeDriver } from '../theme/motion';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

// A single placeholder block that breathes between two opacities. Used to build
// screen-shaped skeletons so a loading screen reads as "this content is coming"
// rather than an empty void or a bare spinner.
export function Skeleton({ width = '100%', height = 14, radius = 6, style }: SkeletonProps) {
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver }),
        Animated.timing(pulse, { toValue: 0.5, duration: 750, useNativeDriver }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: colors.bgCardHeader, opacity: pulse },
        style,
      ]}
    />
  );
}

// Placeholder shaped like a race card on the dashboard.
export function RaceCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Skeleton width={30} height={30} radius={6} />
        <View style={styles.headerText}>
          <Skeleton width={'62%'} height={15} />
          <Skeleton width={'42%'} height={11} style={{ marginTop: 7 }} />
        </View>
        <Skeleton width={74} height={20} radius={5} />
      </View>
    </View>
  );
}

// Placeholder shaped like a leaderboard row on the standings screen.
export function LeaderboardRowSkeleton() {
  return (
    <View style={styles.row}>
      <Skeleton width={22} height={16} radius={4} />
      <View style={styles.rowText}>
        <Skeleton width={'55%'} height={13} />
        <Skeleton width={'38%'} height={10} style={{ marginTop: 6 }} />
      </View>
      <Skeleton width={40} height={24} radius={6} />
    </View>
  );
}

const styles = StyleSheet.create({
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderColor,
  },
  rowText: {
    flex: 1,
  },
});
