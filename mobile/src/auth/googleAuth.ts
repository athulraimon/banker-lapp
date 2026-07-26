import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

export type GoogleAuthResult =
  | { status: 'success'; idToken: string }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_WEB_CLIENT_ID || '',
  offlineAccess: true,
});

// Native sign-in, unchanged: the Android build uses the Play Services flow that
// is already registered against the release keystore's SHA-1. The web build
// resolves googleAuth.web.ts instead, so the login screen itself is identical
// on both platforms.
export async function signInWithGoogle(): Promise<GoogleAuthResult> {
  try {
    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signIn();

    if (userInfo.type === 'success' && userInfo.data.idToken) {
      return { status: 'success', idToken: userInfo.data.idToken };
    }
    return { status: 'error', message: 'No ID token received from Google.' };
  } catch (error: any) {
    if (error?.code === statusCodes.SIGN_IN_CANCELLED) {
      return { status: 'cancelled' };
    }
    if (error?.code === statusCodes.IN_PROGRESS) {
      return { status: 'cancelled' };
    }
    if (error?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return { status: 'error', message: 'Google Play Services is unavailable or out of date.' };
    }
    return { status: 'error', message: error?.message ?? 'Google sign-in failed.' };
  }
}

// No-op on native: there is no redirect to come back from.
export async function completeGoogleRedirect(): Promise<GoogleAuthResult | null> {
  return null;
}
