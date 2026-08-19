import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme/colors';
import { useAuthStore } from '../../src/store/useAuthStore';
import { authApi } from '../../src/api/auth';
import { showAlert } from '../../src/components/AppDialog';
import FadeInView from '../../src/components/anim/FadeInView';
import PressableScale from '../../src/components/anim/PressableScale';
import PixelCar from '../../src/components/PixelCar';

// Matches the server's bounds (service.DisplayNameMinLen / MaxLen). Enforced here
// too so a bad name is caught before a round trip, but the server is the one that
// actually decides.
const NAME_MIN = 2;
const NAME_MAX = 32;

export default function ProfileScreen() {
  const { user, setUser, logout } = useAuthStore();
  const router = useRouter();
  const [name, setName] = useState(user?.display_name ?? '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const trimmed = name.trim();
  const dirty = trimmed !== (user?.display_name ?? '');
  const valid = trimmed.length >= NAME_MIN && trimmed.length <= NAME_MAX;
  const canSave = dirty && valid && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const updated = await authApi.updateDisplayName(trimmed);
      setUser(updated);
      setName(updated.display_name);
      showAlert('Name updated', 'The championship will show ' + updated.display_name + '.');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Could not update your name. Check your connection and try again.';
      showAlert('Update failed', message);
    } finally {
      setSaving(false);
    }
  };

  // Two steps on purpose. This wipes the account's predictions and points along
  // with the login, and there is no undo on the server, so it should not be one
  // stray tap away.
  const confirmDelete = () => {
    showAlert(
      'Delete your account?',
      'This removes your account, every prediction you have made and all your championship points. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete everything', style: 'destructive', onPress: reallyDelete },
      ]
    );
  };

  const reallyDelete = async () => {
    setDeleting(true);
    try {
      await authApi.deleteAccount();
      // Clear the local session before routing, or the root layout bounces the
      // user straight back into the tabs with a token the server has revoked.
      logout();
      router.replace('/(auth)/login');
    } catch {
      setDeleting(false);
      showAlert('Delete failed', 'Your account was not deleted. Please try again.');
    }
  };

  if (!user) return null;

  const initial = (user.display_name || user.email || '?').trim().charAt(0).toUpperCase();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Your name as everyone else sees it on the championship.</Text>

        {/* Identity card */}
        <FadeInView>
          <View style={styles.card}>
            <View style={styles.identity}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.identityName} numberOfLines={1}>
                  {user.display_name}
                </Text>
                <Text style={styles.identityEmail} numberOfLines={1}>
                  {user.email}
                </Text>
              </View>
              {user.is_admin && <Text style={styles.adminBadge}>Admin</Text>}
            </View>
            <PixelCar cell={2} style={styles.mark} />
          </View>
        </FadeInView>

        {/* Shortcut to their own season */}
        <Text style={styles.sectionHeader}>Season</Text>
        <FadeInView offsetY={8}>
          <PressableScale
            style={styles.linkRow}
            scaleTo={0.99}
            onPress={() => router.push('/player/' + user.id)}
          >
            <Ionicons name="stats-chart" size={17} color={colors.brass} />
            <Text style={styles.linkText}>View my season and every call I made</Text>
            <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
          </PressableScale>
        </FadeInView>

        {/* Rename */}
        <Text style={styles.sectionHeader}>Display name</Text>
        <FadeInView offsetY={8}>
          <View style={styles.card}>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={colors.textMuted}
              maxLength={NAME_MAX}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={save}
              editable={!saving && !deleting}
            />
            <View style={styles.inputFooter}>
              <Text style={styles.counter}>
                {trimmed.length}/{NAME_MAX}
              </Text>
              <TouchableOpacity
                style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
                onPress={save}
                disabled={!canSave}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color={colors.oxbloodFg} size="small" />
                ) : (
                  <Text style={[styles.saveBtnText, !canSave && styles.saveBtnTextDisabled]}>
                    Save
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </FadeInView>
        <Text style={styles.footnote}>
          {trimmed.length > 0 && trimmed.length < NAME_MIN
            ? 'Names need at least ' + NAME_MIN + ' characters.'
            : 'Between ' + NAME_MIN + ' and ' + NAME_MAX + ' characters. Signing in again will not overwrite it.'}
        </Text>

        {/* Account actions, stacked. Delete is styled as the destructive one and
            sits last, so the harmless action is the one under your thumb. */}
        <Text style={styles.sectionHeader}>Account</Text>
        <FadeInView offsetY={8}>
          <TouchableOpacity
            style={styles.actionRow}
            onPress={logout}
            disabled={deleting}
            activeOpacity={0.85}
          >
            <Ionicons name="log-out-outline" size={17} color={colors.textSecondary} />
            <Text style={styles.linkText}>Sign out</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionRow, styles.actionRowDanger]}
            onPress={confirmDelete}
            disabled={deleting}
            activeOpacity={0.85}
          >
            <Ionicons name="trash-outline" size={17} color={colors.redText} />
            <Text style={[styles.linkText, { color: colors.redText }]}>Delete account</Text>
            {deleting && <ActivityIndicator color={colors.redText} size="small" />}
          </TouchableOpacity>
        </FadeInView>
        <Text style={styles.footnote}>
          Deleting removes your account, every prediction you have made and all your championship
          points. It cannot be undone.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgCarbon },
  inner: { padding: 20, paddingTop: 64, paddingBottom: 40 },
  title: { fontFamily: 'Jost-Bold', fontSize: 26, lineHeight: 34, color: colors.textPrimary },
  subtitle: {
    fontFamily: 'Karla-Regular',
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.textSecondary,
    marginTop: 6,
    marginBottom: 22,
  },

  card: {
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: 12,
    backgroundColor: colors.bgCard,
    padding: 14,
    overflow: 'hidden',
  },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.oxblood,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontFamily: 'Jost-Bold',
    fontSize: 19,
    lineHeight: 25,
    color: colors.oxbloodFg,
  },
  identityName: {
    fontFamily: 'Jost-Bold',
    fontSize: 17,
    lineHeight: 23,
    color: colors.textPrimary,
  },
  identityEmail: {
    fontFamily: 'Karla-Regular',
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
    marginTop: 1,
  },
  adminBadge: {
    fontFamily: 'Jost-SemiBold',
    fontSize: 9.5,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.brass,
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.45)',
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    overflow: 'hidden',
    flexShrink: 0,
  },
  // Sits low and faint so the mark decorates the card without competing with the
  // name above it.
  mark: { alignSelf: 'flex-end', opacity: 0.5, marginTop: 10, marginRight: -4 },

  sectionHeader: {
    fontFamily: 'Jost-SemiBold',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    marginTop: 26,
    marginBottom: 10,
  },

  input: {
    fontFamily: 'Jost-SemiBold',
    fontSize: 16,
    lineHeight: 22,
    color: colors.textPrimary,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  inputFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  counter: {
    fontFamily: 'Karla-Regular',
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  saveBtn: {
    backgroundColor: colors.oxblood,
    borderRadius: 7,
    paddingVertical: 9,
    paddingHorizontal: 20,
    minWidth: 84,
    alignItems: 'center',
  },
  saveBtnDisabled: { backgroundColor: colors.surfaceAlt },
  saveBtnText: {
    fontFamily: 'Jost-SemiBold',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.oxbloodFg,
  },
  saveBtnTextDisabled: { color: colors.textMuted },
  footnote: {
    fontFamily: 'Karla-Regular',
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.textMuted,
    marginTop: 10,
  },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: 10,
    backgroundColor: colors.bgCard,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  linkText: {
    flex: 1,
    fontFamily: 'Jost-SemiBold',
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.textPrimary,
  },

  // Same shape as linkRow so the two account actions read as one stacked pair;
  // only the colour tells them apart.
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: 10,
    backgroundColor: colors.bgCard,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  actionRowDanger: {
    borderColor: 'rgba(168,41,28,0.5)',
    backgroundColor: 'rgba(168,41,28,0.08)',
    marginBottom: 0,
  },
});
