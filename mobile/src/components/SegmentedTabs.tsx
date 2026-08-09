import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { colors } from '../theme/colors';

interface Props<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  // When paired with a SwipeViews, pass its shared progress value (0 … n-1) so
  // the active indicator slides in step with the swipe.
  progress?: Animated.Value;
}

const PAD = 3;

/**
 * Full-width segmented control for switching panels within a screen. Oxblood
 * marks the active panel; when driven by a swipe it slides continuously with
 * the gesture, and each label lights up as the thumb reaches it.
 */
export default function SegmentedTabs<T extends string>({ options, value, onChange, progress }: Props<T>) {
  const [trackW, setTrackW] = useState(0);
  const count = options.length;
  const segW = trackW > 0 ? (trackW - PAD * 2) / count : 0;
  const activeIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const driven = !!progress && segW > 0;

  // Thumb position: interpolate page progress (0…n-1) onto segment offsets when
  // swiping; otherwise sit on the active tab.
  const thumbTranslate: Animated.AnimatedInterpolation<number> | number = driven
    ? progress!.interpolate({
        inputRange: options.map((_, i) => i),
        outputRange: options.map((_, i) => i * segW),
        extrapolate: 'clamp',
      })
    : activeIndex * segW;

  const labelColor = (i: number): Animated.AnimatedInterpolation<string> | string => {
    if (!driven) return options[i].value === value ? colors.oxbloodFg : colors.textSecondary;
    return progress!.interpolate({
      inputRange: [i - 1, i, i + 1],
      outputRange: [colors.textSecondary, colors.oxbloodFg, colors.textSecondary],
      extrapolate: 'clamp',
    });
  };

  return (
    <View style={styles.track} onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}>
      {segW > 0 && (
        <Animated.View style={[styles.thumb, { width: segW, transform: [{ translateX: thumbTranslate }] }]} />
      )}
      {options.map((option, i) => {
        const active = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            style={styles.segment}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Animated.Text style={[styles.label, { color: labelColor(i) as any }]} numberOfLines={1}>
              {option.label}
            </Animated.Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: 9,
    padding: PAD,
    marginBottom: 18,
    position: 'relative',
  },
  thumb: {
    position: 'absolute',
    top: PAD,
    bottom: PAD,
    left: PAD,
    borderRadius: 7,
    backgroundColor: colors.oxblood,
  },
  segment: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: 'Jost-SemiBold',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
