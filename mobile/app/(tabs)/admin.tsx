import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { showAlert } from '../../src/components/AppDialog';
import { colors } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';
import { useAuthStore } from '../../src/store/useAuthStore';
import { racesApi, Race } from '../../src/api/races';
import { adminApi, AdminAccount, AdminPredictionView, ResultInput } from '../../src/api/admin';
import { useDrivers } from '../../src/hooks/useDrivers';
import ResultPickerModal from '../../src/components/ResultPickerModal';

type ModalState =
  | { mode: 'results'; race: Race; initial?: Partial<ResultInput> }
  | { mode: 'prediction'; race: Race; user: AdminPredictionView }
  | null;

export default function AdminScreen() {
  const { user, logout } = useAuthStore();
  const { byId: driversById } = useDrivers();
  const [races, setRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<AdminPredictionView[]>([]);
  const [predLoading, setPredLoading] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);

  const loadRaces = useCallback(() => {
    setLoading(true);
    racesApi
      .getRaces(2026)
      .then(setRaces)
      .catch((e) => showAlert('Error', e.response?.data?.error || 'Failed to load races'))
      .finally(() => setLoading(false));
  }, []);

  const loadAccounts = useCallback(() => {
    setAccountsLoading(true);
    adminApi
      .listAccounts()
      .then(setAccounts)
      .catch((e) => showAlert('Error', e.response?.data?.error || 'Failed to load accounts'))
      .finally(() => setAccountsLoading(false));
  }, []);

  useEffect(() => {
    if (user?.is_admin) {
      loadRaces();
      loadAccounts();
    }
  }, [user, loadRaces, loadAccounts]);

  if (!user?.is_admin) {
    return (
      <View style={styles.container}>
        <Text style={typography.h2}>Access Denied</Text>
        <Text style={typography.body}>You do not have permission to view this page.</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutBtnText}>Logout</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleSync = async () => {
    try {
      setBusy(true);
      const res = await adminApi.syncSchedule(2026);
      showAlert('Schedule synced', `${res.races} races loaded from Jolpica.`);
      loadRaces();
    } catch (e: any) {
      showAlert('Error', e.response?.data?.error || 'Failed to sync schedule');
    } finally {
      setBusy(false);
    }
  };

  const handleRecalculate = async (race: Race) => {
    try {
      setBusy(true);
      await adminApi.recalculateScores(race.id);
      showAlert('Done', 'Scores recalculated.');
    } catch (e: any) {
      showAlert('Error', e.response?.data?.error || 'Failed to recalculate');
    } finally {
      setBusy(false);
    }
  };

  // Open the results editor pre-filled with the race's current official result,
  // so the admin sees what was already entered.
  const handleOpenResults = async (race: Race) => {
    try {
      setBusy(true);
      const data = await racesApi.getRaceResults(race.id);
      const rr = data.race_result;
      const initial = rr
        ? {
            pole_driver_id: rr.pole_driver_id,
            p1_driver_id: rr.p1_driver_id,
            p2_driver_id: rr.p2_driver_id,
            p3_driver_id: rr.p3_driver_id,
          }
        : undefined;
      setModal({ mode: 'results', race, initial });
    } catch {
      setModal({ mode: 'results', race });
    } finally {
      setBusy(false);
    }
  };

  const handleClearResults = (race: Race) => {
    showAlert(
      'Clear results?',
      `This deletes the official result and all scores for ${race.grand_prix}. Predictions are kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              setBusy(true);
              await adminApi.clearResults(race.id);
              showAlert('Cleared', `${race.grand_prix} results removed.`);
              loadRaces();
            } catch (e: any) {
              showAlert('Error', e.response?.data?.error || 'Failed to clear results');
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const togglePredictions = async (race: Race) => {
    if (expanded === race.id) {
      setExpanded(null);
      return;
    }
    setExpanded(race.id);
    setPredLoading(true);
    try {
      setPredictions(await adminApi.listPredictions(race.id));
    } catch (e: any) {
      showAlert('Error', e.response?.data?.error || 'Failed to load predictions');
      setExpanded(null);
    } finally {
      setPredLoading(false);
    }
  };

  const submitModal = async (value: ResultInput) => {
    if (!modal) return;
    try {
      setBusy(true);
      if (modal.mode === 'results') {
        await adminApi.setResults(modal.race.id, value);
        showAlert('Saved', 'Results recorded and scores recalculated.');
        loadRaces();
      } else {
        await adminApi.upsertUserPrediction(modal.race.id, modal.user.user_id, value);
        showAlert('Saved', `${modal.user.display_name}'s prediction updated.`);
        setPredictions(await adminApi.listPredictions(modal.race.id));
      }
      setModal(null);
    } catch (e: any) {
      showAlert('Error', e.response?.data?.error || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  // Two steps, and the message names the player and what goes with them. This
  // also moves the championship: their points leave it when they do.
  const confirmDeleteAccount = (account: AdminAccount) => {
    showAlert(
      'Delete ' + account.display_name + '?',
      'Removes their account, ' +
        account.predictions +
        (account.predictions === 1 ? ' prediction' : ' predictions') +
        ' and ' +
        account.total_points +
        ' championship points. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: () => performDeleteAccount(account),
        },
      ]
    );
  };

  const performDeleteAccount = async (account: AdminAccount) => {
    try {
      setBusy(true);
      await adminApi.deleteAccount(account.user_id);
      showAlert('Account deleted', account.display_name + ' has been removed.');
      loadAccounts();
      // Their points are gone from the championship, so anything derived from
      // scores is now stale.
      loadRaces();
    } catch (e: any) {
      showAlert('Error', e.response?.data?.error || 'Failed to delete account');
    } finally {
      setBusy(false);
    }
  };

  const fmtPred = (p: AdminPredictionView['prediction']) => {
    if (!p) return 'No prediction';
    const name = (id: string) => driversById[id]?.driver_id || id || '—';
    return `Pole ${name(p.pole_driver_id)} · ${name(p.p1_driver_id)}/${name(p.p2_driver_id)}/${name(p.p3_driver_id)}`;
  };

  return (
    <View style={styles.container}>
      <Text style={typography.h2}>Admin Panel</Text>
      <Text style={styles.caption}>Signed in as {user.email}</Text>

      <TouchableOpacity style={[styles.syncBtn, busy && { opacity: 0.5 }]} onPress={handleSync} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.syncBtnText}>⟳ Sync F1 Schedule (Jolpica)</Text>}
      </TouchableOpacity>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading || accountsLoading}
            onRefresh={() => {
              loadRaces();
              loadAccounts();
            }}
            tintColor={colors.f1Red}
          />
        }
      >
        <View style={styles.section}>
          <Text style={typography.sectionHeaderCompact}>Race Management</Text>
          {races.length === 0 && !loading ? (
            <Text style={styles.emptyText}>No races yet. Tap “Sync F1 Schedule” to load the calendar.</Text>
          ) : (
            races.map((race) => (
              <View key={race.id} style={styles.adminCard}>
                <View style={styles.cardHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.raceName}>{race.grand_prix}</Text>
                    <Text style={styles.raceStatus}>{race.status} · {new Date(race.race_time).toLocaleDateString()}</Text>
                  </View>
                </View>
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, busy && { opacity: 0.5 }]}
                    onPress={() => handleOpenResults(race)}
                    disabled={busy}
                  >
                    <Text style={styles.actionBtnText}>Set Results</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, busy && { opacity: 0.5 }]}
                    onPress={() => handleRecalculate(race)}
                    disabled={busy}
                  >
                    <Text style={styles.actionBtnText}>Run Scoring</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => togglePredictions(race)}>
                    <Text style={styles.actionBtnText}>{expanded === race.id ? 'Hide' : 'Predictions'}</Text>
                  </TouchableOpacity>
                </View>

                {race.status === 'completed' && (
                  <TouchableOpacity
                    style={[styles.clearBtn, busy && { opacity: 0.5 }]}
                    onPress={() => handleClearResults(race)}
                    disabled={busy}
                  >
                    <Text style={styles.clearBtnText}>Clear Results</Text>
                  </TouchableOpacity>
                )}

                {expanded === race.id && (
                  <View style={styles.predBlock}>
                    {predLoading ? (
                      <ActivityIndicator color={colors.f1Red} style={{ marginVertical: 12 }} />
                    ) : predictions.length === 0 ? (
                      <Text style={styles.emptyText}>No registered users yet.</Text>
                    ) : (
                      predictions.map((pv) => (
                        <View key={pv.user_id} style={styles.predRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.predName}>{pv.display_name}</Text>
                            <Text style={styles.predDetail}>{fmtPred(pv.prediction)}</Text>
                          </View>
                          <TouchableOpacity style={styles.editBtn} onPress={() => setModal({ mode: 'prediction', race, user: pv })}>
                            <Text style={styles.editBtnText}>Edit</Text>
                          </TouchableOpacity>
                        </View>
                      ))
                    )}
                  </View>
                )}
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={typography.sectionHeaderCompact}>Accounts</Text>
          <Text style={styles.sectionNote}>
            Removing an account deletes its predictions and takes its points out of the
            championship. There is no undo.
          </Text>
          {accountsLoading && accounts.length === 0 ? (
            <ActivityIndicator color={colors.f1Red} style={{ marginVertical: 12 }} />
          ) : accounts.length === 0 ? (
            <Text style={styles.emptyText}>No registered players yet.</Text>
          ) : (
            accounts.map((account) => {
              const isSelf = account.user_id === user.id;
              return (
                <View key={account.user_id} style={styles.acctRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.acctNameRow}>
                      <Text style={styles.acctName} numberOfLines={1}>
                        {account.display_name}
                      </Text>
                      {account.is_admin && <Text style={styles.acctBadge}>Admin</Text>}
                    </View>
                    <Text style={styles.acctEmail} numberOfLines={1}>
                      {account.email}
                    </Text>
                    <Text style={styles.acctStats}>
                      {account.predictions}{' '}
                      {account.predictions === 1 ? 'prediction' : 'predictions'} ·{' '}
                      {account.total_points} pts
                    </Text>
                  </View>
                  {isSelf ? (
                    // The server refuses this anyway; saying why is friendlier than a
                    // button that always errors.
                    <Text style={styles.acctSelf}>You</Text>
                  ) : (
                    <TouchableOpacity
                      style={[styles.acctDeleteBtn, busy && { opacity: 0.5 }]}
                      onPress={() => confirmDeleteAccount(account)}
                      disabled={busy}
                    >
                      <Text style={styles.acctDeleteBtnText}>Delete</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutBtnText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>

      <ResultPickerModal
        visible={!!modal}
        submitting={busy}
        title={modal?.mode === 'results' ? 'Enter Official Results' : `Edit ${modal?.mode === 'prediction' ? modal.user.display_name : ''}'s Prediction`}
        subtitle={modal ? modal.race.grand_prix : undefined}
        initial={
          modal?.mode === 'results'
            ? modal.initial
            : modal?.mode === 'prediction' && modal.user.prediction
            ? {
                pole_driver_id: modal.user.prediction.pole_driver_id,
                p1_driver_id: modal.user.prediction.p1_driver_id,
                p2_driver_id: modal.user.prediction.p2_driver_id,
                p3_driver_id: modal.user.prediction.p3_driver_id,
              }
            : undefined
        }
        onCancel={() => setModal(null)}
        onSubmit={submitModal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionNote: {
    fontFamily: 'Karla-Regular',
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.textMuted,
    marginBottom: 10,
  },
  acctRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: 10,
    backgroundColor: colors.bgCard,
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  acctNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  acctName: {
    fontFamily: 'Jost-SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  acctBadge: {
    fontFamily: 'Jost-SemiBold',
    fontSize: 8.5,
    lineHeight: 12,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.brass,
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.45)',
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    overflow: 'hidden',
    flexShrink: 0,
  },
  acctEmail: {
    fontFamily: 'Karla-Regular',
    fontSize: 11,
    lineHeight: 16,
    color: colors.textSecondary,
    marginTop: 1,
  },
  acctStats: {
    fontFamily: 'Karla-Regular',
    fontSize: 10.5,
    lineHeight: 15,
    color: colors.textMuted,
    marginTop: 1,
  },
  acctSelf: {
    fontFamily: 'Jost-SemiBold',
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
    flexShrink: 0,
  },
  acctDeleteBtn: {
    borderWidth: 1,
    borderColor: 'rgba(168,41,28,0.6)',
    backgroundColor: 'rgba(168,41,28,0.10)',
    borderRadius: 7,
    paddingVertical: 8,
    paddingHorizontal: 13,
    flexShrink: 0,
  },
  acctDeleteBtnText: {
    fontFamily: 'Jost-SemiBold',
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.redText,
  },
  container: { flex: 1, padding: 16, paddingTop: 48, backgroundColor: colors.bgCarbon },
  caption: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  syncBtn: { backgroundColor: colors.f1Red, borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  syncBtnText: { fontFamily: 'SpaceGrotesk-Bold', fontSize: 14, color: '#fff' },
  section: { marginTop: 24, marginBottom: 32 },
  emptyText: { ...typography.body, color: colors.textMuted, fontStyle: 'italic', marginTop: 8 },
  adminCard: { backgroundColor: colors.bgCard, borderRadius: 8, padding: 16, borderWidth: 1, borderColor: colors.borderColor, marginBottom: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center' },
  raceName: { ...typography.h3, fontSize: 16 },
  raceStatus: { ...typography.caption, marginTop: 2, textTransform: 'uppercase' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 12 },
  actionBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', paddingVertical: 10, borderRadius: 6, alignItems: 'center' },
  actionBtnText: { fontFamily: 'SpaceGrotesk-Bold', fontSize: 11, color: colors.textPrimary },
  predBlock: { marginTop: 14, borderTopWidth: 1, borderTopColor: colors.borderColor, paddingTop: 10 },
  predRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  predName: { ...typography.body, fontFamily: 'SpaceGrotesk-Bold', fontSize: 14 },
  predDetail: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  clearBtn: { marginTop: 10, borderWidth: 1, borderColor: 'rgba(225,6,0,0.5)', paddingVertical: 10, borderRadius: 6, alignItems: 'center' },
  clearBtnText: { fontFamily: 'SpaceGrotesk-Bold', fontSize: 12, color: colors.f1Red },
  editBtn: { backgroundColor: 'rgba(225,6,0,0.15)', borderWidth: 1, borderColor: 'rgba(225,6,0,0.5)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6 },
  editBtnText: { fontFamily: 'SpaceGrotesk-Bold', fontSize: 12, color: colors.textPrimary },
  logoutBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.borderColor, padding: 14, borderRadius: 8, alignItems: 'center', marginBottom: 40 },
  logoutBtnText: { fontFamily: 'SpaceGrotesk-Bold', fontSize: 14, color: colors.textPrimary },
});
