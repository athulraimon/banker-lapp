import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { showAlert } from '../../src/components/AppDialog';
import { colors } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';
import { authApi } from '../../src/api/auth';
import { useAuthStore } from '../../src/store/useAuthStore';
import { usePendingPredictionStore } from '../../src/store/usePendingPredictionStore';
import { predictionsApi } from '../../src/api/predictions';
import FadeInView from '../../src/components/anim/FadeInView';
import PressableScale from '../../src/components/anim/PressableScale';
import CheckerStripe from '../../src/components/CheckerStripe';
import { motion } from '../../src/theme/motion';
// Resolves to googleAuth.ts (Play Services) on native and googleAuth.web.ts
// (OIDC redirect) on web, so this screen is identical on both platforms.
import { signInWithGoogle, completeGoogleRedirect, GoogleAuthResult } from '../../src/auth/googleAuth';

export default function LoginScreen() {
  const { setAuthWithExpiry, continueAsGuest, setSignInPending, isGuest } = useAuthStore();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // Picks a guest made before being asked to sign in. Submitting them here, the
  // moment the session exists, is the whole point of stashing them: the sign-in
  // interrupted a save, so the save should finish itself.
  const flushPendingPrediction = async () => {
    const { pending, clearPending } = usePendingPredictionStore.getState();
    if (!pending) return;
    try {
      await predictionsApi.submitPrediction(pending);
      clearPending();
      showAlert('Picks saved', 'The picks you made before signing in are in.');
    } catch (error: any) {
      // Keep the stash on failure — a locked race or a dropped connection
      // should not silently bin work the user has already done. The race
      // screen still has them when they go back.
      showAlert(
        'Signed in, but the picks did not save',
        error?.response?.data?.error ?? 'Open the race again and tap Save.'
      );
    }
  };

  const exchangeIdToken = async (result: GoogleAuthResult) => {
    if (result.status === 'cancelled') return;
    if (result.status === 'error') {
      showAlert('Sign In Error', result.message);
      return;
    }
    try {
      const response = await authApi.googleLogin(result.idToken);
      setAuthWithExpiry(response.user, response.access_token, response.refresh_token);
      await flushPendingPrediction();
    } catch (error: any) {
      showAlert('Sign In Error', error?.message ?? 'Could not reach the server.');
    }
  };

  // On web the user returns from Google as a fresh page load, so the token
  // arrives in the URL rather than from a promise. On native this returns null.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await completeGoogleRedirect();
      // Clear the flag either way: a null result means there was no redirect to
      // finish (or the user abandoned one), and leaving it set would pin them to
      // this screen on every launch.
      setSignInPending(false);
      if (!result || cancelled) return;
      setBusy(true);
      await exchangeIdToken(result);
      if (!cancelled) setBusy(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleBrowse = () => {
    continueAsGuest();
    router.replace('/(tabs)');
  };

  const handleGoogleSignIn = async () => {
    if (busy) return;
    setBusy(true);
    // Set before the call: on web, signInWithGoogle navigates away immediately
    // and anything after it never runs.
    setSignInPending(true);
    try {
      await exchangeIdToken(await signInWithGoogle());
    } finally {
      // On web this never runs — signInWithGoogle navigates away from the page.
      setSignInPending(false);
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <FadeInView style={styles.headerContainer} offsetY={18} duration={motion.slow}>
        <View style={styles.checker}>
          <CheckerStripe colorA={colors.cream} colorB={colors.bgCarbon} height={8} cell={8} />
        </View>
        <Text style={typography.h1}>Banker <Text style={styles.highlight}>Lapp</Text></Text>
        <Text style={styles.subtitle}>Formula 1 Private Predictions Championship</Text>
      </FadeInView>

      <FadeInView style={styles.buttonContainer} delay={motion.base} offsetY={18} duration={motion.slow}>
        <PressableScale
          style={[styles.googleButton, busy && styles.googleButtonDisabled]}
          onPress={handleGoogleSignIn}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : (
            <Text style={styles.googleButtonText}>Sign In with Google</Text>
          )}
        </PressableScale>

        <PressableScale
          style={styles.guestButton}
          onPress={handleBrowse}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={isGuest ? 'Keep looking around' : 'Look around first'}
        >
          <Text style={styles.guestButtonText}>
            {isGuest ? 'Keep looking around' : 'Look around first'}
          </Text>
        </PressableScale>

        <Text style={styles.guestNote}>
          Browsing shows the calendar, circuits, results and the F1 championship.
          Making a prediction or seeing the league table needs an account.
        </Text>
      </FadeInView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgCarbon,
    justifyContent: 'center',
    padding: 24,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  checker: {
    width: 120,
    height: 8,
    overflow: 'hidden',
    borderRadius: 2,
    marginBottom: 20,
  },
  highlight: {
    color: colors.brass,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  buttonContainer: {
    width: '100%',
  },
  guestButton: {
    marginTop: 12,
    paddingVertical: 15,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
  },
  guestButtonText: {
    fontFamily: 'Jost-SemiBold',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  guestNote: {
    fontFamily: 'Karla-Regular',
    fontSize: 11.5,
    lineHeight: 18,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 16,
  },
  googleButton: {
    backgroundColor: colors.f1Red,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    // Fixed height so swapping the label for a spinner doesn't resize the button.
    minHeight: 54,
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleButtonText: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 16,
    color: colors.textPrimary,
    textTransform: 'uppercase',
  }
});
