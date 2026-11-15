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
      return { kind: 'success', text: r.count === 0 ? 'Guardado. No hay recordatorios activos.' : r.count === 1 ? 'Guardado. 1 recordatorio semanal programado.' : `Guardado. ${r.count} recordatorios semanales programados.` };
    case 'muted':
      return { kind: 'info', text: 'Guardado. Los recordatorios están silenciados, así que no aparecerá ninguno hasta que los reactives en Ajustes.' };
    case 'denied':
      return { kind: 'info', text: 'Guardado, pero las notificaciones de esta app están desactivadas. Puedes permitirlas en los ajustes del sistema.' };
    default:
      return { kind: 'info', text: `Guardado. ${r.reason}` };
  }
}

export default function Reminders() {
  const { store, settings, bump } = useApp();
  const t = useTheme();
  const { state, retry } = useLoad((s) => s.listReminders());
  const [label, setLabel] = useState('Hora de moverse, si te apetece');
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
      setMsg({ kind: 'error', text: `No se pudo guardar: ${errorMessage(e)}` });
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
      setMsg({ kind: 'error', text: `No se pudo actualizar: ${errorMessage(e)}` });
    }
  };

  const remove = async (r: Reminder) => {
    if (!(await confirm('¿Eliminar el recordatorio?', r.label, 'Eliminar', true))) return;
    try {
      await store.deleteReminder(r.id);
      bump();
      await resync(false);
    } catch (e) {
      setMsg({ kind: 'error', text: `No se pudo eliminar: ${errorMessage(e)}` });
    }
  };

  return (
    <Screen>
      <Muted>Los recordatorios son notificaciones locales: avisos amables, nunca rachas ni advertencias. Puedes silenciarlos cuando quieras.</Muted>
      {settings.remindersMuted ? <Muted>Ahora mismo todos los recordatorios están silenciados (Ajustes).</Muted> : null}
      <Banner message={msg} onDismiss={() => setMsg(null)} />
      {state.status === 'loading' ? <LoadingState /> : null}
      {state.status === 'error' ? <ErrorState message={errorMessage(state.error)} onRetry={retry} /> : null}
      {state.status === 'ready' && state.data.length === 0 ? <EmptyState title="No hay recordatorios" body="Añade uno abajo si te ayuda." /> : null}
      {state.status === 'ready'
        ? state.data.map((r) => (
            <Card key={r.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Body style={{ fontWeight: '600', flexShrink: 1 }}>{r.label}</Body>
                <Switch accessibilityLabel={`Activar ${r.label}`} value={r.enabled} onValueChange={(v) => toggle(r, v)} trackColor={{ true: t.primary, false: t.border }} />
              </Row>
              <Muted>
                {pad(r.hour)}:{pad(r.minute)} · {r.weekdays.map((d) => WEEKDAY_SHORT[d]).join(', ')}
              </Muted>
              <Button small kind="ghost" title="Eliminar" onPress={() => remove(r)} />
            </Card>
          ))
        : null}

      <Card>
        <H2>Nuevo recordatorio</H2>
        <Field label="Texto" value={label} onChangeText={setLabel} maxLength={80} />
        <Field label="Hora (24 h, HH:MM)" value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" />
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
                accessibilityLabel={`${d} ${on ? 'seleccionado' : 'sin seleccionar'}`}
                onPress={() => setDays((ds) => (on ? ds.filter((x) => x !== w) : [...ds, w]))}
              />
            );
          })}
        </Row>
        {error ? <Muted style={{ color: t.danger }}>{error}</Muted> : null}
        <Button title="Añadir recordatorio" onPress={add} busy={busy} />
      </Card>
    </Screen>
  );
}
