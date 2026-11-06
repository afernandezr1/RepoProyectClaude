import { router } from 'expo-router';
import React, { useState } from 'react';
import { Banner, EmptyState, ErrorState, LoadingState, errorMessage, type BannerMessage } from '../../components/states';
import { Body, Button, Card, H1, H2, Muted, Row, Screen } from '../../components/ui';
import { mondayWeekday, WEEKDAY_LONG } from '../../domain/dates';
import { useApp, useLoad } from '../../state/AppContext';

export default function Today() {
  const { store, settings, bump } = useApp();
  const { state, retry } = useLoad(async (s) => ({
    active: await s.getActiveWorkout(),
    templates: await s.listTemplates(),
    routine: await s.getRoutine(),
  }));
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<BannerMessage | null>(null);

  const start = async (templateId: string | null) => {
    setBusy(templateId ?? 'empty');
    try {
      const id = await store.startWorkout(templateId, settings.defaultRestSeconds);
      bump();
      router.push(`/workout/${id}`);
    } catch (e) {
      setMsg({ kind: 'error', text: `Couldn't start the workout: ${errorMessage(e)}` });
    } finally {
      setBusy(null);
    }
  };

  if (state.status === 'loading') return <LoadingState />;
  if (state.status === 'error') {
    return (
      <Screen>
        <ErrorState message={errorMessage(state.error)} onRetry={retry} />
      </Screen>
    );
  }
  const { active, templates, routine } = state.data;
  const today = mondayWeekday(new Date());
  const plan = routine.find((d) => d.weekday === today);
  const planned = plan?.templateId ? templates.find((t) => t.id === plan.templateId) : undefined;

  return (
    <Screen>
      <H1>{WEEKDAY_LONG[today]}</H1>
      <Banner message={msg} onDismiss={() => setMsg(null)} />

      {active ? (
        <Card>
          <H2>Workout in progress</H2>
          <Body>{active.name}</Body>
          <Button testID="resume-workout" title="Resume" onPress={() => router.push(`/workout/${active.id}`)} />
        </Card>
      ) : null}

      <Card>
        <H2>Today’s plan</H2>
        {plan?.kind === 'rest' ? (
          <Body>Rest day. Recovery is part of training — enjoy it, or do something light if you feel like it.</Body>
        ) : plan?.kind === 'workout' ? (
          <>
            <Body>Workout day{planned ? `: ${planned.name}` : ''}.</Body>
            {planned && !active ? (
              <Button
                title={`Start ${planned.name}`}
                onPress={() => start(planned.id)}
                busy={busy === planned.id}
              />
            ) : null}
          </>
        ) : (
          <Body>Open day — do whatever suits you, or nothing at all.</Body>
        )}
        <Button title="Edit weekly routine" kind="ghost" small onPress={() => router.push('/routine')} />
      </Card>

      <H2>Start a workout</H2>
      {templates.length === 0 ? (
        <EmptyState
          title="No templates yet"
          body="Templates hold the exercises, sets and rest times you like to use."
          actionLabel="Create a template"
          onAction={() => router.push('/templates/new')}
        />
      ) : (
        templates.map((t) => (
          <Card key={t.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Body style={{ fontWeight: '600', flexShrink: 1 }}>{t.name}</Body>
              <Button
                testID={`start-${t.id}`}
                title={active ? 'In progress' : 'Start'}
                small
                disabled={!!active || busy !== null}
                busy={busy === t.id}
                onPress={() => start(t.id)}
              />
            </Row>
            <Muted>
              {t.exercises.length} exercises · {t.exercises.reduce((a, e) => a + e.targetSets, 0)} sets
            </Muted>
          </Card>
        ))
      )}
      <Row>
        <Button
          title="Empty workout"
          kind="secondary"
          disabled={!!active || busy !== null}
          busy={busy === 'empty'}
          onPress={() => start(null)}
        />
        <Button title="Manage templates" kind="ghost" onPress={() => router.push('/templates')} />
      </Row>
      <Button title="About & safety" kind="ghost" small onPress={() => router.push('/about')} />
    </Screen>
  );
}
