import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { showAlert } from '../../src/components/AppDialog';
import { colors } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';
import { authApi } from '../../src/api/auth';
import { useAuthStore } from '../../src/store/useAuthStore';
// Resolves to googleAuth.ts (Play Services) on native and googleAuth.web.ts
// (OIDC redirect) on web, so this screen is identical on both platforms.
import { signInWithGoogle, completeGoogleRedirect, GoogleAuthResult } from '../../src/auth/googleAuth';

export default function LoginScreen() {
  const { setAuthWithExpiry } = useAuthStore();
  const [busy, setBusy] = useState(false);

  const exchangeIdToken = async (result: GoogleAuthResult) => {
    if (result.status === 'cancelled') return;
    if (result.status === 'error') {
      showAlert('Sign In Error', result.message);
      return;
    }
    try {
      const response = await authApi.googleLogin(result.idToken);
      setAuthWithExpiry(response.user, response.access_token, response.refresh_token);
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
      if (!result || cancelled) return;
      setBusy(true);
      await exchangeIdToken(result);
      if (!cancelled) setBusy(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleGoogleSignIn = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await exchangeIdToken(await signInWithGoogle());
    } finally {
      // On web this never runs — signInWithGoogle navigates away from the page.
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={typography.h1}>Banker <Text style={styles.highlight}>Lapp</Text></Text>
        <Text style={styles.subtitle}>Formula 1 Private Predictions Championship</Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.googleButton, busy && styles.googleButtonDisabled]}
          onPress={handleGoogleSignIn}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : (
            <Text style={styles.googleButtonText}>Sign In with Google</Text>
          )}
        </TouchableOpacity>
      </View>
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
  highlight: {
    color: colors.f1Red,
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
