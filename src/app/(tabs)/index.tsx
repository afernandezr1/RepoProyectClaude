import { router } from 'expo-router';
import React, { useState } from 'react';
import { Banner, EmptyState, ErrorState, LoadingState, errorMessage, type BannerMessage } from '../../components/states';
import { Body, Button, Card, H1, H2, Muted, Row, Screen } from '../../components/ui';
import { mondayWeekday, WEEKDAY_LONG } from '../../domain/dates';
import { useApp, useLoad } from '../../state/AppContext';

export default function Today() {
  const { store, settings, bump, persistent } = useApp();
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
      setMsg({ kind: 'error', text: `No se pudo empezar el entrenamiento: ${errorMessage(e)}` });
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
      {!persistent ? (
        <Card>
          <H2>No se está guardando</H2>
          <Body>Este navegador bloquea el almacenamiento, así que lo que registres desaparece al cerrar la página. Exporta desde Ajustes para conservarlo.</Body>
        </Card>
      ) : null}

      {active ? (
        <Card>
          <H2>Entrenamiento en curso</H2>
          <Body>{active.name}</Body>
          <Button testID="resume-workout" title="Continuar" onPress={() => router.push(`/workout/${active.id}`)} />
        </Card>
      ) : null}

      <Card>
        <H2>El plan de hoy</H2>
        {plan?.kind === 'rest' ? (
          <Body>Día de descanso. Recuperarse es parte del entrenamiento: disfrútalo, o haz algo suave si te apetece.</Body>
        ) : plan?.kind === 'workout' ? (
          <>
            <Body>Día de entrenamiento{planned ? `: ${planned.name}` : ''}.</Body>
            {planned && !active ? (
              <Button
                title={`Empezar ${planned.name}`}
                onPress={() => start(planned.id)}
                busy={busy === planned.id}
              />
            ) : null}
          </>
        ) : (
          <Body>Día libre: haz lo que te apetezca, o nada.</Body>
        )}
        <Button title="Editar rutina semanal" kind="ghost" small onPress={() => router.push('/routine')} />
      </Card>

      <H2>Empezar un entrenamiento</H2>
      {templates.length === 0 ? (
        <EmptyState
          title="Aún no hay plantillas"
          body="Las plantillas guardan los ejercicios, series y descansos que te gusta usar."
          actionLabel="Crear una plantilla"
          onAction={() => router.push('/templates/new')}
        />
      ) : (
        templates.map((t) => (
          <Card key={t.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Body style={{ fontWeight: '600', flexShrink: 1 }}>{t.name}</Body>
              <Button
                testID={`start-${t.id}`}
                title={active ? 'En curso' : 'Empezar'}
                small
                disabled={!!active || busy !== null}
                busy={busy === t.id}
                onPress={() => start(t.id)}
              />
            </Row>
            <Muted>
              {t.exercises.length} ejercicios · {t.exercises.reduce((a, e) => a + e.targetSets, 0)} series
            </Muted>
          </Card>
        ))
      )}
      <Row>
        <Button
          title="Entrenamiento vacío"
          kind="secondary"
          disabled={!!active || busy !== null}
          busy={busy === 'empty'}
          onPress={() => start(null)}
        />
        <Button title="Gestionar plantillas" kind="ghost" onPress={() => router.push('/templates')} />
      </Row>
      <Button title="Información y seguridad" kind="ghost" small onPress={() => router.push('/about')} />
    </Screen>
  );
}
