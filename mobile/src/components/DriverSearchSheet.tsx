import React, { forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { useDrivers } from '../hooks/useDrivers';
import { Driver } from '../api/drivers';

interface DriverSearchSheetProps {
  onSelectDriver: (driverId: string) => void;
  selectedDrivers: string[];
}

// Imperative API kept compatible with the previous bottom-sheet version so the
// prediction editor can keep calling ref.expand() / ref.close().
export interface DriverSearchSheetRef {
  expand: () => void;
  close: () => void;
}

// Plain-Modal driver picker. Mirrors the admin ResultPickerModal, which renders
// reliably — the earlier @gorhom/bottom-sheet version would not expand on some
// devices, leaving the list invisible.
const DriverSearchSheet = forwardRef<DriverSearchSheetRef, DriverSearchSheetProps>(
  ({ onSelectDriver, selectedDrivers }, ref) => {
    const { drivers, isLoading, error } = useDrivers();
    const [visible, setVisible] = useState(false);
    const [query, setQuery] = useState('');

    useImperativeHandle(ref, () => ({
      expand: () => {
        setQuery('');
        setVisible(true);
      },
      close: () => setVisible(false),
    }));

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

    const renderItem = ({ item }: { item: Driver }) => {
      const isSelected = selectedDrivers.includes(item.driver_id);
      return (
        <TouchableOpacity
          style={[styles.searchItem, isSelected && styles.searchItemSelected]}
          onPress={() => {
            onSelectDriver(item.driver_id);
            setVisible(false);
          }}
        >
          <View style={styles.driverRow}>
            <View style={[styles.teamStripe, { backgroundColor: `#${item.team_color || '888888'}` }]} />
            <Text style={[styles.driverName, isSelected && { color: colors.f1Red, fontFamily: 'SpaceGrotesk-Bold' }]}>
              {item.driver_id} · {item.broadcast_name} <Text style={styles.teamName}>{item.team_name}</Text>
            </Text>
          </View>
          <Text style={[styles.selectText, isSelected && { color: colors.f1Red }]}>
            {isSelected ? 'Selected' : 'Select'}
          </Text>
        </TouchableOpacity>
      );
    };

    return (
      <Modal visible={visible} animationType="slide" transparent onRequestClose={() => setVisible(false)}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <Text style={typography.h3}>Select Driver</Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchBar}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search Driver (e.g. NOR, HAM, VER)..."
                placeholderTextColor={colors.textMuted}
                value={query}
                onChangeText={setQuery}
                autoCapitalize="characters"
              />
              <Text>🔍</Text>
            </View>

            <TouchableOpacity
              style={styles.noneItem}
              onPress={() => {
                onSelectDriver('');
                setVisible(false);
              }}
            >
              <Text style={styles.noneText}>✕  None (clear this position)</Text>
            </TouchableOpacity>

            {isLoading ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.f1Red} />
                <Text style={styles.emptyText}>Loading grid…</Text>
              </View>
            ) : (
              <FlatList
                data={filtered}
                renderItem={renderItem}
                keyExtractor={(item) => item.driver_id}
                keyboardShouldPersistTaps="handled"
                style={styles.list}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>
                    {error ? 'Couldn’t load drivers. Check your connection.' : `No drivers match “${query}”.`}
                  </Text>
                }
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }
);

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    maxHeight: '85%',
    borderTopWidth: 1,
    borderColor: colors.borderColor,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', marginBottom: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  closeText: { ...typography.caption, color: colors.textSecondary, fontFamily: 'SpaceGrotesk-Bold' },
  list: { flexGrow: 0 },
  searchBar: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.borderColor,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  searchInput: { flex: 1, color: colors.textPrimary, fontFamily: 'Outfit-Regular' },
  noneItem: { paddingVertical: 12, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', marginBottom: 4 },
  noneText: { fontFamily: 'SpaceGrotesk-Bold', fontSize: 13, color: colors.textSecondary },
  center: { paddingVertical: 32, alignItems: 'center', gap: 8 },
  emptyText: { ...typography.caption, color: colors.textMuted, textAlign: 'center', paddingVertical: 20 },
  searchItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  searchItemSelected: { backgroundColor: 'rgba(225, 6, 0, 0.05)' },
  driverRow: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 },
  teamStripe: { width: 4, height: 20, borderRadius: 2 },
  driverName: { ...typography.body, flexShrink: 1 },
  teamName: { ...typography.caption, color: colors.textMuted },
  selectText: { ...typography.caption },
});

export default DriverSearchSheet;
