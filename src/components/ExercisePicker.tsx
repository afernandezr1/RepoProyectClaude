import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Exercise, ExerciseKind } from '../domain/types';
import { validateName } from '../domain/validation';
import { space, useTheme } from './theme';
import { Button, Card, Field, Muted, Segmented } from './ui';

const KIND_OPTIONS: { value: ExerciseKind; label: string }[] = [
  { value: 'weight_reps', label: 'Peso' },
  { value: 'reps', label: 'Reps' },
  { value: 'duration', label: 'Tiempo' },
  { value: 'distance', label: 'Distancia' },
];

export function ExercisePicker({
  exercises,
  onPick,
  onCreate,
  onCancel,
}: {
  exercises: Exercise[];
  onPick: (e: Exercise) => void;
  onCreate: (name: string, kind: ExerciseKind) => Promise<void>;
  onCancel: () => void;
}) {
  const t = useTheme();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<ExerciseKind>('weight_reps');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? exercises.filter((e) => e.name.toLowerCase().includes(s)) : exercises;
  }, [q, exercises]);
  const exact = exercises.some((e) => e.name.toLowerCase() === q.trim().toLowerCase());

  const create = async () => {
    const v = validateName(q, 'Nombre del ejercicio');
    if (!v.ok) return setError(v.error);
    setBusy(true);
    try {
      await onCreate(v.value, kind);
      setQ('');
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el ejercicio.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <Field label="Busca o escribe un ejercicio" value={q} onChangeText={setQ} error={error} maxLength={80} />
      <View style={{ maxHeight: 280 }}>
        {filtered.slice(0, 30).map((e) => (
          <Pressable
            key={e.id}
            accessibilityRole="button"
            accessibilityLabel={`Añadir ${e.name}`}
            onPress={() => onPick(e)}
            style={{ paddingVertical: space.sm }}
          >
            <Text style={{ color: t.text, fontSize: 16 }}>{e.name}</Text>
          </Pressable>
        ))}
        {filtered.length === 0 ? <Muted>No hay ejercicios que coincidan.</Muted> : null}
      </View>
      {q.trim() && !exact ? (
        <>
          <Segmented label="Registrar por" options={KIND_OPTIONS} value={kind} onChange={setKind} />
          <Button title={`Crear «${q.trim()}»`} kind="secondary" onPress={create} busy={busy} />
        </>
      ) : null}
      <Button title="Cancelar" kind="ghost" small onPress={onCancel} />
    </Card>
  );
}
