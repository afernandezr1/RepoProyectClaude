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
  sleep: { title: 'Sleep', body: 'Read sleep sessions into your sleep log.' },
  workouts: { title: 'Workouts', body: 'Read workout sessions into your activity log.' },
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
      setMsg({ kind: 'error', text: `Couldn't save: ${errorMessage(e)}` });
    }
  };

  const saveRest = () => {
    const n = parseNumberInput(rest);
    if (n === null || Number.isNaN(n) || !Number.isInteger(n) || n < 0 || n > 3600) {
      setRestError('Use a whole number of seconds between 0 and 3600.');
      return;
    }
    setRestError(null);
    set({ defaultRestSeconds: n }, 'Default rest saved.');
  };

  const toggleMute = async (muted: boolean) => {
    await set({ remindersMuted: muted });
    const r = await syncReminders(await store.listReminders(), muted, { askPermission: false });
    setMsg({
      kind: r.status === 'unavailable' ? 'info' : 'success',
      text:
        r.status === 'muted'
          ? 'Reminders muted. They are kept and can be unmuted any time.'
          : r.status === 'unavailable'
            ? r.reason
            : r.status === 'denied'
              ? 'Unmuted, but notifications are turned off for this app in system settings.'
              : 'Reminders unmuted.',
    });
  };

  const toggleHealth = async (type: HealthDataType, on: boolean) => {
    if (!on) {
      await set({ health: { ...settings.health, [type]: false } }, `${HEALTH_LABEL[type].title} import turned off. ${health.manageAccessHint}`);
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
              ? 'Access was not granted. That’s completely fine — everything else works without it.'
              : `${health.platformName} isn’t available on this device.`,
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
            ? `Imported ${r.added} new ${HEALTH_LABEL[type].title.toLowerCase()} entries.`
            : `Connected. No ${HEALTH_LABEL[type].title.toLowerCase()} data found for the last 30 days${outcome === 'requested' ? ' (or access was not allowed)' : ''}.`,
      });
    } catch (e) {
      setMsg({ kind: 'error', text: `Health import failed: ${errorMessage(e)}` });
    } finally {
      setBusyType(null);
    }
  };

  const syncNow = async (type: HealthDataType) => {
    setBusyType(type);
    try {
      const r = await importHealth(store, type);
      bump();
      setMsg({ kind: 'success', text: `Synced: ${r.added} new, ${r.updated} refreshed.` });
    } catch (e) {
      setMsg({ kind: 'error', text: `Sync failed: ${errorMessage(e)}` });
    } finally {
      setBusyType(null);
    }
  };

  return (
    <Screen>
      <Banner message={msg} onDismiss={() => setMsg(null)} />

      <Card>
        <H2>Units</H2>
        <Muted>Change any time. Existing entries are converted for display, never altered.</Muted>
        <Segmented label="Weight" value={settings.weightUnit} onChange={(v) => set({ weightUnit: v })} options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} />
        <Segmented label="Distance" value={settings.distanceUnit} onChange={(v) => set({ distanceUnit: v })} options={[{ value: 'km', label: 'km' }, { value: 'mi', label: 'mi' }]} />
        <Segmented label="Activity duration" value={settings.activityUnit} onChange={(v) => set({ activityUnit: v })} options={[{ value: 'min', label: 'minutes' }, { value: 'h', label: 'hours' }]} />
        <Segmented label="Sleep duration" value={settings.sleepUnit} onChange={(v) => set({ sleepUnit: v })} options={[{ value: 'min', label: 'minutes' }, { value: 'h', label: 'hours' }]} />
        <Segmented label="Mood scale" value={settings.moodScale} onChange={(v) => set({ moodScale: v })} options={[{ value: 'of5', label: '1–5' }, { value: 'of10', label: '1–10' }]} />
        <Segmented label="Energy scale" value={settings.energyScale} onChange={(v) => set({ energyScale: v })} options={[{ value: 'of5', label: '1–5' }, { value: 'of10', label: '1–10' }]} />
        <Row style={{ alignItems: 'flex-end' }}>
          <Field style={{ flex: 1 }} label="Default rest (seconds)" value={rest} onChangeText={setRest} keyboardType="number-pad" error={restError} />
          <Button small title="Save" onPress={saveRest} />
        </Row>
      </Card>

      <Card>
        <H2>Reminders</H2>
        <Row style={{ justifyContent: 'space-between' }}>
          <Body>Mute all reminders</Body>
          <Switch
            accessibilityLabel="Mute all reminders"
            value={settings.remindersMuted}
            onValueChange={toggleMute}
            trackColor={{ true: t.primary, false: t.border }}
          />
        </Row>
        <Button title="Manage reminders" kind="secondary" onPress={() => router.push('/reminders')} />
      </Card>

      <Card>
        <H2>Health platform</H2>
        {!health.enabledInBuild ? (
          <Muted>
            Off in this build. The app works fully without it. To enable, see “Health integration” in the README (requires a
            development build).
          </Muted>
        ) : healthAvailable === false ? (
          <Muted>{health.platformName} isn’t available on this device. Everything else works normally.</Muted>
        ) : (
          <>
            <Muted>
              Optional and read-only. Each type asks for its own permission. Nothing is ever written to or shared from your health
              data.
            </Muted>
            {HEALTH_DATA_TYPES.map((type) => (
              <Card key={type}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Body style={{ fontWeight: '600' }}>{HEALTH_LABEL[type].title}</Body>
                  <Switch
                    accessibilityLabel={`Import ${HEALTH_LABEL[type].title} from ${health.platformName}`}
                    value={settings.health[type]}
                    disabled={busyType !== null}
                    onValueChange={(v) => toggleHealth(type, v)}
                    trackColor={{ true: t.primary, false: t.border }}
                  />
                </Row>
                <Muted>{HEALTH_LABEL[type].body}</Muted>
                {settings.health[type] ? (
                  <Button small kind="ghost" title="Sync now" busy={busyType === type} onPress={() => syncNow(type)} />
                ) : null}
              </Card>
            ))}
            <Muted>{health.manageAccessHint}</Muted>
          </>
        )}
      </Card>

      <Card>
        <H2>Data & privacy</H2>
        <Muted>No account. No analytics. Your data lives only on this device.</Muted>
        <Button title="Export, restore or delete data" kind="secondary" onPress={() => router.push('/data')} />
        <Button title="Weekly routine" kind="ghost" onPress={() => router.push('/routine')} />
        <Button title="About & safety" kind="ghost" onPress={() => router.push('/about')} />
      </Card>
    </Screen>
  );
}
