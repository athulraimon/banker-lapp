import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

// The layout was designed for a phone. Rather than restyling every screen for
// desktop, the web build renders it in a centred, phone-width column — the same
// approach used by most mobile-first PWAs. On an actual phone browser the
// viewport is narrower than maxWidth, so this is a no-op there and the design
// is pixel-identical to the Android app.
const MAX_WIDTH = 520;

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.page}>
      <View style={styles.column}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.bgCarbon,
    alignItems: 'center',
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_WIDTH,
    backgroundColor: colors.bgCarbon,
    // Hairline edges so the column reads as a device on wide screens without
    // introducing a second surface colour.
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
});
