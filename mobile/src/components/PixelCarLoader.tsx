import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { useNativeDriver } from '../theme/motion';
import {
  CAR_BODY,
  CAR_H,
  CAR_W,
  CAR_WHEEL_FRAMES,
  PIXEL_PALETTE,
  WHEEL_CENTERS,
  wheelOffset,
} from '../theme/pixelCar';
import PixelSprite from './PixelSprite';

// Room behind the car for the exhaust smoke to drift into, in art pixels.
const TRAIL_CELLS = 15;
const PUFFS = 5;

// One two-frame wheel cycle. ~170ms reads as a fast spin without strobing; much
// quicker and the two frames average into a static blur.
const SPIN_MS = 170;
const PUFF_MS = 1300;
const ROAD_MS = 520;
const BOB_MS = 900;

// Road dashes: 3 pixels on, 3 off. The strip scrolls exactly one pitch and loops,
// so the seam is invisible.
const DASH_ON = 3;
const DASH_PITCH = 6;

interface Props {
  cell?: number;
  // Optional caption under the car, e.g. "Formation lap".
  label?: string;
  style?: StyleProp<ViewStyle>;
}

// A vintage racer holding station: wire wheels spinning, exhaust smoke trailing
// off behind it, road dashes streaming underneath.
//
// This replaces the spinner on the boot screen. A spinner says "something is
// happening"; this says which app you opened, which is the whole job of a launch
// screen. Everything is driven by four looping Animated values on the native
// driver, so it costs nothing while the session and fonts are still resolving.
export default function PixelCarLoader({ cell = 4, label, style }: Props) {
  const c = Math.max(1, Math.round(cell));

  const spin = useRef(new Animated.Value(0)).current;
  const road = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  // One value per smoke puff so they can be phase-offset against each other.
  const puffs = useMemo(
    () => Array.from({ length: PUFFS }, () => new Animated.Value(0)),
    []
  );

  useEffect(() => {
    const linear = (v: Animated.Value, duration: number) =>
      Animated.loop(
        Animated.timing(v, { toValue: 1, duration, easing: Easing.linear, useNativeDriver })
      );

    const loops = [
      linear(spin, SPIN_MS),
      linear(road, ROAD_MS),
      Animated.loop(
        Animated.sequence([
          Animated.timing(bob, { toValue: 1, duration: BOB_MS / 2, easing: Easing.inOut(Easing.quad), useNativeDriver }),
          Animated.timing(bob, { toValue: 0, duration: BOB_MS / 2, easing: Easing.inOut(Easing.quad), useNativeDriver }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver }),
          Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver }),
        ])
      ),
    ];
    loops.forEach((l) => l.start());

    // The puffs all share one period and are started at staggered wall-clock
    // times, which spaces them evenly and keeps them spaced forever. Offsetting
    // a single shared value would need Animated.modulo to wrap, and one value
    // per puff is easier to read than that.
    const timers = puffs.map((v, i) =>
      setTimeout(() => {
        const loop = linear(v, PUFF_MS);
        loops.push(loop);
        loop.start();
      }, (i * PUFF_MS) / PUFFS)
    );

    return () => {
      timers.forEach(clearTimeout);
      loops.forEach((l) => l.stop());
    };
    // Animation values are refs; this is a mount-once effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hard cut between the two wheel frames — no cross-fade, or the spokes blur
  // together and the wheel looks like a smudge rather than a spinning wheel.
  const frameOpacity = (frame: 0 | 1) =>
    spin.interpolate({
      inputRange: [0, 0.4999, 0.5, 1],
      outputRange: frame === 0 ? [1, 1, 0, 0] : [0, 0, 1, 1],
    });

  const totalCells = TRAIL_CELLS + CAR_W;
  const dashCount = Math.ceil((totalCells + DASH_PITCH) / DASH_PITCH);

  return (
    <View style={[styles.wrap, style]}>
      <View style={{ width: totalCells * c, height: (CAR_H + 3) * c }}>
        {/* Exhaust smoke, drifting back and up as it thins out. */}
        {puffs.map((p, i) => (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: (TRAIL_CELLS - 2) * c,
              top: 7 * c,
              width: 2 * c,
              height: 2 * c,
              backgroundColor: i % 2 === 0 ? colors.textSecondary : colors.textMuted,
              opacity: p.interpolate({
                inputRange: [0, 0.12, 1],
                outputRange: [0, 0.7, 0],
              }),
              transform: [
                {
                  translateX: p.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -(TRAIL_CELLS - 2) * c],
                  }),
                },
                {
                  translateY: p.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -3 * c],
                  }),
                },
                { scale: p.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) },
              ],
            }}
          />
        ))}

        {/* The car, bobbing one pixel so it never looks pinned to the page. */}
        <Animated.View
          style={{
            position: 'absolute',
            left: TRAIL_CELLS * c,
            top: 0,
            transform: [
              { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -c] }) },
            ],
          }}
        >
          <View style={{ width: CAR_W * c, height: CAR_H * c }}>
            <PixelSprite rows={CAR_BODY} palette={PIXEL_PALETTE} cell={c} />
            {WHEEL_CENTERS.map((centre, i) => {
              const { x, y } = wheelOffset(centre);
              return (
                <View key={i} style={{ position: 'absolute', left: x * c, top: y * c }}>
                  {([0, 1] as const).map((frame) => (
                    <Animated.View
                      key={frame}
                      style={{ position: 'absolute', opacity: frameOpacity(frame) }}
                    >
                      <PixelSprite
                        rows={CAR_WHEEL_FRAMES[frame]}
                        palette={PIXEL_PALETTE}
                        cell={c}
                      />
                    </Animated.View>
                  ))}
                </View>
              );
            })}
          </View>
        </Animated.View>

        {/* Road: brass dashes streaming backwards under the wheels. */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: (CAR_H + 1) * c,
            right: 0,
            height: c,
            overflow: 'hidden',
          }}
        >
          <Animated.View
            style={{
              flexDirection: 'row',
              width: (totalCells + DASH_PITCH) * c,
              transform: [
                {
                  translateX: road.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -DASH_PITCH * c],
                  }),
                },
              ],
            }}
          >
            {Array.from({ length: dashCount }, (_, i) => (
              <View
                key={i}
                style={{
                  width: DASH_ON * c,
                  height: c,
                  marginRight: (DASH_PITCH - DASH_ON) * c,
                  backgroundColor: colors.brassDim,
                }}
              />
            ))}
          </Animated.View>
        </View>
      </View>

      {!!label && (
        <Animated.Text
          style={[
            styles.label,
            { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.9] }) },
          ]}
        >
          {label}
        </Animated.Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  label: {
    fontFamily: 'Jost-SemiBold',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2.6,
    textTransform: 'uppercase',
    color: colors.brass,
    marginTop: 18,
  },
});
