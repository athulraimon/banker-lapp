import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import FadeInView from './anim/FadeInView';
import PixelCar from './PixelCar';

// Chrome fires this so a site can offer installation in its own UI instead of
// relying on the address-bar icon, which most people never notice. It is not in
// the DOM lib types.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'bl.installPrompt.dismissed';

const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari predates display-mode and uses this instead.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true);

const isIos = () =>
  typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

// Offers "add to home screen" from inside the app.
//
// Two paths, because the platforms genuinely differ: Chrome hands over a
// deferred prompt event that installs in one tap, while iOS Safari has no
// programmatic install at all and can only be told where the button is.
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (isStandalone()) return;                       // already installed
    try {
      if (window.localStorage.getItem(DISMISSED_KEY)) return;
    } catch {
      // Private mode can throw on localStorage; showing the prompt is the
      // harmless outcome, so carry on.
    }

    const onPrompt = (e: Event) => {
      // Without preventDefault Chrome may show its own mini-infobar instead and
      // the event cannot be replayed later from our button.
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    const onInstalled = () => setHidden(true);

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    // iOS never fires beforeinstallprompt, so there is nothing to wait for.
    if (isIos()) {
      setShowIosHint(true);
      setHidden(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = useCallback(() => {
    setHidden(true);
    try {
      window.localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Nothing to do — it will simply offer again next launch.
    }
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    // The event is single-use either way, so drop it.
    setDeferred(null);
    if (outcome === 'accepted') setHidden(true);
    else dismiss();
  }, [deferred, dismiss]);

  if (hidden || (!deferred && !showIosHint)) return null;

  return (
    <FadeInView style={styles.wrap} offsetY={16}>
      <View style={styles.card}>
        <PixelCar cell={2} style={styles.mark} />
        <View style={styles.copy}>
          <Text style={styles.title} numberOfLines={1}>
            Install Banker Lapp
          </Text>
          <Text style={styles.sub} numberOfLines={2}>
            {showIosHint
              ? 'Tap Share, then "Add to Home Screen".'
              : 'Adds it to your home screen.'}
          </Text>
        </View>
        {!showIosHint && (
          <TouchableOpacity style={styles.cta} onPress={install} accessibilityRole="button">
            <Text style={styles.ctaText}>Install</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={dismiss}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        >
          <Ionicons name="close" size={17} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  // Floats above the tab bar rather than pushing layout around, so it can appear
  // at any moment without reflowing the screen underneath.
  wrap: { position: 'absolute', left: 12, right: 12, bottom: 74 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bgCardHeader,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  mark: { opacity: 0.95 },
  copy: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: 'Jost-SemiBold',
    fontSize: 13,
    lineHeight: 18,
    color: colors.textPrimary,
  },
  sub: {
    fontFamily: 'Karla-Regular',
    fontSize: 11,
    lineHeight: 15,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cta: {
    backgroundColor: colors.oxblood,
    borderRadius: 7,
    paddingVertical: 8,
    paddingHorizontal: 13,
  },
  ctaText: {
    fontFamily: 'Jost-SemiBold',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.oxbloodFg,
  },
});
