import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { setConfirmListener, type ConfirmRequest } from './confirm';
import { radius, space, useTheme } from './theme';
import { Button, Muted } from './ui';

/** Renders confirmation dialogs requested through confirm() on web. */
export function ConfirmHost() {
  const t = useTheme();
  const [req, setReq] = useState<ConfirmRequest | null>(null);

  useEffect(() => {
    setConfirmListener((r) => {
      // A new request replaces any open one; the old one counts as cancelled.
      setReq((prev) => {
        prev?.resolve(false);
        return r;
      });
    });
    return () => setConfirmListener(null);
  }, []);

  const answer = (ok: boolean) => {
    req?.resolve(ok);
    setReq(null);
  };

  return (
    <Modal visible={req !== null} transparent animationType="fade" onRequestClose={() => answer(false)}>
      <Pressable style={styles.backdrop} onPress={() => answer(false)} accessibilityLabel="Cancelar">
        <Pressable
          style={[styles.dialog, { backgroundColor: t.card, borderColor: t.border }]}
          onPress={() => undefined}
          accessibilityRole="alert"
        >
          <Text style={[styles.title, { color: t.text }]}>{req?.title}</Text>
          <Muted>{req?.message}</Muted>
          <View style={styles.row}>
            <Button testID="confirm-cancel" title="Cancelar" kind="ghost" onPress={() => answer(false)} />
            <Button
              testID="confirm-ok"
              title={req?.confirmLabel ?? 'Aceptar'}
              kind={req?.destructive ? 'danger' : 'primary'}
              onPress={() => answer(true)}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: space.lg },
  dialog: { width: '100%', maxWidth: 420, borderRadius: radius, borderWidth: 1, padding: space.lg, gap: space.md },
  title: { fontSize: 18, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm, flexWrap: 'wrap' },
});
