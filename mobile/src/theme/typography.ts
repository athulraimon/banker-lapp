import { StyleSheet } from 'react-native';
import { colors } from './colors';

// In Expo, you will need to load these fonts using expo-font
// For now, these map to standard or system fonts if not loaded yet
export const typography = StyleSheet.create({
  h1: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 40,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: -1,
    color: colors.textPrimary,
  },
  h2: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 24,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.textPrimary,
  },
  h3: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  body: {
    fontFamily: 'Outfit-Regular',
    fontSize: 16,
    color: colors.textPrimary,
  },
  bodySmall: {
    fontFamily: 'Outfit-Regular',
    fontSize: 14,
    color: colors.textSecondary,
  },
  caption: {
    fontFamily: 'Outfit-Regular',
    fontSize: 12,
    color: colors.textMuted,
  },
  sectionHeaderCompact: {
    fontFamily: 'SpaceGrotesk-Bold',
    textTransform: 'uppercase',
    fontSize: 14,
    letterSpacing: 0.5,
    color: colors.textSecondary,
    marginBottom: 12,
    marginTop: 8,
  }
});
