import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

// App-themed replacement for React Native's Alert. Same call shape:
//   showAlert('Title', 'Message', [{ text, onPress, style }])
export type DialogButtonStyle = 'default' | 'cancel' | 'destructive';
export interface DialogButton {
  text: string;
  onPress?: () => void;
  style?: DialogButtonStyle;
}
type DialogState = { title: string; message?: string; buttons: DialogButton[] } | null;

let emit: ((s: DialogState) => void) | null = null;

export function showAlert(title: string, message?: string, buttons?: DialogButton[]) {
  const btns = buttons && buttons.length ? buttons : [{ text: 'OK' }];
  emit?.({ title, message, buttons: btns });
}

// Mounted once at the app root so showAlert() works from anywhere.
export function DialogHost() {
  const [state, setState] = useState<DialogState>(null);

  useEffect(() => {
    emit = setState;
    return () => {
      emit = null;
    };
  }, []);

  const close = () => setState(null);
  const handle = (b: DialogButton) => {
    close();
    b.onPress?.();
  };

  const buttons = state?.buttons ?? [];
  const stacked = buttons.length > 2;

  return (
    <Modal visible={!!state} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {!!state?.title && <Text style={styles.title}>{state.title}</Text>}
          {!!state?.message && <Text style={styles.message}>{state.message}</Text>}

          <View style={[styles.buttons, stacked && styles.buttonsStacked]}>
            {buttons.map((b, i) => {
              const isCancel = b.style === 'cancel';
              const isDestructive = b.style === 'destructive';
              return (
                <TouchableOpacity
                  key={`${b.text}-${i}`}
                  style={[
                    styles.btn,
                    stacked && styles.btnStacked,
                    isCancel && styles.btnCancel,
                    isDestructive && styles.btnDestructive,
                    !isCancel && !isDestructive && styles.btnPrimary,
                  ]}
                  onPress={() => handle(b)}
                >
                  <Text
                    style={[
                      styles.btnText,
                      isCancel && styles.btnTextCancel,
                      isDestructive && styles.btnTextDestructive,
                      !isCancel && !isDestructive && styles.btnTextPrimary,
                    ]}
                  >
                    {b.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderColor,
    padding: 22,
  },
  title: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 18,
    color: colors.textPrimary,
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 10,
    lineHeight: 21,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 22,
  },
  buttonsStacked: {
    flexDirection: 'column-reverse',
  },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  btnStacked: {
    width: '100%',
  },
  btnPrimary: {
    backgroundColor: colors.f1Red,
  },
  btnCancel: {
    borderWidth: 1,
    borderColor: colors.borderColor,
  },
  btnDestructive: {
    borderWidth: 1,
    borderColor: 'rgba(225,6,0,0.6)',
    backgroundColor: 'rgba(225,6,0,0.12)',
  },
  btnText: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 14,
  },
  btnTextPrimary: {
    color: '#fff',
  },
  btnTextCancel: {
    color: colors.textSecondary,
  },
  btnTextDestructive: {
    color: colors.f1Red,
  },
});
