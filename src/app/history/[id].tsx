import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { confirm } from '../../components/confirm';
import { Banner, EmptyState, ErrorState, LoadingState, errorMessage, type BannerMessage } from '../../components/states';
import { Body, Button, Card, H2, Muted, Screen } from '../../components/ui';
import { formatDateTime, minutesBetween } from '../../domain/dates';
import type { WorkoutSet } from '../../domain/types';
import { fmt, fromKg, fromMetres, unitLabel } from '../../domain/units';
import { useApp, useLoad } from '../../state/AppContext';

export default function WorkoutDetail() {
  const { id, saved } = useLocalSearchParams<{ id: string; saved?: string }>();
  const { store, settings, bump } = useApp();
  const { state, retry } = useLoad(
    async (s) => ({ detail: await s.getWorkout(String(id)), exercises: await s.listExercises() }),
    [id],
  );
  const [msg, setMsg] = useState<BannerMessage | null>(
    saved ? { kind: 'success', text: 'Entrenamiento guardado. ¡Bien hecho!' } : null,
  );

  if (state.status === 'loading') return <LoadingState />;
  if (state.status === 'error') {
    return (
      <Screen>
        <ErrorState message={errorMessage(state.error)} onRetry={retry} />
      </Screen>
    );
  }
  const { detail, exercises } = state.data;
  if (!detail) {
    return (
      <Screen>
        <EmptyState title="No se encontró el entrenamiento" actionLabel="Volver al historial" onAction={() => router.navigate('/history')} />
      </Screen>
    );
  }
  const names = new Map(exercises.map((e) => [e.id, e.name]));
  const groups = new Map<number, WorkoutSet[]>();
  for (const s of detail.sets) groups.set(s.position, [...(groups.get(s.position) ?? []), s]);

  const describeSet = (s: WorkoutSet) => {
    const parts: string[] = [];
    if (s.weightKg != null) parts.push(`${fmt(fromKg(s.weightKg, settings.weightUnit), 1)} ${unitLabel(settings.weightUnit)}`);
    if (s.reps != null) parts.push(`${s.reps} reps`);
    if (s.durationSeconds != null) parts.push(`${s.durationSeconds} s`);
    if (s.distanceM != null) parts.push(`${fmt(fromMetres(s.distanceM, settings.distanceUnit), 2)} ${unitLabel(settings.distanceUnit)}`);
    return parts.join(' × ') || 'hecha';
  };

  const remove = async () => {
    if (!(await confirm('¿Eliminar este entrenamiento?', 'Se quitará del historial y de los patrones.', 'Eliminar', true))) return;
    try {
      await store.deleteWorkout(detail.workout.id);
      bump();
      router.navigate('/history');
    } catch (e) {
      setMsg({ kind: 'error', text: `No se pudo eliminar: ${errorMessage(e)}` });
    }
  };

  return (
    <Screen>
      <Banner message={msg} onDismiss={() => setMsg(null)} />
      <H2>{detail.workout.name}</H2>
      <Muted>
        {formatDateTime(detail.workout.startedAt)} · {fmt(minutesBetween(detail.workout.startedAt, detail.workout.endedAt), 0)} min
      </Muted>
      {detail.workout.notes ? <Body>{detail.workout.notes}</Body> : null}
      {groups.size === 0 ? <EmptyState title="No hay series registradas" /> : null}
      {Array.from(groups.values()).map((sets) => (
        <Card key={sets[0].id}>
          <Body style={{ fontWeight: '600' }}>{names.get(sets[0].exerciseId) ?? 'Ejercicio'}</Body>
          {sets.map((s, i) => (
            <Muted key={s.id}>
              {i + 1}. {describeSet(s)}
            </Muted>
          ))}
        </Card>
      ))}
      <Button title="Eliminar entrenamiento" kind="ghost" onPress={remove} />
    </Screen>
  );
}
