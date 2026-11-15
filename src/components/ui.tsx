import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { radius, space, useTheme } from './theme';

export function Screen({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  const t = useTheme();
  if (!scroll) return <View style={[styles.screen, { backgroundColor: t.bg }]}>{children}</View>;
  return (
    <ScrollView
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }, style]}>{children}</View>;
}

export function H1({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <Text accessibilityRole="header" style={[styles.h1, { color: t.text }]}>
      {children}
    </Text>
  );
}

export function H2({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <Text accessibilityRole="header" style={[styles.h2, { color: t.text }]}>
      {children}
    </Text>
  );
}

export function Body({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <Text style={[styles.body, { color: t.text }, style]}>{children}</Text>;
}

export function Muted({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <Text style={[styles.muted, { color: t.muted }, style]}>{children}</Text>;
}

type ButtonKind = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  title,
  onPress,
  kind = 'primary',
  disabled,
  busy,
  small,
  accessibilityLabel,
  testID,
}: {
  title: string;
  onPress: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  busy?: boolean;
  small?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.primary : kind === 'danger' ? t.danger : 'transparent';
  const fg = kind === 'primary' ? t.primaryText : kind === 'danger' ? '#FFFFFF' : t.primary;
  const border = kind === 'secondary' ? t.primary : 'transparent';
  const isDisabled = disabled || busy;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!isDisabled, busy: !!busy }}
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg, borderColor: border, opacity: isDisabled ? 0.5 : pressed ? 0.8 : 1 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.buttonText, small && styles.buttonTextSmall, { color: fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  error,
  placeholder,
  keyboardType,
  multiline,
  testID,
  maxLength,
  style,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  error?: string | null;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  testID?: string;
  maxLength?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <View style={[styles.field, style]}>
      <Text style={[styles.label, { color: t.muted }]}>{label}</Text>
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.muted}
        keyboardType={keyboardType}
        multiline={multiline}
        maxLength={maxLength}
        style={[
          styles.input,
          multiline && { minHeight: 80, textAlignVertical: 'top' },
          { color: t.text, borderColor: error ? t.danger : t.border, backgroundColor: t.card },
        ]}
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" style={[styles.error, { color: t.danger }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  testID,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
  /** Each option gets `${testID}-${value}`. */
  testID?: string;
}) {
  const t = useTheme();
  return (
    <View style={styles.field}>
      {label ? <Text style={[styles.label, { color: t.muted }]}>{label}</Text> : null}
      <View style={[styles.segment, { borderColor: t.border }]} accessibilityRole="radiogroup">
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              testID={testID ? `${testID}-${o.value}` : undefined}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={label ? `${label}: ${o.label}` : o.label}
              onPress={() => onChange(o.value)}
              style={[styles.segmentItem, selected && { backgroundColor: t.primary }]}
            >
              <Text style={{ color: selected ? t.primaryText : t.text, fontWeight: selected ? '600' : '400' }}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function Divider() {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.border, marginVertical: space.sm }} />;
}

const styles = StyleSheet.create({
  screen: { padding: space.lg, gap: space.md, paddingBottom: 48 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius, padding: space.lg, gap: space.sm },
  h1: { fontSize: 24, fontWeight: '700' },
  h2: { fontSize: 18, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22 },
  muted: { fontSize: 14, lineHeight: 20 },
  button: {
    minHeight: 44,
    paddingHorizontal: space.lg,
    borderRadius: radius,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSmall: { minHeight: 36, paddingHorizontal: space.md },
  buttonText: { fontSize: 16, fontWeight: '600' },
  buttonTextSmall: { fontSize: 14 },
  field: { gap: space.xs },
  label: { fontSize: 13, fontWeight: '500' },
  input: { borderWidth: 1, borderRadius: radius, paddingHorizontal: space.md, paddingVertical: 10, fontSize: 16 },
  error: { fontSize: 13 },
  segment: { flexDirection: 'row', borderWidth: 1, borderRadius: radius, overflow: 'hidden' },
  segmentItem: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
});
