import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';
import { easeOut, motion, useNativeDriver } from '../../theme/motion';

interface Props {
  children: React.ReactNode;
  // Delay before the entrance starts — pass a staggerDelay(index) for lists.
  delay?: number;
  duration?: number;
  // How far the content slides up as it fades in. 0 for a pure fade.
  offsetY?: number;
  style?: StyleProp<ViewStyle>;
}

// Fade + slide-up entrance built on the built-in Animated API (no babel plugin,
// works on native and web). Mounts at opacity 0 and animates to its resting
// position once, so it's safe to wrap around cards and list rows.
export default function FadeInView({
  children,
  delay = 0,
  duration = motion.base,
  offsetY = 12,
  style,
}: Props) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: easeOut,
      useNativeDriver,
    });
    anim.start();
    return () => anim.stop();
    // Intentionally run once on mount; entrances shouldn't replay on re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [offsetY, 0],
  });

  return (
    <Animated.View style={[{ opacity: progress, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}
