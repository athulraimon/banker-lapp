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

  const activeLabel = SLOTS.find((s) => s.key === activeSlot)?.label;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={activeSlot ? () => setActiveSlot(null) : onCancel}
    >
      <KeyboardAvoidingView
        style={activeSlot ? styles.pickerScreen : styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : activeSlot ? undefined : 'height'}
      >
        {activeSlot ? (
          // Top-anchored, full-screen driver picker — the same shape as the
          // search sheet the predictions screen uses, so the list stays put as
          // filtering shortens it rather than collapsing toward the keyboard.
          <>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Pick a driver{activeLabel ? ` · ${activeLabel}` : ''}</Text>
              <TouchableOpacity onPress={() => setActiveSlot(null)} hitSlop={10}>
                <Text style={styles.closeText}>Back</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder="Search driver or code — VER, HAM…"
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              returnKeyType="search"
            />

            <TouchableOpacity style={styles.clearRow} onPress={clearSlot}>
              <Text style={styles.clearText}>Clear this position</Text>
            </TouchableOpacity>

            {isLoading ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.brass} />
                <Text style={styles.emptyText}>Loading grid…</Text>
              </View>
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={(d) => d.driver_id}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                style={styles.list}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.row} onPress={() => pick(item)} activeOpacity={0.75}>
                    <View style={[styles.stripe, { backgroundColor: `#${item.team_color || '888888'}` }]} />
                    <Text style={styles.rowCode}>{item.driver_id}</Text>
                    <Text style={styles.rowName} numberOfLines={1}>{item.broadcast_name}</Text>
                    <Text style={styles.rowRight}>{item.team_name}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={styles.emptyText}>No drivers match “{query}”.</Text>}
              />
            )}
          </>
        ) : (
          <View style={styles.sheet}>
            <Text style={typography.h3}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

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
          </View>
        )}
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

  pickerScreen: { flex: 1, backgroundColor: colors.bgPhone, paddingHorizontal: 16, paddingTop: 54 },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 },
  pickerTitle: { fontFamily: 'Jost-Bold', fontSize: 20, color: colors.textPrimary, flexShrink: 1 },
  closeText: {
    fontFamily: 'Jost-SemiBold',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  searchInput: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontFamily: 'Karla-Regular',
    fontSize: 14,
    marginBottom: 10,
  },
  clearRow: { paddingVertical: 12, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: colors.borderColor },
  clearText: {
    fontFamily: 'Jost-SemiBold',
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  // flex:1 pins the list to the space below the search field, so filtering
  // leaves empty space at the bottom rather than collapsing the panel.
  list: { flex: 1 },
  listContent: { paddingBottom: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 40, gap: 8 },
  emptyText: { fontFamily: 'Karla-Regular', fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderFaint,
  },
  stripe: { width: 4, height: 22, borderRadius: 2, flexShrink: 0 },
  rowCode: { fontFamily: 'Jost-Bold', fontSize: 13, width: 42, color: colors.textPrimary },
  rowName: { fontFamily: 'Karla-Regular', fontSize: 14, color: colors.textPrimary, flex: 1 },
  rowRight: { fontFamily: 'Karla-Regular', fontSize: 11.5, color: colors.textMuted },
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
});
