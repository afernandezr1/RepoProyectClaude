import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Switch } from 'react-native';
import { Banner, errorMessage, type BannerMessage } from '../../components/states';
import { useTheme } from '../../components/theme';
import { Body, Button, Card, Field, H2, Muted, Row, Screen, Segmented } from '../../components/ui';
import { HEALTH_DATA_TYPES, type HealthDataType, type Settings } from '../../domain/types';
import { parseNumberInput } from '../../domain/validation';
import { health } from '../../services/health';
import { importHealth } from '../../services/healthImport';
import { syncReminders } from '../../services/notifications';
import { useApp } from '../../state/AppContext';

const HEALTH_LABEL: Record<HealthDataType, { title: string; body: string }> = {
  sleep: { title: 'Sueño', body: 'Importa tus sesiones de sueño a tu registro de sueño.' },
  workouts: { title: 'Entrenamientos', body: 'Importa tus entrenamientos a tu registro de actividad.' },
};

export default function SettingsScreen() {
  const { store, settings, updateSettings, bump } = useApp();
  const t = useTheme();
  const [msg, setMsg] = useState<BannerMessage | null>(null);
  const [rest, setRest] = useState(String(settings.defaultRestSeconds));
  const [restError, setRestError] = useState<string | null>(null);
  const [healthAvailable, setHealthAvailable] = useState<boolean | null>(null);
  const [busyType, setBusyType] = useState<HealthDataType | null>(null);

  useEffect(() => {
    if (!health.enabledInBuild) return;
    health.isAvailable().then(setHealthAvailable).catch(() => setHealthAvailable(false));
  }, []);

  const set = async (patch: Partial<Settings>, success?: string) => {
    try {
      await updateSettings(patch);
      if (success) setMsg({ kind: 'success', text: success });
    } catch (e) {
      setMsg({ kind: 'error', text: `No se pudo guardar: ${errorMessage(e)}` });
    }
  };

  const saveRest = () => {
    const n = parseNumberInput(rest);
    if (n === null || Number.isNaN(n) || !Number.isInteger(n) || n < 0 || n > 3600) {
      setRestError('Usa un número entero de segundos entre 0 y 3600.');
      return;
    }
    setRestError(null);
    set({ defaultRestSeconds: n }, 'Descanso por defecto guardado.');
  };

  const toggleMute = async (muted: boolean) => {
    await set({ remindersMuted: muted });
    const r = await syncReminders(await store.listReminders(), muted, { askPermission: false });
    setMsg({
      kind: r.status === 'unavailable' ? 'info' : 'success',
      text:
        r.status === 'muted'
          ? 'Recordatorios silenciados. Se conservan y puedes reactivarlos cuando quieras.'
          : r.status === 'unavailable'
            ? r.reason
            : r.status === 'denied'
              ? 'Reactivados, pero las notificaciones de esta app están desactivadas en los ajustes del sistema.'
              : 'Recordatorios reactivados.',
    });
  };

  const toggleHealth = async (type: HealthDataType, on: boolean) => {
    if (!on) {
      await set({ health: { ...settings.health, [type]: false } }, `Importación de ${HEALTH_LABEL[type].title.toLowerCase()} desactivada. ${health.manageAccessHint}`);
      return;
    }
    setBusyType(type);
    try {
      const outcome = await health.requestPermission(type);
      if (outcome === 'denied' || outcome === 'unavailable') {
        setMsg({
          kind: 'info',
          text:
            outcome === 'denied'
              ? 'No se concedió el acceso. No pasa nada: todo lo demás funciona sin él.'
              : `${health.platformName} no está disponible en este dispositivo.`,
        });
        return;
      }
      await updateSettings({ health: { ...settings.health, [type]: true } });
      const r = await importHealth(store, type);
      bump();
      setMsg({
        kind: 'success',
        text:
          r.added + r.updated > 0
            ? `Se importaron ${r.added} entradas nuevas de ${HEALTH_LABEL[type].title.toLowerCase()}.`
            : `Conectado. No hay datos de ${HEALTH_LABEL[type].title.toLowerCase()} de los últimos 30 días${outcome === 'requested' ? ' (o no se permitió el acceso)' : ''}.`,
      });
    } catch (e) {
      setMsg({ kind: 'error', text: `Falló la importación de salud: ${errorMessage(e)}` });
    } finally {
      setBusyType(null);
    }
  };

  const syncNow = async (type: HealthDataType) => {
    setBusyType(type);
    try {
      const r = await importHealth(store, type);
      bump();
      setMsg({ kind: 'success', text: `Sincronizado: ${r.added} nuevas, ${r.updated} actualizadas.` });
    } catch (e) {
      setMsg({ kind: 'error', text: `Falló la sincronización: ${errorMessage(e)}` });
    } finally {
      setBusyType(null);
    }
  };

  return (
    <Screen>
      <Banner message={msg} onDismiss={() => setMsg(null)} />

      <Card>
        <H2>Unidades</H2>
        <Muted>Cámbialas cuando quieras. Las entradas existentes se convierten al mostrarlas, nunca se modifican.</Muted>
        <Segmented label="Peso" value={settings.weightUnit} onChange={(v) => set({ weightUnit: v })} options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} />
        <Segmented label="Distancia" value={settings.distanceUnit} onChange={(v) => set({ distanceUnit: v })} options={[{ value: 'km', label: 'km' }, { value: 'mi', label: 'mi' }]} />
        <Segmented label="Duración de la actividad" value={settings.activityUnit} onChange={(v) => set({ activityUnit: v })} options={[{ value: 'min', label: 'minutos' }, { value: 'h', label: 'horas' }]} />
        <Segmented label="Duración del sueño" value={settings.sleepUnit} onChange={(v) => set({ sleepUnit: v })} options={[{ value: 'min', label: 'minutos' }, { value: 'h', label: 'horas' }]} />
        <Segmented label="Escala de ánimo" value={settings.moodScale} onChange={(v) => set({ moodScale: v })} options={[{ value: 'of5', label: '1–5' }, { value: 'of10', label: '1–10' }]} />
        <Segmented label="Escala de energía" value={settings.energyScale} onChange={(v) => set({ energyScale: v })} options={[{ value: 'of5', label: '1–5' }, { value: 'of10', label: '1–10' }]} />
        <Row style={{ alignItems: 'flex-end' }}>
          <Field style={{ flex: 1 }} label="Descanso por defecto (segundos)" value={rest} onChangeText={setRest} keyboardType="number-pad" error={restError} />
          <Button small title="Guardar" onPress={saveRest} />
        </Row>
      </Card>

      <Card>
        <H2>Recordatorios</H2>
        <Row style={{ justifyContent: 'space-between' }}>
          <Body>Silenciar todos los recordatorios</Body>
          <Switch
            accessibilityLabel="Silenciar todos los recordatorios"
            value={settings.remindersMuted}
            onValueChange={toggleMute}
            trackColor={{ true: t.primary, false: t.border }}
          />
        </Row>
        <Button title="Gestionar recordatorios" kind="secondary" onPress={() => router.push('/reminders')} />
      </Card>

      <Card>
        <H2>Plataforma de salud</H2>
        {!health.enabledInBuild ? (
          <Muted>
            Desactivada en esta versión. La app funciona completa sin ella. Para activarla, consulta “Health integration” en el
            README (necesita una development build).
          </Muted>
        ) : healthAvailable === false ? (
          <Muted>{health.platformName} no está disponible en este dispositivo. Todo lo demás funciona con normalidad.</Muted>
        ) : (
          <>
            <Muted>
              Opcional y de solo lectura. Cada tipo de dato pide su propio permiso. Nunca se escribe ni se comparte nada de tus datos
              de salud.
            </Muted>
            {HEALTH_DATA_TYPES.map((type) => (
              <Card key={type}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Body style={{ fontWeight: '600' }}>{HEALTH_LABEL[type].title}</Body>
                  <Switch
                    accessibilityLabel={`Importar ${HEALTH_LABEL[type].title} desde ${health.platformName}`}
                    value={settings.health[type]}
                    disabled={busyType !== null}
                    onValueChange={(v) => toggleHealth(type, v)}
                    trackColor={{ true: t.primary, false: t.border }}
                  />
                </Row>
                <Muted>{HEALTH_LABEL[type].body}</Muted>
                {settings.health[type] ? (
                  <Button small kind="ghost" title="Sincronizar ahora" busy={busyType === type} onPress={() => syncNow(type)} />
                ) : null}
              </Card>
            ))}
            <Muted>{health.manageAccessHint}</Muted>
          </>
        )}
      </Card>

      <Card>
        <H2>Datos y privacidad</H2>
        <Muted>Sin cuenta. Sin analíticas. Tus datos viven solo en este dispositivo.</Muted>
        <Button title="Exportar, restaurar o borrar datos" kind="secondary" onPress={() => router.push('/data')} />
        <Button title="Rutina semanal" kind="ghost" onPress={() => router.push('/routine')} />
        <Button title="Información y seguridad" kind="ghost" onPress={() => router.push('/about')} />
      </Card>
    </Screen>
  );
}
