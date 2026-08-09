import { Platform, Easing } from 'react-native';

// The built-in Animated native driver runs transforms/opacity off the JS thread
// on native, but react-native-web doesn't support it and warns loudly. Flip it
// off on web so the same components stay warning-free on both platforms.
export const useNativeDriver = Platform.OS !== 'web';

// One place for timing so every screen feels part of the same app: entrances,
// presses and skeleton pulses all share this vocabulary.
export const motion = {
  fast: 160,
  base: 280,
  slow: 440,
  // Delay between successive list items so a list resolves as a quick cascade
  // rather than everything popping in at once.
  stagger: 55,
  // Cap the cumulative stagger so a long list never feels sluggish at the tail.
  maxStagger: 360,
};

// A soft "arrive and settle" curve (easeOutExpo-ish) for entrances.
export const easeOut = Easing.bezier(0.22, 1, 0.36, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

// Stagger delay for the item at `index`, clamped so long lists stay snappy.
export const staggerDelay = (index: number) =>
  Math.min(index * motion.stagger, motion.maxStagger);
