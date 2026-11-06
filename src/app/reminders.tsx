import React, { useState } from 'react';
import { Switch } from 'react-native';
import { confirm } from '../components/confirm';
import { Banner, EmptyState, ErrorState, LoadingState, errorMessage, type BannerMessage } from '../components/states';
import { useTheme } from '../components/theme';
import { Body, Button, Card, Field, H2, Muted, Row, Screen } from '../components/ui';
import { WEEKDAY_SHORT } from '../domain/dates';
import type { Reminder, Weekday } from '../domain/types';
import { validateReminder } from '../domain/validation';
import { syncReminders, type ReminderSyncResult } from '../services/notifications';
import { useApp, useLoad } from '../state/AppContext';

const pad = (n: number) => n.toString().padStart(2, '0');

function describeSync(r: ReminderSyncResult): BannerMessage {
  switch (r.status) {
    case 'scheduled':
      return { kind: 'success', text: r.count === 0 ? 'Saved. No active reminders.' : `Saved. ${r.count} weekly reminder${r.count === 1 ? '' : 's'} scheduled.` };
    case 'muted':
      return { kind: 'info', text: 'Saved. Reminders are muted, so none will appear until you unmute them in Settings.' };
    case 'denied':
      return { kind: 'info', text: 'Saved, but notifications are off for this app. You can allow them in system settings.' };
    default:
      return { kind: 'info', text: `Saved. ${r.reason}` };
  }
}

export default function Reminders() {
  const { store, settings, bump } = useApp();
  const t = useTheme();
  const { state, retry } = useLoad((s) => s.listReminders());
  const [label, setLabel] = useState('Time to move, if you feel like it');
  const [time, setTime] = useState('18:00');
  const [days, setDays] = useState<Weekday[]>([0, 2, 4]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<BannerMessage | null>(null);
  const [busy, setBusy] = useState(false);

  const resync = async (askPermission: boolean) => {
    const r = await syncReminders(await store.listReminders(), settings.remindersMuted, { askPermission });
    setMsg(describeSync(r));
  };

  const add = async () => {
    const v = validateReminder({ label, time, weekdays: days });
    if (!v.ok) return setError(v.error);
    setError(null);
    setBusy(true);
    try {
      await store.saveReminder({ ...v.value, enabled: true });
      bump();
      await resync(true);
    } catch (e) {
      setMsg({ kind: 'error', text: `Couldn't save: ${errorMessage(e)}` });
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (r: Reminder, enabled: boolean) => {
    try {
      await store.saveReminder({ ...r, enabled });
      bump();
      await resync(enabled);
    } catch (e) {
      setMsg({ kind: 'error', text: `Couldn't update: ${errorMessage(e)}` });
    }
  };

  const remove = async (r: Reminder) => {
    if (!(await confirm('Delete reminder?', r.label, 'Delete', true))) return;
    try {
      await store.deleteReminder(r.id);
      bump();
      await resync(false);
    } catch (e) {
      setMsg({ kind: 'error', text: `Couldn't delete: ${errorMessage(e)}` });
    }
  };

  return (
    <Screen>
      <Muted>Reminders are local notifications. They’re gentle nudges, never streaks or warnings, and can be muted at any time.</Muted>
      {settings.remindersMuted ? <Muted>All reminders are currently muted (Settings).</Muted> : null}
      <Banner message={msg} onDismiss={() => setMsg(null)} />
      {state.status === 'loading' ? <LoadingState /> : null}
      {state.status === 'error' ? <ErrorState message={errorMessage(state.error)} onRetry={retry} /> : null}
      {state.status === 'ready' && state.data.length === 0 ? <EmptyState title="No reminders" body="Add one below if it helps." /> : null}
      {state.status === 'ready'
        ? state.data.map((r) => (
            <Card key={r.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Body style={{ fontWeight: '600', flexShrink: 1 }}>{r.label}</Body>
                <Switch accessibilityLabel={`Enable ${r.label}`} value={r.enabled} onValueChange={(v) => toggle(r, v)} trackColor={{ true: t.primary, false: t.border }} />
              </Row>
              <Muted>
                {pad(r.hour)}:{pad(r.minute)} · {r.weekdays.map((d) => WEEKDAY_SHORT[d]).join(', ')}
              </Muted>
              <Button small kind="ghost" title="Delete" onPress={() => remove(r)} />
            </Card>
          ))
        : null}

      <Card>
        <H2>New reminder</H2>
        <Field label="Label" value={label} onChangeText={setLabel} maxLength={80} />
        <Field label="Time (24h, HH:MM)" value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" />
        <Row>
          {WEEKDAY_SHORT.map((d, i) => {
            const w = i as Weekday;
            const on = days.includes(w);
            return (
              <Button
                key={d}
                small
                kind={on ? 'primary' : 'secondary'}
                title={d}
                accessibilityLabel={`${d} ${on ? 'selected' : 'not selected'}`}
                onPress={() => setDays((ds) => (on ? ds.filter((x) => x !== w) : [...ds, w]))}
              />
            );
          })}
        </Row>
        {error ? <Muted style={{ color: t.danger }}>{error}</Muted> : null}
        <Button title="Add reminder" onPress={add} busy={busy} />
      </Card>
    </Screen>
  );
}
