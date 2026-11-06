import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { space, useTheme } from './theme';

/** Minimal accessible bar chart built from Views (no chart dependency). */
export function Bars({
  data,
  format = (v) => String(v),
  height = 90,
  label,
}: {
  data: { label: string; value: number | null }[];
  format?: (v: number) => string;
  height?: number;
  label: string;
}) {
  const t = useTheme();
  const max = Math.max(0, ...data.map((d) => d.value ?? 0));
  const summary = data.map((d) => `${d.label}: ${d.value == null ? 'no entries' : format(d.value)}`).join(', ');
  return (
    <View accessible accessibilityLabel={`${label}. ${summary}`}>
      <View style={[styles.row, { height }]}>
        {data.map((d, i) => {
          const h = max > 0 && d.value ? Math.max(3, (d.value / max) * (height - 18)) : 3;
          return (
            <View key={`${d.label}-${i}`} style={styles.col}>
              <Text style={[styles.value, { color: t.muted }]} numberOfLines={1}>
                {d.value == null || d.value === 0 ? '' : format(d.value)}
              </Text>
              <View style={{ height: h, backgroundColor: d.value ? t.bar : t.barMuted, borderRadius: 3, width: '70%' }} />
            </View>
          );
        })}
      </View>
      <View style={styles.row}>
        {data.map((d, i) => (
          <Text key={`l-${i}`} style={[styles.label, { color: t.muted }]} numberOfLines={1}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: space.xs },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  value: { fontSize: 10, marginBottom: 2 },
  label: { flex: 1, fontSize: 10, textAlign: 'center', marginTop: 2 },
});
