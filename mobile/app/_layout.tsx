import '../global.css';
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useAuthStore } from '../src/store/useAuthStore';
import { useFonts } from 'expo-font';
import { Jost_500Medium, Jost_600SemiBold, Jost_700Bold } from '@expo-google-fonts/jost';
import { Karla_400Regular, Karla_700Bold } from '@expo-google-fonts/karla';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../src/theme/colors';
import { DialogHost } from '../src/components/AppDialog';
import { AppShell } from '../src/components/AppShell';
import PixelCarLoader from '../src/components/PixelCarLoader';
import InstallPrompt from '../src/components/InstallPrompt';

const queryClient = new QueryClient();

// Keep the splash screen visible while we fetch resources. Rejects harmlessly on
// web, where there is no native splash screen to hold.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Any error thrown while rendering a route lands here instead of unmounting the
// tree and leaving a blank page. A white screen with no message is the worst
// possible failure mode — it looks identical to a hang, a bundling error and a
// crash, so there is nothing to act on.
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  return (
    <ScrollView style={fallback.page} contentContainerStyle={fallback.content}>
      <Text style={fallback.title}>Something broke while rendering</Text>
      <Text style={fallback.message}>{error?.message ?? String(error)}</Text>
      {!!error?.stack && <Text style={fallback.stack}>{error.stack}</Text>}
      <Text style={fallback.retry} onPress={() => retry()}>
        Tap to retry
      </Text>
    </ScrollView>
  );
}

// Fonts are cosmetic. Blocking the entire app on them means one slow or failed
// font load shows the user nothing at all, so we give up waiting after this long
// and render with system fonts instead.
const FONT_TIMEOUT_MS = 3000;

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    // New vintage type system.
    'Jost-Bold': Jost_700Bold,
    'Jost-SemiBold': Jost_600SemiBold,
    'Jost-Medium': Jost_500Medium,
    'Karla-Regular': Karla_400Regular,
    'Karla-Bold': Karla_700Bold,
    // Legacy aliases so screens still referencing the old family names keep
    // rendering in the vintage type until they are migrated.
    'SpaceGrotesk-Bold': Jost_700Bold,
    'Outfit-Regular': Karla_400Regular,
  });
  const [fontsTimedOut, setFontsTimedOut] = useState(false);

  useEffect(() => {
    if (fontsLoaded || fontError) return;
    const t = setTimeout(() => setFontsTimedOut(true), FONT_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [fontsLoaded, fontError]);

  const { isAuthenticated, accessToken, hasHydrated } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  // Proceed once fonts are settled one way or another. Only hydration is a hard
  // gate, because routing before it would sign the user out on every launch.
  const fontsSettled = fontsLoaded || !!fontError || fontsTimedOut;
  const ready = fontsSettled && hasHydrated;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  useEffect(() => {
    // Waiting on hasHydrated matters as much as fonts: redirecting before the
    // stored session is read back would sign the user out on every launch.
    if (!ready) return;

    const inAuthGroup = segments[0] === '(auth)';

    // We only care whether a session exists here. An expired access token is
    // fine — the API client refreshes it transparently on the next request, and
    // only a real auth rejection clears the session. Doing our own refresh here
    // (and logging out on any failure) was a second source of surprise logouts.
    const hasValidToken = isAuthenticated && accessToken && accessToken.length > 0;

    // Auth redirection logic
    if (!hasValidToken && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (hasValidToken && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, accessToken, segments, ready]);

  // Deliberately not null, and no longer a bare coloured view either. Returning
  // null renders a white page indistinguishable from a crash; an empty carbon
  // view is better but still reads as a hang. The pixel car spins here while
  // fonts and the stored session resolve, which is usually well under a second
  // but is the first thing anyone sees.
  if (!ready) {
    return (
      <View style={fallback.booting}>
        <PixelCarLoader cell={4} label="Formation lap" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" backgroundColor={colors.bgCarbon} />
      <AppShell>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bgCarbon } }}>
          <Stack.Screen name="(auth)/login" options={{ animation: 'fade' }} />
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        </Stack>
        <DialogHost />
        <InstallPrompt />
      </AppShell>
    </QueryClientProvider>
  );
}

const fallback = StyleSheet.create({
  booting: { flex: 1, backgroundColor: colors.bgCarbon, alignItems: 'center', justifyContent: 'center' },
  page: { flex: 1, backgroundColor: colors.bgCarbon },
  content: { padding: 24, paddingTop: 64 },
  title: { color: colors.f1Red, fontSize: 18, fontWeight: '700', marginBottom: 12 },
  message: { color: colors.textPrimary, fontSize: 15, marginBottom: 16 },
  stack: { color: colors.textMuted, fontSize: 11, marginBottom: 24 },
  retry: { color: colors.accentGreen, fontSize: 15, fontWeight: '700' },
});