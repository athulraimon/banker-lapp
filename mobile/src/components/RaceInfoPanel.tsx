import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { Race } from '../api/races';
import { useCircuit } from '../hooks/useCircuit';
import CircuitMap from './CircuitMap';

/**
 * Formats an instant in the viewer's own timezone.
 *
 * Everything from the API is UTC, and friends watching from different countries
 * should each see their own clock — the Hungarian GP is 13:00 UTC, which is
 * 15:00 trackside and 18:30 in India.
 */
function formatSession(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Row({
  label,
  value,
  highlight,
  last,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, last && styles.lastRow]}>
      <Text style={[styles.rowLabel, highlight && styles.rowLabelHighlight]}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

/**
 * The weekend's sessions in running order, skipping any this weekend doesn't
 * have. A sprint weekend drops FP2 and FP3 and gains sprint qualifying and the
 * sprint, so the list differs from race to race rather than being fixed.
 */
function sessionsFor(race: Race): { label: string; iso: string; highlight?: boolean }[] {
  const all: { label: string; iso?: string | null; highlight?: boolean }[] = [
    { label: 'Practice 1', iso: race.fp1_time, highlight: true },
    { label: 'Sprint Qualifying', iso: race.sprint_qualifying_time },
    { label: 'Practice 2', iso: race.fp2_time },
    { label: 'Practice 3', iso: race.fp3_time },
    { label: 'Sprint', iso: race.sprint_time },
    { label: 'Qualifying', iso: race.qualifying_time },
    { label: 'Race', iso: race.race_time, highlight: true },
  ];

  return all
    .filter((s): s is { label: string; iso: string; highlight?: boolean } => !!s.iso)
    // Order by the clock rather than the hardcoded order above: sprint
    // qualifying falls on Friday at some rounds and Saturday at others.
    .sort((a, b) => new Date(a.iso).getTime() - new Date(b.iso).getTime());
}

export default function RaceInfoPanel({ race }: { race: Race }) {
  const { circuit, isLoading, unavailable } = useCircuit(race.circuit_name, race.country);
  const sessions = sessionsFor(race);

  const stats: { label: string; value: string }[] = [];
  if (circuit?.length) {
    stats.push({ label: 'Length', value: `${(circuit.length / 1000).toFixed(3)} km` });
  }
  if (circuit?.firstGP) {
    stats.push({ label: 'First GP', value: String(circuit.firstGP) });
  }
  if (typeof circuit?.altitude === 'number') {
    stats.push({ label: 'Altitude', value: `${circuit.altitude} m` });
  }

  return (
    <View>
      <CircuitMap circuit={circuit} isLoading={isLoading} unavailable={unavailable} />

      <Text style={styles.circuitName}>{race.circuit_name}</Text>
      <Text style={styles.circuitPlace}>
        {circuit?.location ? `${circuit.location} · ` : ''}
        {race.country}
      </Text>

      {stats.length > 0 && (
        <View style={styles.statsStrip}>
          {stats.map((s) => (
            <View key={s.label} style={styles.stat}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={[typography.sectionHeaderCompact, styles.sessionsHeader]}>Sessions · your local time</Text>
      <View style={styles.card}>
        {sessions.map((s, i) => (
          <Row
            key={s.label}
            label={s.label}
            value={formatSession(s.iso)}
            highlight={s.highlight}
            last={i === sessions.length - 1}
          />
        ))}
      </View>

      <Text style={styles.lockNote}>
        Predictions lock when Practice 1 starts.
      </Text>

      <Text style={styles.credit}>Circuit data: f1-circuits (MIT) · Schedule: Jolpica F1</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circuitName: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 16,
    color: colors.textPrimary,
  },
  circuitPlace: {
    ...typography.caption,
    marginTop: 2,
    marginBottom: 14,
  },
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: 8,
    paddingVertical: 12,
    marginBottom: 18,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 15,
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.textMuted,
    marginTop: 3,
  },
  sessionsHeader: {
    marginBottom: 8,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: 8,
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderColor,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  rowLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  // FP1 and the race are the two sessions that matter to a player: one locks
  // predictions, the other decides them.
  rowLabelHighlight: {
    color: colors.textPrimary,
    fontFamily: 'SpaceGrotesk-Bold',
  },
  rowValue: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 13,
    color: colors.textPrimary,
  },
  lockNote: {
    ...typography.caption,
    marginTop: 10,
  },
  credit: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 18,
    marginBottom: 8,
  },
});
