import { StyleSheet } from 'react-native';
import { colors } from './colors';

// Jost (1930s geometric) for headings, labels and anything numeric; Karla for
// body copy. Font faces are registered in app/_layout.tsx. The legacy family
// keys 'SpaceGrotesk-Bold' / 'Outfit-Regular' are also registered as aliases
// onto Jost/Karla so screens not yet migrated to the new names still render in
// the vintage type.
export const typography = StyleSheet.create({
  h1: {
    fontFamily: 'Jost-Bold',
    fontSize: 40,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: -0.5,
    color: colors.textPrimary,
  },
  h2: {
    fontFamily: 'Jost-Bold',
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: colors.textPrimary,
  },
  h3: {
    fontFamily: 'Jost-SemiBold',
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  body: {
    fontFamily: 'Karla-Regular',
    fontSize: 15,
    color: colors.textPrimary,
  },
  bodySmall: {
    fontFamily: 'Karla-Regular',
    fontSize: 13.5,
    color: colors.textSecondary,
  },
  caption: {
    fontFamily: 'Karla-Regular',
    fontSize: 12,
    color: colors.textMuted,
  },
  // Uppercase eyebrow label with the wide letter-spacing used throughout the
  // vintage layout.
  sectionHeaderCompact: {
    fontFamily: 'Jost-SemiBold',
    textTransform: 'uppercase',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2.4,
    color: colors.textSecondary,
    marginBottom: 12,
    marginTop: 8,
  },
});
