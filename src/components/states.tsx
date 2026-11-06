/**
 * Shared empty / loading / success / recoverable-error states so every
 * screen communicates the same way.
 */
import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, space, useTheme } from './theme';
import { Button, Muted } from './ui';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  const t = useTheme();
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color={t.primary} size="large" />
      <Muted>{label}</Muted>
    </View>
  );
}

export function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const t = useTheme();
  return (
    <View style={[styles.box, { borderColor: t.border }]}>
      <Text style={[styles.title, { color: t.text }]}>{title}</Text>
      {body ? <Muted style={{ textAlign: 'center' }}>{body}</Muted> : null}
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} kind="secondary" /> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useTheme();
  return (
    <View style={[styles.box, { borderColor: t.danger, backgroundColor: t.errorBg }]} accessibilityRole="alert">
      <Text style={[styles.title, { color: t.text }]}>Something went wrong</Text>
      <Muted style={{ textAlign: 'center' }}>{message}</Muted>
      <Muted style={{ textAlign: 'center' }}>Your saved data is unchanged.</Muted>
      {onRetry ? <Button title="Try again" onPress={onRetry} kind="secondary" /> : null}
    </View>
  );
}

export type BannerKind = 'success' | 'error' | 'info';
export interface BannerMessage {
  kind: BannerKind;
  text: string;
}

/** Inline status message. Success/info auto-dismiss; errors stay until dismissed. */
export function Banner({ message, onDismiss }: { message: BannerMessage | null; onDismiss: () => void }) {
  const t = useTheme();
  useEffect(() => {
    if (!message || message.kind === 'error') return;
    const id = setTimeout(onDismiss, 4000);
    return () => clearTimeout(id);
  }, [message, onDismiss]);
  if (!message) return null;
  const bg = message.kind === 'success' ? t.successBg : message.kind === 'error' ? t.errorBg : t.infoBg;
  return (
    <Pressable
      onPress={onDismiss}
      accessibilityRole="alert"
      accessibilityLabel={`${message.text}. Tap to dismiss.`}
      style={[styles.banner, { backgroundColor: bg }]}
    >
      <Text style={{ color: t.text, flex: 1 }}>{message.text}</Text>
      <Text style={{ color: t.muted }}>✕</Text>
    </Pressable>
  );
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === 'string') return e;
  return 'An unexpected error occurred.';
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl, flex: 1 },
  box: {
    alignItems: 'center',
    gap: space.sm,
    padding: space.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius,
  },
  title: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
  banner: { flexDirection: 'row', gap: space.sm, padding: space.md, borderRadius: radius, alignItems: 'center' },
});
