import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors } from '../theme/colors';
import { CircuitLayout } from '../data/circuits';

interface Props {
  circuit: CircuitLayout | null;
  isLoading: boolean;
  unavailable: boolean;
}

/**
 * Draws a circuit from its GPS trace.
 *
 * The path arrives already normalised into a 0..100 box with its aspect ratio
 * preserved, so the viewBox is square and the track sits centred inside it.
 * Two strokes are layered: a wide dark one for the track surface and a thin
 * bright one on top, which reads as a racing line and keeps hairpins legible
 * at phone size.
 */
export default function CircuitMap({ circuit, isLoading, unavailable }: Props) {
  if (isLoading) {
    return (
      <View style={styles.placeholder}>
        <ActivityIndicator color={colors.f1Red} />
      </View>
    );
  }

  if (unavailable || !circuit) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Circuit layout unavailable</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <Svg viewBox="-6 -6 112 112" style={styles.svg}>
        {/* Track surface */}
        <Path
          d={circuit.path}
          stroke={colors.borderColor}
          strokeWidth={7}
          strokeLinejoin="round"
          strokeLinecap="round"
          fill="none"
        />
        {/* Racing line */}
        <Path
          d={circuit.path}
          stroke={colors.f1Red}
          strokeWidth={2.4}
          strokeLinejoin="round"
          strokeLinecap="round"
          fill="none"
        />
        {/* Start / finish */}
        <Circle cx={circuit.start.x} cy={circuit.start.y} r={3.4} fill={colors.bgCarbon} />
        <Circle
          cx={circuit.start.x}
          cy={circuit.start.y}
          r={3.4}
          stroke={colors.accentGreen}
          strokeWidth={1.8}
          fill="none"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    alignItems: 'center',
  },
  // Capped rather than full-width. A square map at full phone width dominated
  // the screen and pushed the session times below the fold; this keeps the
  // layout readable while leaving the stats visible without scrolling.
  svg: {
    width: '100%',
    maxWidth: 210,
    aspectRatio: 1,
  },
  placeholder: {
    height: 140,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  placeholderText: {
    color: colors.textMuted,
    fontSize: 12,
  },
});
