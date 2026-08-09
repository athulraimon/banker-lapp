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
import { useDrivers } from '../hooks/useDrivers';
import { Driver } from '../api/drivers';

interface DriverSearchSheetProps {
  onSelectDriver: (driverId: string) => void;
  selectedDrivers: string[];
}

export interface DriverSearchSheetRef {
  expand: () => void;
  close: () => void;
}

// Plain-Modal driver picker, styled to the vintage sheet: team-colour stripe,
// code, name and a right-aligned status. Mirrors the admin ResultPickerModal,
// which renders reliably where the earlier bottom-sheet did not.
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
          style={styles.row}
          onPress={() => {
            onSelectDriver(item.driver_id);
            setVisible(false);
          }}
          activeOpacity={0.75}
        >
          <View style={[styles.stripe, { backgroundColor: `#${item.team_color || '888888'}` }]} />
          <Text style={styles.code}>{item.driver_id}</Text>
          <Text style={styles.name} numberOfLines={1}>{item.broadcast_name}</Text>
          <Text style={[styles.right, isSelected && { color: colors.brass }]}>
            {isSelected ? 'Selected' : item.team_name}
          </Text>
        </TouchableOpacity>
      );
    };

    return (
      <Modal visible={visible} animationType="slide" transparent onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setVisible(false)} />
        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          pointerEvents="box-none"
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <Text style={styles.title}>Pick a driver</Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder="Search driver or code — VER, HAM…"
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="characters"
            />

            <TouchableOpacity
              style={styles.clearRow}
              onPress={() => {
                onSelectDriver('');
                setVisible(false);
              }}
            >
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
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(8,7,5,0.6)' },
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 20,
    maxHeight: '80%',
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontFamily: 'Jost-Bold', fontSize: 16, color: colors.textPrimary },
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
    paddingVertical: 11,
    color: colors.textPrimary,
    fontFamily: 'Karla-Regular',
    fontSize: 13.5,
    marginBottom: 10,
  },
  clearRow: { paddingVertical: 11, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: colors.borderColor, marginBottom: 4 },
  clearText: {
    fontFamily: 'Jost-SemiBold',
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  list: { flexGrow: 0 },
  center: { paddingVertical: 32, alignItems: 'center', gap: 8 },
  emptyText: { fontFamily: 'Karla-Regular', fontSize: 12, color: colors.textMuted, textAlign: 'center', paddingVertical: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderFaint,
  },
  stripe: { width: 4, height: 22, borderRadius: 2, flexShrink: 0 },
  code: { fontFamily: 'Jost-Bold', fontSize: 13, width: 42, color: colors.textPrimary },
  name: { fontFamily: 'Karla-Regular', fontSize: 13.5, color: colors.textPrimary, flex: 1 },
  right: { fontFamily: 'Karla-Regular', fontSize: 11.5, color: colors.textMuted },
});

export default DriverSearchSheet;
