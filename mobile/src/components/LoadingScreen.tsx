import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';
import PixelCarLoader from './PixelCarLoader';

// Full-screen themed loading state used while a screen fetches its data.
//
// This used to be a "BL" monogram inside a spinning brass ring — which is the
// exact circular spinner the pixel car replaced on the boot screen, so the app
// was showing two different loading identities depending on which screen you
// were waiting on.
//
// Kept as its own component instead of folding the call sites into
// PixelCarLoader directly: screens ask for "the app's loading screen" and should
// keep getting whatever that currently is, without each one naming the artwork.
export default function LoadingScreen({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.container}>
      <PixelCarLoader cell={4} label={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgCarbon,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
