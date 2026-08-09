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

// Full-screen, top-anchored driver picker. The search field is pinned at the
// top and the results fill the space below with flex:1, so the list stays put
// and readable as it shortens — unlike a bottom sheet that collapses toward the
// keyboard as results are filtered out.
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
      <Modal
        visible={visible}
        animationType="slide"
        onRequestClose={() => setVisible(false)}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Pick a driver</Text>
            <TouchableOpacity onPress={() => setVisible(false)} hitSlop={10}>
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
            autoCorrect={false}
            autoFocus
            returnKeyType="search"
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
              keyboardDismissMode="on-drag"
              style={styles.list}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  {error ? 'Couldn’t load drivers. Check your connection.' : `No drivers match “${query}”.`}
                </Text>
              }
            />
          )}
        </KeyboardAvoidingView>
      </Modal>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPhone,
    paddingHorizontal: 16,
    paddingTop: 54,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title: { fontFamily: 'Jost-Bold', fontSize: 20, color: colors.textPrimary },
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
  // flex:1 fixes the list to the space below the search field, so filtering
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
  code: { fontFamily: 'Jost-Bold', fontSize: 13, width: 42, color: colors.textPrimary },
  name: { fontFamily: 'Karla-Regular', fontSize: 14, color: colors.textPrimary, flex: 1 },
  right: { fontFamily: 'Karla-Regular', fontSize: 11.5, color: colors.textMuted },
});

export default DriverSearchSheet;
