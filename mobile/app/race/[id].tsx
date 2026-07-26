import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { showAlert } from '../../src/components/AppDialog';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { colors } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';
import { racesApi, Race } from '../../src/api/races';
import { predictionsApi, Prediction } from '../../src/api/predictions';
import DriverSearchSheet, { DriverSearchSheetRef } from '../../src/components/DriverSearchSheet';
import LoadingScreen from '../../src/components/LoadingScreen';
import { useDrivers } from '../../src/hooks/useDrivers';

export default function PredictionEditorScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { byId: driversById } = useDrivers();
  const [race, setRace] = useState<Race | null>(null);
  const [prediction, setPrediction] = useState<Prediction>({
    race_id: id as string,
    pole_driver_id: '',
    p1_driver_id: '',
    p2_driver_id: '',
    p3_driver_id: ''
  });
  
  // Which slot is currently being edited
  const [activeSlot, setActiveSlot] = useState<'pole' | 'p1' | 'p2' | 'p3' | null>(null);
  
  const bottomSheetRef = useRef<DriverSearchSheetRef>(null);

  useEffect(() => {
    if (id) {
      racesApi.getRace(id as string).then(race => {
        setRace(race);
        if (race.status === 'completed') {
          router.replace(`/race/${id}/results`);
        }
      }).catch(console.error);
      predictionsApi.getPrediction(id as string).then(pred => {
        if (pred) setPrediction(pred);
      }).catch(console.error);
    }
  }, [id]);

  const handleSave = async () => {
    try {
      await predictionsApi.submitPrediction(prediction);
      showAlert('Success', 'Predictions saved successfully');
      router.back();
    } catch (e: any) {
      showAlert('Error', e.response?.data?.error || 'Failed to save predictions');
    }
  };

  const openDriverSearch = (slot: 'pole' | 'p1' | 'p2' | 'p3') => {
    setActiveSlot(slot);
    bottomSheetRef.current?.expand();
  };

  const onSelectDriver = (driverId: string) => {
    if (activeSlot) {
      setPrediction(prev => ({ ...prev, [`${activeSlot}_driver_id`]: driverId }));
    }
    bottomSheetRef.current?.close();
  };

  const renderSlot = (slot: 'pole' | 'p1' | 'p2' | 'p3', label: string, color: string) => {
    const driverId = prediction[`${slot}_driver_id` as keyof Prediction] as string;
    const driver = driverId ? driversById[driverId] : undefined;
    const locked = race?.status === 'locked' || race?.status === 'completed';
    return (
      <View style={[styles.predictionSlot, slot === 'pole' ? styles.poleSlot : null, slot === 'p1' ? styles.p1Slot : null]}>
        <View style={styles.slotTag}>
          <Text style={[styles.slotTagText, { color }]}>{label}</Text>
        </View>
        <TouchableOpacity
          style={styles.slotInputTrigger}
          onPress={() => openDriverSearch(slot)}
          disabled={locked}
        >
          {driverId ? (
            <>
              <Text style={styles.driverName}>
                {driver ? `${driverId} · ${driver.broadcast_name}` : driverId}
              </Text>
              <View style={[styles.driverTeamPill, driver?.team_color ? { backgroundColor: `#${driver.team_color}` } : null]}>
                <Text style={styles.driverTeamText}>{driver?.team_name ?? 'TEAM'}</Text>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.placeholder}>Select {label} Driver...</Text>
              <Text>⚡</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  if (!race) return <LoadingScreen label="Loading race…" />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.appTitle}>Edit Predictions</Text>
          {race.status === 'locked' && <Text style={styles.lockedWarning}>LOCKED</Text>}
        </View>

        <View style={styles.content}>
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.raceTitle}>{race.grand_prix.toUpperCase()} GRID</Text>
            <Text style={styles.raceSubtitle}>Submit positions. Driver duplication drops validation errors.</Text>
          </View>

          <Text style={typography.sectionHeaderCompact}>Qualifying Performance</Text>
          {renderSlot('pole', 'POLE', colors.accentGold)}

          <Text style={typography.sectionHeaderCompact}>Podium Grid Lineup</Text>
          {renderSlot('p1', 'P1', colors.f1Red)}
          {renderSlot('p2', 'P2', colors.textSecondary)}
          {renderSlot('p3', 'P3', colors.textSecondary)}

          <TouchableOpacity 
            style={[styles.btn, race.status === 'locked' && { opacity: 0.5 }]} 
            onPress={handleSave}
            disabled={race.status === 'locked'}
          >
            <Text style={styles.btnText}>Save Submissions</Text>
          </TouchableOpacity>
        </View>
        
        <DriverSearchSheet 
          ref={bottomSheetRef} 
          onSelectDriver={onSelectDriver}
          selectedDrivers={[prediction.pole_driver_id, prediction.p1_driver_id, prediction.p2_driver_id, prediction.p3_driver_id]}
        />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgCarbon,
  },
  header: {
    height: 56,
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderColor,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 48,
  },
  appTitle: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 18,
    color: colors.textPrimary,
  },
  lockedWarning: {
    fontSize: 12,
    color: colors.statusLocked,
    fontFamily: 'SpaceGrotesk-Bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  raceTitle: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 18,
    color: colors.textPrimary,
  },
  raceSubtitle: {
    ...typography.caption,
    marginTop: 4,
  },
  predictionSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
  },
  poleSlot: {
    borderColor: 'rgba(255, 183, 3, 0.3)',
  },
  p1Slot: {
    borderColor: 'rgba(225, 6, 0, 0.3)',
  },
  slotTag: {
    width: 60,
    backgroundColor: colors.bgCardHeader,
    borderRightWidth: 1,
    borderRightColor: colors.borderColor,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotTagText: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 14,
  },
  slotInputTrigger: {
    flex: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  driverName: {
    ...typography.body,
  },
  placeholder: {
    ...typography.body,
    color: colors.textMuted,
  },
  driverTeamPill: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  driverTeamText: {
    fontSize: 10,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  btn: {
    backgroundColor: colors.f1Red,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 15,
  },
  btnText: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 16,
    color: colors.textPrimary,
    textTransform: 'uppercase',
  }
});
