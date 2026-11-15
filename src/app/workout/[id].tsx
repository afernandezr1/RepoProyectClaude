import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { confirm } from '../../components/confirm';
import { ExercisePicker } from '../../components/ExercisePicker';
import { RestTimerBar } from '../../components/RestTimerBar';
import { Banner, EmptyState, ErrorState, LoadingState, errorMessage, type BannerMessage } from '../../components/states';
import { radius, space, useTheme } from '../../components/theme';
import { Body, Button, Card, Field, H2, Muted, Row, Screen } from '../../components/ui';
import { formatDateTime } from '../../domain/dates';
import { IDLE_TIMER, startTimer, type RestTimer } from '../../domain/timer';
import type { Exercise, ExerciseKind, WorkoutSet } from '../../domain/types';
import { fmt, fromKg, fromMetres, toKg, toMetres, unitLabel } from '../../domain/units';
import { validateSet, validateText, type SetInput } from '../../domain/validation';
import { useApp, useLoad } from '../../state/AppContext';

type Drafts = Record<string, SetInput>;

export default function WorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { store, settings, bump } = useApp();
  const t = useTheme();
  const { state, retry } = useLoad(
    async (s) => ({ detail: await s.getWorkout(String(id)), exercises: await s.listExercises() }),
    [id],
  );
  const [drafts, setDrafts] = useState<Drafts>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [timer, setTimer] = useState<RestTimer>(IDLE_TIMER);
  const [picking, setPicking] = useState(false);
  const [notes, setNotes] = useState<string | null>(null);
  const [msg, setMsg] = useState<BannerMessage | null>(null);
  const [busy, setBusy] = useState(false);

  const draftFor = useCallback(
    (s: WorkoutSet): SetInput =>
      drafts[s.id] ?? {
        weight: s.weightKg != null ? fmt(fromKg(s.weightKg, settings.weightUnit), 2) : '',
        reps: s.reps != null ? String(s.reps) : '',
        duration: s.durationSeconds != null ? String(s.durationSeconds) : '',
        distance: s.distanceM != null ? fmt(fromMetres(s.distanceM, settings.distanceUnit), 2) : '',
      },
    [drafts, settings.weightUnit, settings.distanceUnit],
  );

  if (state.status === 'loading') return <LoadingState label="Cargando entrenamiento…" />;
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
        <EmptyState title="No se encontró el entrenamiento" body="Puede que se haya descartado." actionLabel="Volver" onAction={() => router.back()} />
      </Screen>
    );
  }
  if (detail.workout.endedAt) {
    return (
      <Screen>
        <EmptyState
          title="Este entrenamiento ya terminó"
          actionLabel="Ver detalles"
          onAction={() => router.replace(`/history/${detail.workout.id}`)}
        />
      </Screen>
    );
  }

  const byId = new Map(exercises.map((e) => [e.id, e]));
  const groups = new Map<number, WorkoutSet[]>();
  for (const s of detail.sets) groups.set(s.position, [...(groups.get(s.position) ?? []), s]);
  const completedCount = detail.sets.filter((s) => s.completed).length;

  const run = async (fn: () => Promise<void>, failText: string) => {
    try {
      await fn();
      bump();
    } catch (e) {
      setMsg({ kind: 'error', text: `${failText}: ${errorMessage(e)}` });
    }
  };

  const toggle = (s: WorkoutSet) =>
    run(async () => {
      if (s.completed) {
        await store.updateSet(s.id, { completed: false });
        return;
      }
      const parsed = validateSet(draftFor(s), true);
      if (!parsed.ok) {
        setErrors((e) => ({ ...e, [s.id]: parsed.error }));
        return;
      }
      setErrors(({ [s.id]: _omit, ...rest }) => rest);
      const v = parsed.value;
      await store.updateSet(s.id, {
        weightKg: v.weight != null ? toKg(v.weight, settings.weightUnit) : null,
        reps: v.reps,
        durationSeconds: v.durationSeconds,
        distanceM: v.distance != null ? toMetres(v.distance, settings.distanceUnit) : null,
        completed: true,
      });
      setDrafts(({ [s.id]: _omit, ...rest }) => rest);
      if (s.restSeconds > 0) setTimer(startTimer(s.restSeconds, Date.now()));
    }, "No se pudo guardar la serie");

  const finish = async () => {
    const n = validateText(notes ?? detail.workout.notes, 'Notas');
    if (!n.ok) return setMsg({ kind: 'error', text: n.error });
    if (completedCount === 0) {
      const discard = await confirm(
        'Ninguna serie completada',
        'Todavía no has marcado nada como hecho. ¿Descartar este entrenamiento?',
        'Descartar',
        true,
      );
      if (discard) await discardNow();
      return;
    }
    const remaining = detail.sets.length - completedCount;
    if (remaining > 0) {
      const ok = await confirm(
        '¿Terminar el entrenamiento?',
        remaining === 1
          ? '1 serie sin marcar no se guardará. No pasa nada.'
          : `${remaining} series sin marcar no se guardarán. No pasa nada.`,
        'Terminar',
      );
      if (!ok) return;
    }
    setBusy(true);
    try {
      await store.finishWorkout(detail.workout.id, n.value);
      bump();
      router.replace(`/history/${detail.workout.id}?saved=1`);
    } catch (e) {
      setMsg({ kind: 'error', text: `No se pudo terminar: ${errorMessage(e)}` });
    } finally {
      setBusy(false);
    }
  };

  const discardNow = async () => {
    try {
      await store.deleteWorkout(detail.workout.id);
      bump();
      router.replace('/');
    } catch (e) {
      setMsg({ kind: 'error', text: `No se pudo descartar: ${errorMessage(e)}` });
    }
  };

  const discard = async () => {
    if (await confirm('¿Descartar el entrenamiento?', 'Se eliminarán el entrenamiento y sus series.', 'Descartar', true)) await discardNow();
  };

  const addExercise = (e: Exercise) =>
    run(async () => {
      await store.addExerciseToWorkout(detail.workout.id, e.id, settings.defaultRestSeconds);
      setPicking(false);
    }, "No se pudo añadir el ejercicio");

  const createExercise = async (name: string, kind: ExerciseKind) => {
    const e = await store.createExercise(name, kind);
    await addExercise(e);
  };

  return (
    <Screen>
      <Muted>Empezado: {formatDateTime(detail.workout.startedAt)}</Muted>
      <H2>{detail.workout.name}</H2>
      <Banner message={msg} onDismiss={() => setMsg(null)} />
      <RestTimerBar timer={timer} onChange={setTimer} onDismiss={() => setTimer(IDLE_TIMER)} />

      {groups.size === 0 ? (
        <EmptyState title="Aún no hay ejercicios" body="Añade un ejercicio para empezar a registrar series." />
      ) : null}

      {Array.from(groups.entries()).map(([position, sets]) => {
        const ex = byId.get(sets[0].exerciseId);
        const kind: ExerciseKind = ex?.kind ?? 'weight_reps';
        return (
          <Card key={position}>
            <Body style={{ fontWeight: '600' }}>{ex?.name ?? 'Ejercicio'}</Body>
            {sets.map((s, i) => {
              const d = draftFor(s);
              const setDraft = (patch: Partial<SetInput>) => setDrafts((all) => ({ ...all, [s.id]: { ...d, ...patch } }));
              return (
                <View key={s.id} style={styles.setRow}>
                  <Text style={[styles.setNo, { color: t.muted }]}>{i + 1}</Text>
                  {kind === 'weight_reps' ? (
                    <Field
                      style={styles.input}
                      label={unitLabel(settings.weightUnit)}
                      value={d.weight}
                      onChangeText={(v) => setDraft({ weight: v })}
                      keyboardType="decimal-pad"
                      testID={`weight-${s.id}`}
                    />
                  ) : null}
                  {kind === 'weight_reps' || kind === 'reps' ? (
                    <Field
                      style={styles.input}
                      label="reps"
                      value={d.reps}
                      onChangeText={(v) => setDraft({ reps: v })}
                      keyboardType="number-pad"
                      testID={`reps-${s.id}`}
                    />
                  ) : null}
                  {kind === 'duration' ? (
                    <Field
                      style={styles.input}
                      label="segundos"
                      value={d.duration}
                      onChangeText={(v) => setDraft({ duration: v })}
                      keyboardType="number-pad"
                    />
                  ) : null}
                  {kind === 'distance' ? (
                    <Field
                      style={styles.input}
                      label={unitLabel(settings.distanceUnit)}
                      value={d.distance}
                      onChangeText={(v) => setDraft({ distance: v })}
                      keyboardType="decimal-pad"
                    />
                  ) : null}
                  <Pressable
                    testID={`done-${s.id}`}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: s.completed }}
                    accessibilityLabel={`Serie ${i + 1} hecha`}
                    onPress={() => toggle(s)}
                    style={[
                      styles.check,
                      { borderColor: t.primary, backgroundColor: s.completed ? t.primary : 'transparent' },
                    ]}
                  >
                    <Text style={{ color: s.completed ? t.primaryText : t.primary, fontSize: 18 }}>✓</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Quitar serie ${i + 1}`}
                    onPress={() => run(() => store.removeSet(s.id), "No se pudo quitar la serie")}
                    hitSlop={12}
                    style={styles.remove}
                  >
                    <Text style={{ color: t.muted, fontSize: 16 }}>✕</Text>
                  </Pressable>
                  {errors[s.id] ? <Text style={[styles.err, { color: t.danger }]}>{errors[s.id]}</Text> : null}
                </View>
              );
            })}
            <Row>
              <Button
                small
                kind="ghost"
                title="+ Añadir serie"
                onPress={() => run(() => store.addSet(detail.workout.id, sets[0].exerciseId, position), "No se pudo añadir una serie")}
              />
              <Muted>Descanso {sets[0].restSeconds} s</Muted>
            </Row>
          </Card>
        );
      })}

      {picking ? (
        <ExercisePicker
          exercises={exercises}
          onPick={addExercise}
          onCreate={createExercise}
          onCancel={() => setPicking(false)}
        />
      ) : (
        <Button title="+ Añadir ejercicio" kind="secondary" onPress={() => setPicking(true)} />
      )}

      <Field
        label="Notas (opcional)"
        value={notes ?? detail.workout.notes}
        onChangeText={setNotes}
        multiline
        maxLength={2000}
      />
      <Button testID="finish-workout" title={completedCount === 1 ? 'Terminar (1 hecha)' : `Terminar (${completedCount} hechas)`} onPress={finish} busy={busy} />
      <Button title="Descartar entrenamiento" kind="ghost" onPress={discard} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  setRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, flexWrap: 'wrap' },
  setNo: { width: 18, paddingBottom: 12, fontWeight: '600' },
  input: { flex: 1, minWidth: 70 },
  check: {
    width: 44,
    height: 44,
    borderRadius: radius,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remove: { width: 32, height: 44, alignItems: 'center', justifyContent: 'center' },
  err: { width: '100%', fontSize: 13 },
});
