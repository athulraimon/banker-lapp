import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { useDrivers } from '../hooks/useDrivers';
import { Driver } from '../api/drivers';
import { ResultInput } from '../api/admin';

type Slot = 'pole_driver_id' | 'p1_driver_id' | 'p2_driver_id' | 'p3_driver_id';

const SLOTS: { key: Slot; label: string }[] = [
  { key: 'pole_driver_id', label: 'POLE' },
  { key: 'p1_driver_id', label: 'P1' },
  { key: 'p2_driver_id', label: 'P2' },
  { key: 'p3_driver_id', label: 'P3' },
];

interface Props {
  visible: boolean;
  title: string;
  subtitle?: string;
  initial?: Partial<ResultInput>;
  submitting?: boolean;
  onCancel: () => void;
  onSubmit: (value: ResultInput) => void;
}

// Reusable four-slot driver picker used by the admin screen for both entering
// official results and editing a user's prediction.
export default function ResultPickerModal({ visible, title, subtitle, initial, submitting, onCancel, onSubmit }: Props) {
  const { drivers, byId, isLoading } = useDrivers();
  const [value, setValue] = useState<ResultInput>({
    pole_driver_id: initial?.pole_driver_id ?? '',
    p1_driver_id: initial?.p1_driver_id ?? '',
    p2_driver_id: initial?.p2_driver_id ?? '',
    p3_driver_id: initial?.p3_driver_id ?? '',
  });
  const [activeSlot, setActiveSlot] = useState<Slot | null>(null);
  const [query, setQuery] = useState('');

  // Reset local state whenever the modal is (re)opened.
  React.useEffect(() => {
    if (visible) {
      setValue({
        pole_driver_id: initial?.pole_driver_id ?? '',
        p1_driver_id: initial?.p1_driver_id ?? '',
        p2_driver_id: initial?.p2_driver_id ?? '',
        p3_driver_id: initial?.p3_driver_id ?? '',
      });
      setActiveSlot(null);
      setQuery('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return drivers;
    return drivers.filter(
      (d) =>
        d.driver_id.toLowerCase().includes(q) ||
        d.broadcast_name.toLowerCase().includes(q) ||
        d.team_name.toLowerCase().includes(q)
    );
  }, [drivers, query]);

  const podiumDupe =
    (value.p1_driver_id && value.p1_driver_id === value.p2_driver_id) ||
    (value.p1_driver_id && value.p1_driver_id === value.p3_driver_id) ||
    (value.p2_driver_id && value.p2_driver_id === value.p3_driver_id);

  const pick = (d: Driver) => {
    if (activeSlot) setValue((v) => ({ ...v, [activeSlot]: d.driver_id }));
    setActiveSlot(null);
    setQuery('');
  };

  const clearSlot = () => {
    if (activeSlot) setValue((v) => ({ ...v, [activeSlot]: '' }));
    setActiveSlot(null);
    setQuery('');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.sheet}>
          <Text style={typography.h3}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

          {activeSlot ? (
            <View style={styles.pickerArea}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search driver…"
                placeholderTextColor={colors.textMuted}
                value={query}
                onChangeText={setQuery}
                autoCapitalize="characters"
                autoFocus
              />
              <TouchableOpacity style={styles.noneItem} onPress={clearSlot}>
                <Text style={styles.noneText}>✕  None (clear this position)</Text>
              </TouchableOpacity>
              {isLoading ? (
                <ActivityIndicator color={colors.f1Red} style={{ marginTop: 20 }} />
              ) : (
                <FlatList
                  data={filtered}
                  keyExtractor={(d) => d.driver_id}
                  keyboardShouldPersistTaps="handled"
                  style={{ maxHeight: 260 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.driverItem} onPress={() => pick(item)}>
                      <View style={[styles.stripe, { backgroundColor: `#${item.team_color || '888'}` }]} />
                      <Text style={styles.driverText}>
                        {item.driver_id} · {item.broadcast_name}
                        <Text style={styles.teamText}> {item.team_name}</Text>
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              )}
              <TouchableOpacity style={styles.linkBtn} onPress={() => setActiveSlot(null)}>
                <Text style={styles.linkText}>Back</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {SLOTS.map((s) => {
                const id = value[s.key];
                const d = id ? byId[id] : undefined;
                return (
                  <TouchableOpacity key={s.key} style={styles.slot} onPress={() => setActiveSlot(s.key)}>
                    <Text style={styles.slotLabel}>{s.label}</Text>
                    <Text style={id ? styles.slotValue : styles.slotPlaceholder}>
                      {id ? (d ? `${id} · ${d.broadcast_name}` : id) : 'Tap to select…'}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              {podiumDupe ? <Text style={styles.warn}>P1/P2/P3 must be three different drivers.</Text> : null}

              <View style={styles.actions}>
                <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onCancel} disabled={submitting}>
                  <Text style={styles.btnGhostText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary, (!!podiumDupe || submitting) && { opacity: 0.5 }]}
                  onPress={() => onSubmit(value)}
                  disabled={!!podiumDupe || submitting}
                >
                  {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    borderTopWidth: 1,
    borderColor: colors.borderColor,
  },
  subtitle: { ...typography.caption, color: colors.textMuted, marginTop: 4, marginBottom: 12 },
  pickerArea: { marginTop: 12 },
  searchInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontFamily: 'Outfit-Regular',
  },
  noneItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', marginTop: 6 },
  noneText: { fontFamily: 'SpaceGrotesk-Bold', fontSize: 13, color: colors.textSecondary },
  driverItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  stripe: { width: 4, height: 18, borderRadius: 2 },
  driverText: { ...typography.body, flexShrink: 1 },
  teamText: { ...typography.caption, color: colors.textMuted },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginTop: 10,
  },
  slotLabel: { fontFamily: 'SpaceGrotesk-Bold', fontSize: 13, color: colors.f1Red, width: 48 },
  slotValue: { ...typography.body, flex: 1, textAlign: 'right' },
  slotPlaceholder: { ...typography.body, color: colors.textMuted, flex: 1, textAlign: 'right' },
  warn: { ...typography.caption, color: colors.f1Red, marginTop: 12 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 8 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  btnGhost: { borderWidth: 1, borderColor: colors.borderColor },
  btnGhostText: { fontFamily: 'SpaceGrotesk-Bold', color: colors.textSecondary },
  btnPrimary: { backgroundColor: colors.f1Red },
  btnPrimaryText: { fontFamily: 'SpaceGrotesk-Bold', color: '#fff' },
  linkBtn: { paddingVertical: 12, alignItems: 'center' },
  linkText: { fontFamily: 'SpaceGrotesk-Bold', color: colors.textSecondary },
});
