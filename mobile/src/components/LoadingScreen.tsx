import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

// Full-screen themed loading state used while a screen fetches its data.
export default function LoadingScreen({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.f1Red} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgCarbon,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  label: {
    ...typography.body,
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
});
