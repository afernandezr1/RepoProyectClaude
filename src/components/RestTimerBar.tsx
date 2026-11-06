import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, Vibration, View } from 'react-native';
import {
  adjustTimer,
  isActive,
  isFinished,
  isRunning,
  pauseTimer,
  progress,
  remainingMs,
  resumeTimer,
  type RestTimer,
} from '../domain/timer';
import { formatSeconds } from '../domain/units';
import { radius, space, useTheme } from './theme';
import { Button, Row } from './ui';

export function RestTimerBar({
  timer,
  onChange,
  onDismiss,
}: {
  timer: RestTimer;
  onChange: (t: RestTimer) => void;
  onDismiss: () => void;
}) {
  const t = useTheme();
  const [now, setNow] = useState(() => Date.now());
  const notified = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive(timer)) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [timer]);

  const done = isFinished(timer, now);
  useEffect(() => {
    if (done && notified.current !== timer.endsAt) {
      notified.current = timer.endsAt;
      try {
        Vibration.vibrate(400);
      } catch {
        // vibration unsupported (web) — the on-screen message is enough
      }
    }
  }, [done, timer.endsAt]);

  if (!isActive(timer)) return null;
  const running = isRunning(timer, now);
  const pct = Math.min(1, Math.max(0, progress(timer, now)));

  return (
    <View
      style={[styles.bar, { backgroundColor: t.card, borderColor: t.border }]}
      accessibilityLabel={done ? 'Rest finished' : `Rest timer, ${formatSeconds(remainingMs(timer, now) / 1000)} remaining`}
      accessibilityLiveRegion="polite"
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={[styles.time, { color: t.text }]}>
          {done ? 'Rest done' : `Rest ${formatSeconds(remainingMs(timer, now) / 1000)}`}
        </Text>
        <Row>
          {!done ? (
            <>
              <Button small kind="ghost" title="−15s" onPress={() => onChange(adjustTimer(timer, -15, Date.now()))} />
              <Button small kind="ghost" title="+15s" onPress={() => onChange(adjustTimer(timer, 15, Date.now()))} />
              <Button
                small
                kind="secondary"
                title={running ? 'Pause' : 'Resume'}
                onPress={() => onChange(running ? pauseTimer(timer, Date.now()) : resumeTimer(timer, Date.now()))}
              />
            </>
          ) : null}
          <Button small kind={done ? 'primary' : 'ghost'} title={done ? 'OK' : 'Skip'} onPress={onDismiss} />
        </Row>
      </Row>
      <View style={[styles.track, { backgroundColor: t.barMuted }]}>
        <View style={[styles.fill, { backgroundColor: t.bar, width: `${pct * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderWidth: 1, borderRadius: radius, padding: space.md, gap: space.sm },
  time: { fontSize: 20, fontWeight: '600', fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6 },
});
