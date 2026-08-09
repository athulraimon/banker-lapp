import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { useNativeDriver } from '../theme/motion';

// Full-screen themed loading state used while a screen fetches its data.
// A branded, animated mark (breathing monogram inside a spinning accent ring)
// reads as a deliberate transition rather than a bare system spinner.
export default function LoadingScreen({ label = 'Loading…' }: { label?: string }) {
  const spin = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const spinLoop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1100,
        easing: Easing.linear,
        useNativeDriver,
      })
    );
    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver }),
        Animated.timing(breathe, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver }),
      ])
    );
    spinLoop.start();
    breatheLoop.start();
    return () => {
      spinLoop.stop();
      breatheLoop.stop();
    };
  }, [spin, breathe]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.06] });
  const labelOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });

  return (
    <View style={styles.container}>
      <View style={styles.markWrap}>
        <Animated.View style={[styles.ring, { transform: [{ rotate }] }]} />
        <Animated.View style={[styles.monogram, { transform: [{ scale }] }]}>
          <Text style={styles.monogramText}>BL</Text>
        </Animated.View>
      </View>
      <Animated.Text style={[styles.label, { opacity: labelOpacity }]}>{label}</Animated.Text>
    </View>
  );
}

const RING = 72;
const MARK = 52;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgCarbon,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
  },
  markWrap: {
    width: RING,
    height: RING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 3,
    borderColor: 'rgba(201, 162, 39, 0.15)',
    // Only the top edge carries the accent, so rotation reads as a moving arc.
    borderTopColor: colors.brass,
  },
  monogram: {
    width: MARK,
    height: MARK,
    borderRadius: 14,
    backgroundColor: colors.oxblood,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: {
    fontFamily: 'Jost-Bold',
    fontSize: 20,
    letterSpacing: 1,
    color: colors.oxbloodFg,
  },
  label: {
    ...typography.body,
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
});
