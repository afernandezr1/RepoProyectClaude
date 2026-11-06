import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { confirm } from '../../components/confirm';
import { ExercisePicker } from '../../components/ExercisePicker';
import { Banner, ErrorState, LoadingState, errorMessage, type BannerMessage } from '../../components/states';
import { Body, Button, Card, Field, Muted, Row, Screen } from '../../components/ui';
import { templateSuggestions } from '../../domain/routine';
import type { Exercise, ExerciseKind, Template } from '../../domain/types';
import { validateName, validateTemplateExercise, validateText } from '../../domain/validation';
import { useApp, useLoad } from '../../state/AppContext';

interface Draft {
  key: string;
  exerciseId: string;
  targetSets: string;
  targetReps: string;
  restSeconds: string;
}

let keySeq = 0;
const nextKey = () => `k${++keySeq}`;

export default function EditTemplate() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { state, retry } = useLoad(
    async (s) => ({ template: isNew ? null : await s.getTemplate(String(id)), exercises: await s.listExercises() }),
    [id],
  );
  if (state.status === 'loading') return <LoadingState />;
  if (state.status === 'error') {
    return (
      <Screen>
        <ErrorState message={errorMessage(state.error)} onRetry={retry} />
      </Screen>
    );
  }
  if (!isNew && !state.data.template) {
    return (
      <Screen>
        <ErrorState message="This template no longer exists." onRetry={() => router.back()} />
      </Screen>
    );
  }
  // Keyed so the form re-initialises if a different template is opened.
  return (
    <TemplateEditor
      key={String(id)}
      id={String(id)}
      isNew={isNew}
      template={state.data.template}
      baseExercises={state.data.exercises}
    />
  );
}

function TemplateEditor({
  id,
  isNew,
  template,
  baseExercises,
}: {
  id: string;
  isNew: boolean;
  template: Template | null;
  baseExercises: Exercise[];
}) {
  const { store, settings, bump } = useApp();
  const [name, setName] = useState(template?.name ?? '');
  const [notes, setNotes] = useState(template?.notes ?? '');
  const [rows, setRows] = useState<Draft[]>(() =>
    (template?.exercises ?? []).map((e) => ({
      key: nextKey(),
      exerciseId: e.exerciseId,
      targetSets: String(e.targetSets),
      targetReps: e.targetReps != null ? String(e.targetReps) : '',
      restSeconds: String(e.restSeconds),
    })),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [picking, setPicking] = useState(false);
  const [msg, setMsg] = useState<BannerMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const [extraExercises, setExtraExercises] = useState<Exercise[]>([]);

  const exercises = [...baseExercises, ...extraExercises];
  const names = new Map(exercises.map((e) => [e.id, e.name]));

  const update = (key: string, patch: Partial<Draft>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const move = (key: string, dir: -1 | 1) =>
    setRows((rs) => {
      const i = rs.findIndex((r) => r.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= rs.length) return rs;
      const copy = [...rs];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  const add = (e: Exercise) => {
    setRows((rs) => [
      ...rs,
      { key: nextKey(), exerciseId: e.id, targetSets: '3', targetReps: e.kind === 'weight_reps' || e.kind === 'reps' ? '10' : '', restSeconds: String(settings.defaultRestSeconds) },
    ]);
    setPicking(false);
  };
  const create = async (n: string, kind: ExerciseKind) => {
    const e = await store.createExercise(n, kind);
    setExtraExercises((xs) => [...xs, e]);
    add(e);
  };

  const save = async () => {
    const errs: Record<string, string> = {};
    const nm = validateName(name, 'Template name');
    if (!nm.ok) errs.name = nm.error;
    const nt = validateText(notes, 'Notes');
    if (!nt.ok) errs.notes = nt.error;
    const parsed = rows.map((r) => {
      const v = validateTemplateExercise(r);
      if (!v.ok) errs[r.key] = v.error;
      return v.ok ? { exerciseId: r.exerciseId, ...v.value } : null;
    });
    setErrors(errs);
    if (Object.keys(errs).length > 0 || !nm.ok || !nt.ok) return;
    setBusy(true);
    try {
      const saved = await store.saveTemplate({
        id: isNew ? undefined : id,
        name: nm.value,
        notes: nt.value,
        exercises: parsed.filter((p): p is NonNullable<typeof p> => p !== null),
      });
      bump();
      setMsg({ kind: 'success', text: 'Template saved.' });
      if (isNew) router.replace(`/templates/${saved}`);
    } catch (e) {
      setMsg({ kind: 'error', text: `Couldn't save: ${errorMessage(e)}` });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!(await confirm('Delete template?', 'Past workouts stay in your history.', 'Delete', true))) return;
    try {
      await store.deleteTemplate(id);
      bump();
      router.back();
    } catch (e) {
      setMsg({ kind: 'error', text: `Couldn't delete: ${errorMessage(e)}` });
    }
  };

  const suggestions = templateSuggestions({
    exercises: rows.map((r) => ({ targetSets: Number(r.targetSets) || 0 })),
  });

  return (
    <Screen>
      <Banner message={msg} onDismiss={() => setMsg(null)} />
      <Field testID="template-name" label="Name" value={name} onChangeText={setName} error={errors.name} maxLength={80} />
      <Field label="Notes (optional)" value={notes} onChangeText={setNotes} error={errors.notes} multiline maxLength={2000} />
      {rows.length === 0 ? <Muted>No exercises yet. Add one below.</Muted> : null}
      {rows.map((r, i) => (
        <Card key={r.key}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Body style={{ fontWeight: '600', flexShrink: 1 }}>{names.get(r.exerciseId) ?? 'Exercise'}</Body>
            <Row>
              <Button small kind="ghost" title="↑" accessibilityLabel="Move up" disabled={i === 0} onPress={() => move(r.key, -1)} />
              <Button small kind="ghost" title="↓" accessibilityLabel="Move down" disabled={i === rows.length - 1} onPress={() => move(r.key, 1)} />
              <Button small kind="ghost" title="Remove" onPress={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} />
            </Row>
          </Row>
          <Row>
            <Field style={{ flex: 1 }} label="Sets" value={r.targetSets} onChangeText={(v) => update(r.key, { targetSets: v })} keyboardType="number-pad" />
            <Field style={{ flex: 1 }} label="Reps (optional)" value={r.targetReps} onChangeText={(v) => update(r.key, { targetReps: v })} keyboardType="number-pad" />
            <Field style={{ flex: 1 }} label="Rest (s)" value={r.restSeconds} onChangeText={(v) => update(r.key, { restSeconds: v })} keyboardType="number-pad" />
          </Row>
          {errors[r.key] ? <Muted>{errors[r.key]}</Muted> : null}
        </Card>
      ))}
      {picking ? (
        <ExercisePicker exercises={exercises} onPick={add} onCreate={create} onCancel={() => setPicking(false)} />
      ) : (
        <Button title="+ Add exercise" kind="secondary" onPress={() => setPicking(true)} />
      )}
      {suggestions.map((s) => (
        <Muted key={s}>{s}</Muted>
      ))}
      <Button testID="save-template" title="Save template" onPress={save} busy={busy} />
      {!isNew ? <Button title="Delete template" kind="ghost" onPress={remove} /> : null}
    </Screen>
  );
}
