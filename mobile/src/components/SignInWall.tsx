import React from 'react';
import { View, Text, StyleSheet, TextStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import PressableScale from './anim/PressableScale';

// A cross-platform blur for text we deliberately withhold. expo-blur would be
// the obvious tool, but it is a native module: adding one to this app would
// break over-the-air updates for anyone on the existing APK, who would get JS
// referencing native code their binary does not contain. Painting the glyph in
// its own shadow and hiding the glyph itself needs nothing but core RN, and
// renders identically on Android and on the web build.
export const blurredText = (radius = 7): TextStyle => ({
  color: 'transparent',
  textShadowColor: colors.textSecondary,
  textShadowOffset: { width: 0, height: 0 },
  textShadowRadius: radius,
});

interface SignInWallProps {
  title: string;
  message: string;
  // Rendered behind the card, blurred, so the panel reads as "there is real
  // content here" rather than as an empty state.
  backdrop?: React.ReactNode;
  compact?: boolean;
}

/**
 * The gate a guest meets wherever player data would be. It never renders real
 * data behind the blur — a guest's app has not been sent any, and blurring
 * something the client already holds would be theatre, not privacy.
 */
export default function SignInWall({ title, message, backdrop, compact }: SignInWallProps) {
  const router = useRouter();

  return (
    <View style={styles.wrap}>
      {!!backdrop && (
        <View style={styles.backdrop} pointerEvents="none">
          {backdrop}
        </View>
      )}
      <View style={[styles.card, compact && styles.cardCompact]}>
        <View style={styles.lock}>
          <Ionicons name="lock-closed" size={16} color={colors.brass} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <PressableScale
          style={styles.button}
          onPress={() => router.push('/(auth)/login')}
          accessibilityRole="button"
          accessibilityLabel="Sign in with Google"
        >
          <Text style={styles.buttonText}>Sign in with Google</Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 18 },
  backdrop: { ...StyleSheet.absoluteFillObject, opacity: 0.55 },
  card: {
    alignItems: 'center',
    paddingVertical: 26,
    paddingHorizontal: 22,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.heroTop,
  },
  cardCompact: { paddingVertical: 18 },
  lock: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    marginBottom: 12,
  },
  title: {
    fontFamily: 'Jost-Bold',
    fontSize: 16,
    letterSpacing: 0.3,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  message: {
    fontFamily: 'Karla-Regular',
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 300,
  },
  button: {
    marginTop: 16,
    backgroundColor: colors.f1Red,
    borderRadius: 9,
    paddingVertical: 13,
    paddingHorizontal: 26,
  },
  buttonText: {
    fontFamily: 'Jost-SemiBold',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.oxbloodFg,
  },
});
