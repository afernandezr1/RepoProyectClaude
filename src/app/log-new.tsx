import { router } from 'expo-router';
import React, { useState } from 'react';
import { Banner, errorMessage, type BannerMessage } from '../components/states';
import { useTheme } from '../components/theme';
import { Button, Field, Muted, Row, Screen, Segmented } from '../components/ui';
import { LOG_KIND_LABEL } from '../domain/copy';
import type { DurationUnit, LogKind, ScaleUnit } from '../domain/types';
import { preferredLogUnit, scaleMax } from '../domain/units';
import { validateLog } from '../domain/validation';
import { useApp } from '../state/AppContext';

const KINDS: LogKind[] = ['activity', 'sleep', 'mood', 'energy', 'note'];

export default function NewLog() {
  const { store, settings, bump } = useApp();
  const t = useTheme();
  const [kind, setKind] = useState<LogKind>('activity');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState<string | null>(preferredLogUnit('activity', settings));
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<BannerMessage | null>(null);
  const [busy, setBusy] = useState(false);

  const changeKind = (k: LogKind) => {
    setKind(k);
    setUnit(preferredLogUnit(k, settings));
    setValue('');
    setError(null);
  };

  const save = async () => {
    const v = validateLog({ kind, value, unit, text });
    if (!v.ok) return setError(v.error);
    setError(null);
    setBusy(true);
    try {
      await store.addLog({ kind, ...v.value });
      bump();
      router.back();
    } catch (e) {
      setMsg({ kind: 'error', text: `Couldn't save: ${errorMessage(e)}` });
    } finally {
      setBusy(false);
    }
  };

  const isDuration = kind === 'activity' || kind === 'sleep';
  const isScale = kind === 'mood' || kind === 'energy';
  const max = isScale ? scaleMax((unit as ScaleUnit) ?? 'of5') : 0;

  return (
    <Screen>
      <Segmented value={kind} onChange={changeKind} options={KINDS.map((k) => ({ value: k, label: LOG_KIND_LABEL[k] }))} />
      {isDuration ? (
        <>
          <Field
            testID="log-value"
            label={kind === 'activity' ? 'How long?' : 'How long did you sleep?'}
            value={value}
            onChangeText={setValue}
            keyboardType="decimal-pad"
            error={error}
          />
          <Segmented<DurationUnit>
            label="Unit"
            value={(unit as DurationUnit) ?? 'min'}
            onChange={setUnit}
            options={[
              { value: 'min', label: 'minutes' },
              { value: 'h', label: 'hours' },
            ]}
          />
        </>
      ) : null}
      {isScale ? (
        <>
          <Segmented<ScaleUnit>
            label="Scale"
            value={(unit as ScaleUnit) ?? 'of5'}
            onChange={(u) => {
              setUnit(u);
              setValue('');
            }}
            options={[
              { value: 'of5', label: '1–5' },
              { value: 'of10', label: '1–10' },
            ]}
          />
          <Muted>{kind === 'mood' ? 'How are you feeling?' : 'How is your energy?'} There is no right answer.</Muted>
          <Row>
            {Array.from({ length: max }, (_, i) => String(i + 1)).map((n) => (
              <Button key={n} small kind={value === n ? 'primary' : 'secondary'} title={n} onPress={() => setValue(n)} />
            ))}
          </Row>
          {error ? <Muted style={{ color: t.danger }}>{error}</Muted> : null}
        </>
      ) : null}
      <Field
        label={kind === 'note' ? 'Note' : kind === 'activity' ? 'What did you do? (optional)' : 'Note (optional)'}
        value={text}
        onChangeText={setText}
        multiline
        maxLength={2000}
        error={kind === 'note' ? error : null}
      />
      <Banner message={msg} onDismiss={() => setMsg(null)} />
      <Button testID="save-log" title="Save" onPress={save} busy={busy} />
      <Muted>Default units can be changed in Settings.</Muted>
    </Screen>
  );
}
